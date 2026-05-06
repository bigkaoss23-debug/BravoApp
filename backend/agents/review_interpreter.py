"""
review_interpreter.py — A9 Review Interpreter (Haiku).

Trasforma una recensione grezza (Google/Booking) in una pieza editorial
con headline + caption in brand voice. Non inventa — usa le parole del cliente.
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

import anthropic


_SYSTEM = """Eres el Review Interpreter de Studio Bravo. Tu trabajo es transformar una reseña real de un huésped en una pieza editorial para Instagram, manteniendo la autenticidad.

PRINCIPIOS:
- No inventes ni exageres — usa las palabras del huésped
- El copy debe sonar humano, no de agencia
- Respeta el tono de voz del hotel (frases cortas, sin exclamaciones, sin emojis en feed)
- La headline es UNA frase del huésped reinterpretada o una declaración potente en 1ª persona
- La caption contextualiza la cita con 2-3 líneas en voz del hotel

OUTPUT — JSON exacto:
{
  "headline": "DECLARACIÓN EN MAYÚSCULAS (máx 8 palabras, nunca imperativo)",
  "caption": "texto completo (30-60 palabras) con la cita del huésped integrada",
  "quote_used": "fragmento exacto de la reseña que usaste como base",
  "pillar": "Huéspedes y Testimonios",
  "content_type": "Voz Real"
}

NUNCA pongas textos como: "¡Gracias!", "¡Increíble!", precios, descuentos ni urgencia."""


class ReviewInterpreter:
    """A9 — Reseña real → headline + caption en brand voice."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-haiku-4-5-20251001"

    def run(
        self,
        review_text: str,
        brand_kit_opus: dict,
        reviewer_name: Optional[str] = None,
        platform: str = "Google",
    ) -> dict:
        """
        Interpreta una recensione e la trasforma in copy editorial.

        review_text: testo della recensione
        brand_kit_opus: brand kit del cliente
        reviewer_name: nome del recensore (opzionale, per personalizzare)
        platform: Google | Booking | TripAdvisor
        """
        identity = brand_kit_opus.get("identity", {})
        tone = (
            brand_kit_opus.get("tone_of_voice", "")
            or identity.get("tone_of_voice", "")
        )
        example_correct = identity.get("example_correct", "")
        example_incorrect = identity.get("example_incorrect", "")
        rules_dont = (
            identity.get("rules_dont", [])
            or brand_kit_opus.get("rules_dont", [])
            or brand_kit_opus.get("design_system", {}).get("rules_dont", [])
        )

        key_messages = brand_kit_opus.get("key_messages", {})
        hashtags = key_messages.get("hashtags", []) or brand_kit_opus.get("hashtags", [])

        dont_lines = "\n".join(f"  ✗ {r}" for r in rules_dont[:4])

        user_msg = (
            f"RESEÑA ({platform}"
            + (f" — {reviewer_name}" if reviewer_name else "")
            + f"):\n\"{review_text}\"\n\n"
            f"TONO DE VOZ DEL HOTEL:\n{tone[:300]}\n\n"
            + (f"EJEMPLO CORRECTO: \"{example_correct}\"\n" if example_correct else "")
            + (f"EJEMPLO INCORRECTO: \"{example_incorrect}\"\n" if example_incorrect else "")
            + (f"\nREGLAS (no hacer):\n{dont_lines}\n" if dont_lines else "")
            + f"\nHASHTAGS OFICIALES (máx 2): {' '.join(hashtags[:2])}\n\n"
            "Transforma esta reseña en una pieza editorial respetando el tono del hotel."
        )

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=500,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        return self._parse(raw, hashtags)

    def _parse(self, raw: str, hashtags: list) -> dict:
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {
                "headline": "",
                "caption": raw[:200],
                "quote_used": "",
                "pillar": "Huéspedes y Testimonios",
                "content_type": "Voz Real",
            }

        if data.get("headline"):
            data["headline"] = data["headline"].upper()

        if "hashtags" not in data:
            data["hashtags"] = hashtags[:2]

        return data
