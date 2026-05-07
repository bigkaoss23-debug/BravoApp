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
- Headline: MÁXIMO 12 PALABRAS. Cuenta las palabras antes de cerrar. Si supera 12, recorta. Esta regla es absoluta y no admite excepciones.
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

OUTPUT — JSON exacto, sin texto fuera.
Siempre incluye dos versiones de headline: la principal (headline) y una alternativa (headline_alt).
Ambas deben respetar el límite de 12 palabras y ser distintas en estructura o enfoque:
{
  "headline": "HEADLINE PRINCIPAL EN MAYÚSCULAS",
  "headline_alt": "HEADLINE ALTERNATIVA EN MAYÚSCULAS",
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
        max_headline_words: int = 12,
    ) -> dict:
        """
        Genera headline + caption + headline_alt dal brief.
        Se la headline supera max_headline_words, fa 1 retry.
        Restituisce {headline, headline_alt, caption, hashtags, _copy_log}.
        _copy_log contiene la memoria del ragionamento per il decision log.
        """
        brief_block = to_prompt_block(brief)

        user_msg = brief_block
        if extra_context:
            user_msg += f"\n\nCONTEXTO ADICIONAL:\n{extra_context}"
        if user_note:
            user_msg += f"\n\nNOTA DE BRAVO:\n{user_note}"

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=1100,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        data = self._parse(raw, brief)

        # ── Decision log: traccia primo tentativo ───────────────────────────
        first_headline = data.get("headline", "")
        first_n = len(first_headline.split())
        copy_log = {
            "first_attempt": {
                "headline": first_headline,
                "headline_alt": data.get("headline_alt", ""),
                "words": first_n,
            },
            "retry_needed": False,
            "retry_reason": None,
            "final_words": first_n,
        }

        # ── Retry se la headline supera il limite ───────────────────────────
        if first_n > max_headline_words and first_headline:
            print(f"   ↺ Copy retry — headline troppo lunga ({first_n} parole)")
            copy_log["retry_needed"] = True
            copy_log["retry_reason"] = f"headline {first_n} palabras > máx {max_headline_words}"

            assistant_msg = raw
            retry_user = (
                f"La headline anterior tiene {first_n} palabras, supera el máximo "
                f"de {max_headline_words}. Reescríbela: máximo {max_headline_words} "
                f"palabras, manteniendo la misma idea, voz y mayúsculas. "
                f"Devuelve el JSON completo actualizado (headline + headline_alt + caption + hashtags)."
            )
            response2 = self.claude.messages.create(
                model=self.model,
                max_tokens=1100,
                system=_SYSTEM,
                messages=[
                    {"role": "user", "content": user_msg},
                    {"role": "assistant", "content": assistant_msg},
                    {"role": "user", "content": retry_user},
                ],
            )
            raw2 = response2.content[0].text.strip()
            data2 = self._parse(raw2, brief)
            new_n = len(data2.get("headline", "").split())
            if new_n <= max_headline_words and new_n > 0:
                data = data2
                copy_log["final_words"] = new_n
                print(f"   ✓ Copy retry OK ({new_n} palabras)")
            else:
                copy_log["retry_reason"] += f" → retry ancora lungo ({new_n}), usata versione originale"
                print(f"   ⚠ Copy retry ancora lungo ({new_n}), uso la prima versione")

        data["_copy_log"] = copy_log
        return data

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
        if data.get("headline_alt"):
            data["headline_alt"] = data["headline_alt"].upper()

        return data
