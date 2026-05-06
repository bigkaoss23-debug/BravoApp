"""
copy_agent.py — A6 Copy Agent (Sonnet).

Genera headline + caption da un CreativeBrief strutturato.
Input: CreativeBrief dal BriefComposer.
Output: {headline, caption, hashtags}
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

import anthropic

from agents.brief_composer import CreativeBrief, to_prompt_block


_SYSTEM = """Eres el Copy Agent de Studio Bravo. Tu único trabajo es escribir el copy de un post de Instagram a partir de un brief creativo.

REGLAS ABSOLUTAS:
- Headline: SIEMPRE en mayúsculas, sigue el headline_style indicado en el brief
- Caption: sigue la longitud indicada (corta/media/larga), termina siempre con punto final
- NO uses exclamaciones
- NO uses emojis en posts de feed
- Máx 2 hashtags — usa SOLO los oficiales del brief, nunca inventes
- Escribe en el idioma del brief (español por defecto)
- El copy debe resonar con la persona objetivo indicada en el brief

ESTRUCTURA CAPTION (en este orden):
1. Primera línea de impacto (hook)
2. Desarrollo (1-3 frases según longitud)
3. Cierre o CTA suave (nunca "¡Reserva ahora!")

OUTPUT — JSON exacto, sin texto fuera:
{
  "headline": "HEADLINE EN MAYÚSCULAS",
  "caption": "texto completo de la caption",
  "hashtags": ["#Tag1", "#Tag2"]
}"""


class CopyAgent:
    """A6 — Genera headline + caption da un CreativeBrief."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-6"

    def run(
        self,
        brief: CreativeBrief,
        extra_context: str = "",
        user_note: str = "",
    ) -> dict:
        """
        Genera headline + caption dal brief.
        Restituisce {headline, caption, hashtags}.
        """
        brief_block = to_prompt_block(brief)

        user_msg = brief_block
        if extra_context:
            user_msg += f"\n\nCONTEXTO ADICIONAL:\n{extra_context}"
        if user_note:
            user_msg += f"\n\nNOTA DE BRAVO:\n{user_note}"

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=1000,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        return self._parse(raw, brief)

    def _parse(self, raw: str, brief: CreativeBrief) -> dict:
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
                "headline": raw[:80],
                "caption": raw,
                "hashtags": brief.get("hashtags", [])[:2],
            }

        # Garantisce cap 2 hashtag
        hashtags = data.get("hashtags", brief.get("hashtags", []))
        data["hashtags"] = hashtags[:2]

        # Garantisce headline in maiuscolo
        if data.get("headline"):
            data["headline"] = data["headline"].upper()

        return data
