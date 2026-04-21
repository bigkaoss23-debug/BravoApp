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
        "Rispondi SOLO con JSON valido, senza testo prima o dopo, senza commenti, "
        "senza blocchi di codice markdown. "
        "Se generi un solo contenuto, restituisci un oggetto JSON. "
        "Se generi più contenuti, restituisci un array JSON."
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
            subtitle_color=tuple(overlay_data.get("subtitle_color", (255, 127, 80))),
            side=overlay_data.get("side", "left"),
        )

        default_platform = request.platform.value if request.platform else Platform.INSTAGRAM.value

        content = ContentItem(
            pillar=_safe_enum(ContentPillar, item.get("pillar", "CONTENIDO"), "CONTENIDO"),
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

class ContentDesignerAgent:
    """
    Agente specializzato nella generazione di contenuti social per un cliente.
    Usa Claude API con il system prompt specifico del cliente.
    Se generate_image=True, chiama anche Ideogram per generare il visual.
    """

    def __init__(self, api_key: str, ideogram_api_key: str = None):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-6"
        self.ideogram_api_key = ideogram_api_key

    def _call_claude(self, system_prompt: str, user_message: str) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=8000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text

    def run(self, request: GenerateContentRequest) -> GenerateContentResponse:
        brand_kit   = get_brand_kit(request.client_id)
        client_info = get_client_info(request.client_id)
        if not client_info and not brand_kit.get("tone_of_voice"):
            raise ValueError(f"Cliente '{request.client_id}' non trovato o senza brand kit.")
        system_prompt = build_system_prompt(brand_kit, client_info)

        # 1. Genera copy e visual prompt con Claude, con retry su JSON malformato.
        lessons = build_lessons_block(request.client_id)
        user_message = build_user_message(request, lessons=lessons)

        raw_content = self._call_claude(system_prompt, user_message)
        try:
            contents = parse_agent_response(raw_content, request)
        except AgentResponseError as e:
            logger.warning("Primo parsing fallito (%s) — retry con istruzioni strette.", e)
            retry_message = (
                user_message
                + "\n\nLa tua risposta precedente non era JSON valido "
                + f"(errore: {e}). Rispondi ORA con JSON valido puro: nessun testo prima o dopo, "
                + "nessun blocco markdown, nessun commento."
            )
            raw_content = self._call_claude(system_prompt, retry_message)
            contents = parse_agent_response(raw_content, request)  # se fallisce ora, propaga

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
