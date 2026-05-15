"""
photo_needs.py — PhotoNeedsAgent (Sonnet · isolato).

UNA responsabilità: dato il piano editoriale di un cliente, per gli slot
che NON hanno ancora una foto, produrre la "lista della spesa" di prompt
Higgsfield. NON genera immagini (quello avviene dopo il cancello umano
sui prompt).

Isolato per scelta architetturale (Costituzione · responsabilità isolate):
  - NON dipende da content_designer (legacy v1)
  - NON importa brand_store (modulo v1 pesante)
  - Incorpora la metodologia "image-poster" 5 passi come conoscenza propria
  - Scrive in photo_requests con status='proposed' (primo cancello a valle)

Flusso completo (i due cancelli sono cambi di status, gestiti altrove):
  proposed → [GATE prompt] → prompt_approved → generating → generated
           → [GATE foto] → photo_confirmed (→ client_assets) | rejected
"""
from __future__ import annotations

import os
import uuid
from typing import Optional

import anthropic

from tools.supabase_client import get_client
from tools.briefing_store import get_briefing


_SYSTEM = """Eres el agente que escribe prompts para un generador de imágenes IA
(Higgsfield). Tu única tarea: dado el contexto de UN post, escribir UN prompt
fotográfico preciso, en INGLÉS, listo para generar.

METODOLOGÍA (constrúyelo en este orden exacto):
1. Sujeto + composición: qué está en el frame, dónde, escala; línea de visión
2. Iluminación + mood: natural/dramática; cálida/fría; hora del día si exterior
3. Paleta + texturas: tonos del brand; etiqueta 3 palabras (ej "warm ochre + linen + stone")
4. Cámara / lente: si quieres realismo ("50mm, f/2.0, shallow DOF, analog film")
5. Qué evitar: lo prohibido (abajo)

REGLAS ABSOLUTAS (la imagen es para una marca real — autenticidad):
- NUNCA texto, letras, palabras, etiquetas legibles, logos, carteles en la imagen
  (los modelos IA alucinan texto: prohíbelo explícitamente en el paso 5)
- NUNCA personas reconocibles ni caras (salvo que el brief lo pida explícito)
- Paleta SOBRIA y terrosa: NADA de colores saturados brillantes, NADA de
  alto contraste, NADA de "stock photo feel"
- Estética editorial / fotografía analógica, natural, sin filtros agresivos
- El prompt describe UNA escena concreta del brief de HOY, no una postal genérica

Usa el TONO y el ÁNGULO del briefing como guía de la escena: no inventes un
mundo distinto del cliente.

OUTPUT — JSON exacto, sin texto fuera:
{
  "prompt": "prompt completo en inglés, metodología 5 pasos",
  "negative_prompt": "text, letters, words, labels, logos, signage, watermark, extra fingers, warped text, stock photo, oversaturated, high contrast, people faces",
  "aspect_ratio": "1:1 | 9:16",
  "reasoning": "1 frase: por qué esta escena sirve a este pilar/ángulo"
}"""


_ASPECT_BY_FORMAT = {
    "Post 1:1": "1:1",
    "Carosello": "1:1",
    "Story 9:16": "9:16",
    "Portada Reel": "9:16",
}


class PhotoNeedsAgent:
    """Sonnet — costruisce la lista-spesa di prompt foto per gli slot scoperti."""

    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-6"

    # ── contesto brand letterale (sez. 03 tono + 06 ángulos) ────────────────
    def _brand_context(self, client_id: str) -> str:
        bri = get_briefing(client_id) or {}
        sec = bri.get("briefing_sections") or {}
        parts = []
        if sec.get("03"):
            parts.append("## IDENTIDAD / TONO (literal)\n" + sec["03"][:1500])
        if sec.get("06"):
            parts.append("## ÁNGULOS NARRATIVOS (literal)\n" + sec["06"][:2000])
        return "\n\n".join(parts) if parts else "(briefing canonico non disponibile)"

    # ── slot del piano senza foto ───────────────────────────────────────────
    def _slots_without_photo(
        self, client_id: str, month: str,
        formats: Optional[list] = None,
    ) -> list[dict]:
        sb = get_client()
        if sb is None:
            return []
        # Fine mese robusta: primo giorno del mese successivo (no "giorno 31")
        y, m = int(month.split("-")[0]), int(month.split("-")[1])
        next_y, next_m = (y + 1, 1) if m == 12 else (y, m + 1)
        month_end_excl = f"{next_y:04d}-{next_m:02d}-01"
        rows = (
            sb.table("editorial_plans")
            .select("id,scheduled_date,pillar,angle,brief,format")
            .eq("client_id", client_id)
            .gte("scheduled_date", f"{month}-01")
            .lt("scheduled_date", month_end_excl)
            .order("scheduled_date")
            .execute()
            .data
            or []
        )
        if formats:
            rows = [r for r in rows if r.get("format") in formats]
        # Slot già coperti = hanno una photo_request non rifiutata
        covered = set()
        existing = (
            sb.table("photo_requests")
            .select("plan_slot_id,status")
            .eq("client_id", client_id)
            .execute()
            .data
            or []
        )
        for e in existing:
            if e.get("status") != "rejected" and e.get("plan_slot_id"):
                covered.add(e["plan_slot_id"])
        return [r for r in rows if r["id"] not in covered]

    def build_shopping_list(
        self, client_id: str, month: str,
        formats: Optional[list] = None,
    ) -> dict:
        """
        Produce la lista-spesa: per ogni slot scoperto, un prompt proposto
        salvato in photo_requests (status='proposed'). NON genera immagini.
        formats: filtra per formato (es. ["Post 1:1"] = solo feed). None = tutti.
        Ritorna {batch_id, count, items:[...]} per notifica + cancello prompt.
        """
        sb = get_client()
        if sb is None:
            raise RuntimeError("Supabase non disponibile")

        slots = self._slots_without_photo(client_id, month, formats=formats)
        if not slots:
            return {"batch_id": None, "count": 0, "items": [],
                    "note": "Tutti gli slot hanno già una foto o richiesta attiva."}

        brand_ctx = self._brand_context(client_id)
        batch_id = str(uuid.uuid4())
        items: list[dict] = []

        for slot in slots:
            fmt = slot.get("format", "Post 1:1")
            user_msg = (
                f"{brand_ctx}\n\n"
                f"────────────────────────────────\n"
                f"POST DE HOY:\n"
                f"  Pilar:  {slot.get('pillar','')}\n"
                f"  Ángulo: {slot.get('angle','')}\n"
                f"  Brief:  {slot.get('brief','')}\n"
                f"  Formato: {fmt}\n"
                f"Escribe el prompt según el system. JSON exacto."
            )
            try:
                resp = self.claude.messages.create(
                    model=self.model, max_tokens=900,
                    system=_SYSTEM,
                    messages=[{"role": "user", "content": user_msg}],
                )
                raw = resp.content[0].text.strip()
                import re, json
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)
                s, e = raw.find("{"), raw.rfind("}") + 1
                data = json.loads(raw[s:e]) if s != -1 else {}
            except Exception as ex:
                data = {"prompt": "", "reasoning": f"errore: {ex}"}

            prompt = (data.get("prompt") or "").strip()
            if not prompt:
                continue  # niente prompt → niente riga (no spazzatura)

            aspect = data.get("aspect_ratio") or _ASPECT_BY_FORMAT.get(fmt, "1:1")
            row = {
                "id": str(uuid.uuid4()),
                "client_id": client_id,
                "plan_slot_id": slot["id"],
                "scheduled_date": slot.get("scheduled_date"),
                "pillar": slot.get("pillar"),
                "angle": slot.get("angle"),
                "brief": slot.get("brief"),
                "prompt": prompt,
                "negative_prompt": data.get("negative_prompt") or "",
                "aspect_ratio": aspect,
                "model": "soul_location",
                "status": "proposed",
                "proposed_by": "photo_needs",
                "batch_id": batch_id,
                "notes": data.get("reasoning") or "",
            }
            sb.table("photo_requests").insert(row).execute()
            items.append({
                "id": row["id"], "scheduled_date": row["scheduled_date"],
                "pillar": row["pillar"], "angle": row["angle"],
                "prompt": prompt, "aspect_ratio": aspect,
            })

        return {"batch_id": batch_id, "count": len(items), "items": items}
