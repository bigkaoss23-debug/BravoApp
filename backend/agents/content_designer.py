import json
import logging
import re
import anthropic
from models.content import (
    GenerateContentRequest,
    GenerateContentResponse,
    ContentItem,
    GeneratedImage,
    OverlayText,
    LayoutVariant,
    ContentPillar,
    ContentFormat,
    Platform,
)
from tools.ideogram import generate_image, IdeogramError
from tools.feedback_store import build_lessons_block
from tools.brand_store import get_brand_kit, get_client_info, build_system_prompt

logger = logging.getLogger(__name__)


class AgentResponseError(Exception):
    """Sollevata quando Claude non restituisce un JSON valido dopo retry."""


def build_user_message(request: GenerateContentRequest, lessons: str = "") -> str:
    """Costruisce il messaggio utente per l'agente in base alla richiesta."""
    parts = [f"Brief: {request.brief}"]

    if request.platform:
        parts.append(f"Piattaforma: {request.platform.value}")
    if request.pillar:
        parts.append(f"Pilastro: {request.pillar.value}")
    if request.format:
        parts.append(f"Formato: {request.format.value}")
    if request.num_contents > 1:
        parts.append(f"Numero contenuti da generare: {request.num_contents}")

    if lessons:
        parts.append(lessons)

    parts.append(
        "Responde SOLO con JSON válido, sin texto antes ni después, sin comentarios, "
        "sin bloques de código markdown. "
        "Si generas un solo contenido, devuelve un objeto JSON. "
        "Si generas más contenidos, devuelve un array JSON."
    )

    return "\n".join(parts)


# -----------------------------------------------------------------------------
# Parsing robusto
# -----------------------------------------------------------------------------

_VALID_LAYOUTS = {l.value for l in LayoutVariant}


def _extract_json_payload(raw: str) -> str:
    """
    Estrae il JSON da una risposta Claude, tollerando:
    - fence markdown (```json ... ``` / ``` ... ```)
    - testo prima o dopo
    - whitespace in eccesso
    """
    clean = raw.strip()

    # Rimuove fence markdown
    fence = re.search(r"```(?:json)?\s*(.*?)```", clean, re.DOTALL | re.IGNORECASE)
    if fence:
        clean = fence.group(1).strip()

    # Se c'è testo spurio prima/dopo, prendi il primo blocco { ... } o [ ... ]
    if clean and clean[0] not in "{[":
        obj_match = re.search(r"(\{.*\}|\[.*\])", clean, re.DOTALL)
        if obj_match:
            clean = obj_match.group(1)

    return clean


def _safe_enum(enum_cls, value, default):
    """Prova enum_cls(value); se fallisce logga warning e usa default."""
    try:
        return enum_cls(value)
    except (ValueError, TypeError):
        logger.warning(
            "Valore non valido per %s: %r — uso fallback %r",
            enum_cls.__name__, value, default,
        )
        return enum_cls(default)


def parse_agent_response(raw: str, request: GenerateContentRequest) -> list[ContentItem]:
    """
    Parsa il JSON restituito dall'agente in oggetti ContentItem.
    Solleva AgentResponseError se il JSON non è valido.
    """
    clean = _extract_json_payload(raw)
    try:
        data = json.loads(clean)
    except json.JSONDecodeError as e:
        raise AgentResponseError(f"JSON non valido: {e}") from e

    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        raise AgentResponseError(f"JSON atteso oggetto o array, ricevuto {type(data).__name__}")

    items = []
    for item in data:
        if not isinstance(item, dict):
            logger.warning("Elemento non-dict ignorato: %r", item)
            continue

        overlay_data = item.get("overlay", {}) or {}
        layout_raw = overlay_data.get("layout_variant", "bottom-left")
        if layout_raw not in _VALID_LAYOUTS:
            logger.warning(
                "layout_variant sconosciuto %r — fallback a bottom-left", layout_raw
            )
            layout_raw = "bottom-left"

        overlay = OverlayText(
            headline=overlay_data.get("headline", ""),
            body=overlay_data.get("body"),
            layout_variant=LayoutVariant(layout_raw),
            logo_position=overlay_data.get("logo_position", "top-center"),
            label=overlay_data.get("label"),
            subtitle_color=list(overlay_data.get("subtitle_color", [255, 255, 255])),
            side=overlay_data.get("side", "left"),
        )

        default_platform = request.platform.value if request.platform else Platform.INSTAGRAM.value

        content = ContentItem(
            pillar=item.get("pillar", "CONTENIDO"),  # stringa libera — preserva pillar custom del brand kit
            format=_safe_enum(ContentFormat, item.get("format", "Post 1:1"), "Post 1:1"),
            platform=_safe_enum(Platform, item.get("platform", default_platform), default_platform),
            content_type=item.get("content_type", ""),
            visual_prompt=item.get("visual_prompt", ""),
            overlay=overlay,
            caption=item.get("caption", ""),
            agent_notes=item.get("agent_notes"),
        )
        items.append(content)

    if not items:
        raise AgentResponseError("Nessun contenuto estraibile dalla risposta JSON.")

    return items


# -----------------------------------------------------------------------------
# Agente
# -----------------------------------------------------------------------------

_ART_DIRECTOR_SYSTEM = """Eres el Art Director AI. Tu único trabajo es decidir la composición visual de un post ya redactado.

INPUT: brief del post + copy (headline, caption) ya escritos.
OUTPUT JSON exacto:
{
  "layout_variant": "<bottom-left|bottom-right|bottom-full|top-left|top-right|center|centered-header|centered-with-logo|asymmetric-left|asymmetric-right>",
  "content_type": "<tipo de post, ej: Testimonio, Consejo, Producto, Reel Portada, Story>",
  "format": "<Post 1:1|Story 9:16|Portada Reel>",
  "visual_prompt": "<descripción en inglés de la fotografía ideal, máx 40 palabras>"
}

REGLAS layout:
- bottom-left/right: sujeto centrado o en un lado, texto en esquina opuesta
- centered-header: logo arriba + headline dominante — ideal portadas y reels
- asymmetric-left/right: texto en columna lateral 40% — ideal equipo y testimonios
- center: fondo desenfocado o bokeh fuerte — texto dominante en centro
Elige siempre el layout que maximiza el impacto visual del copy dado.
Responde SOLO JSON, sin texto adicional."""


class ContentDesignerAgent:
    """
    Agente especializado en generación de contenidos social para un cliente.
    Usa Claude API con el system prompt específico del cliente.
    Si el cliente tiene agent_prompts.copywriter en brand_kit_opus, usa pipeline
    split: Copywriter (sonnet) → ArtDirector (haiku) — más ligero y barato.
    """

    def __init__(self, api_key: str, ideogram_api_key: str = None):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-6"
        self.model_haiku = "claude-haiku-4-5-20251001"
        self.ideogram_api_key = ideogram_api_key

    def _call_claude(self, system_prompt: str, user_message: str, model: str = None) -> str:
        response = self.client.messages.create(
            model=model or self.model,
            max_tokens=8000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text

    def _run_split_pipeline(
        self,
        brand_kit: dict,
        client_info: dict,
        request: GenerateContentRequest,
        copywriter_prompt: str,
        lessons: str,
    ) -> list:
        """
        Pipeline Copywriter (sonnet) → ArtDirector (haiku).
        Usata solo per clienti con agent_prompts.copywriter nel brand_kit_opus.
        """
        client_name = client_info.get("name", request.client_id)
        opus = brand_kit.get("brand_kit_opus") or {}
        copy_rules = opus.get("copy_rules", {})
        forbidden = copy_rules.get("forbidden_words", [])

        import re as _re, json as _json

        n = request.num_contents or 1
        fmt_label = request.format.value if request.format else 'Post 1:1'
        plt_label = request.platform.value if request.platform else 'instagram'

        # Step 1 — Copywriter: genera N varianti creative diverse
        if n > 1:
            copywriter_user = f"""BRIEF: {request.brief}
FORMATO RICHIESTO: {fmt_label}
PIATTAFORMA: {plt_label}
{f'LEZIONI PASSATE:{chr(10)}{lessons}' if lessons else ''}

Produce EXACTAMENTE {n} variantes creativas DIFERENTES entre sí (ángulos, tonos y hooks distintos).
Responde SOLO con un array JSON de {n} objetos:
[
  {{"overlay_text": "<headline máx 14 palabras>", "caption": "<40-150 palabras>", "hashtags": ["#tag1"], "firstLine": "<gancho>", "lastLine": "<CTA>"}},
  ...
]"""
        else:
            copywriter_user = f"""BRIEF: {request.brief}
FORMATO RICHIESTO: {fmt_label}
PIATTAFORMA: {plt_label}
{f'LEZIONI PASSATE:{chr(10)}{lessons}' if lessons else ''}

Produci SOLO JSON:
{{
  "overlay_text": "<headline máx 14 palabras>",
  "caption": "<40-150 palabras, con detalle sensorial>",
  "hashtags": ["#tag1", "#tag2"],
  "firstLine": "<primera línea impactante>",
  "lastLine": "<CTA suave>"
}}"""

        print(f"   ✏️  Copywriter ({self.model}) — {n} variante/i per {client_name}...")
        raw_copy = self._call_claude(copywriter_prompt, copywriter_user)
        clean = _extract_json_payload(raw_copy)
        try:
            parsed = _json.loads(clean)
        except Exception:
            parsed = {"overlay_text": raw_copy[:80], "caption": raw_copy, "hashtags": [], "firstLine": "", "lastLine": ""}

        # Normalizza sempre a lista
        copies: list[dict] = parsed if isinstance(parsed, list) else [parsed]
        copies = copies[:n]
        # Se Claude ne ha generate meno del richiesto, logga e lascia quante sono
        # (meglio meno varianti vere che varianti duplicate)
        if len(copies) < n:
            import logging as _log
            _log.warning("Copywriter ha generato %d varianti su %d richieste — nessuna duplicazione.", len(copies), n)

        req_format   = request.format   or _safe_enum(ContentFormat, "Post 1:1", "Post 1:1")
        req_platform = request.platform or _safe_enum(Platform, "instagram", "instagram")
        req_pillar   = request.pillar   or "CONTENIDO"

        # Forbidden words pattern (compilato una volta)
        pat = None
        if forbidden:
            pat = _re.compile(r'\b(' + '|'.join(_re.escape(str(w)) for w in forbidden) + r')\b', _re.IGNORECASE)

        items: list[ContentItem] = []
        for idx, copy_data in enumerate(copies):
            overlay_text = copy_data.get("overlay_text", "")
            caption      = copy_data.get("caption", "")
            if pat:
                overlay_text = pat.sub("[·]", overlay_text)
                caption      = pat.sub("[·]", caption)

            # Step 2 — ArtDirector per questa variante
            art_user = f"""BRIEF: {request.brief}
HEADLINE: {overlay_text}
CAPTION: {caption}
CLIENTE: {client_name}"""
            print(f"   🎨 ArtDirector ({self.model_haiku}) — variante {idx+1}/{n}...")
            raw_art   = self._call_claude(_ART_DIRECTOR_SYSTEM, art_user, model=self.model_haiku)
            clean_art = _extract_json_payload(raw_art)
            try:
                art_data = _json.loads(clean_art)
            except Exception:
                art_data = {"layout_variant": "bottom-left", "content_type": "Post", "format": "Post 1:1", "visual_prompt": ""}

            overlay = OverlayText(headline=overlay_text, body=caption[:120], label=None)
            _lv_raw = art_data.get("layout_variant", "bottom-left")
            try:
                overlay.layout_variant = LayoutVariant(_lv_raw)
            except (ValueError, KeyError):
                overlay.layout_variant = LayoutVariant.BOTTOM_LEFT

            # P8 — usa il format suggerito dall'ArtDirector se valido, altrimenti req_format
            art_format = _safe_enum(ContentFormat, art_data.get("format", ""), req_format.value if hasattr(req_format, "value") else req_format)

            item = ContentItem(
                pillar=req_pillar,
                format=art_format,
                platform=req_platform,
                content_type=art_data.get("content_type", "Post"),
                visual_prompt=art_data.get("visual_prompt", ""),
                overlay=overlay,
                caption=caption,
                agent_notes=f"Pipeline split v{idx+1}: Copywriter+ArtDirector. Layout: {_lv_raw}",
            )
            items.append(item)

        return items

    def run(self, request: GenerateContentRequest) -> GenerateContentResponse:
        brand_kit   = get_brand_kit(request.client_id)
        client_info = get_client_info(request.client_id)
        if not client_info and not brand_kit.get("tone_of_voice"):
            raise ValueError(f"Cliente '{request.client_id}' non trovato o senza brand kit.")

        lessons = build_lessons_block(request.client_id)

        # Sceglie pipeline: split (Copywriter + ArtDirector) se il cliente ha prompt specifico
        opus = brand_kit.get("brand_kit_opus") or {}
        copywriter_prompt = (opus.get("agent_prompts") or {}).get("copywriter", "")

        if copywriter_prompt:
            client_name = client_info.get("name", request.client_id)
            print(f"✅ Pipeline split attivata per {client_name} (Copywriter+ArtDirector)")
            contents = self._run_split_pipeline(brand_kit, client_info, request, copywriter_prompt, lessons)
        else:
            # Pipeline classica: singolo ContentDesigner con sistema prompt completo
            system_prompt = build_system_prompt(brand_kit, client_info)
            user_message  = build_user_message(request, lessons=lessons)

            raw_content = self._call_claude(system_prompt, user_message)
            try:
                contents = parse_agent_response(raw_content, request)
            except AgentResponseError as e:
                logger.warning("Primo parsing fallito (%s) — retry con istruzioni strette.", e)
                retry_message = (
                    user_message
                    + "\n\nTu respuesta anterior no era JSON válido "
                    + f"(error: {e}). Responde AHORA con JSON válido puro: ningún texto antes ni después, "
                    + "ningún bloque markdown, ningún comentario."
                )
                raw_content = self._call_claude(system_prompt, retry_message)
                contents = parse_agent_response(raw_content, request)

        # 2. Se richiesto, genera le immagini con Ideogram.
        image_errors: list[str] = []
        if request.generate_image:
            if not self.ideogram_api_key:
                raise ValueError(
                    "IDEOGRAM_API_KEY non configurata. "
                    "Aggiungila nel file .env per generare immagini."
                )
            for content in contents:
                try:
                    img_data = generate_image(
                        prompt=content.visual_prompt,
                        api_key=self.ideogram_api_key,
                        format=content.format.value,
                    )
                    content.image = GeneratedImage(**img_data)
                except IdeogramError as e:
                    msg = f"Ideogram fallito per '{content.content_type}': {e}"
                    logger.error(msg)
                    image_errors.append(msg)

        notes = None
        if image_errors:
            notes = (
                f"{len(image_errors)}/{len(contents)} immagini non generate. "
                + " | ".join(image_errors)
            )

        return GenerateContentResponse(
            client_id=request.client_id,
            contents=contents,
            agent_notes=notes,
        )
