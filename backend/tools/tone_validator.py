"""
tone_validator.py — A15 Tone Validator (Haiku).

Check binario: il copy rispetta il tono di voce del brand?
Confronta headline + caption contro esempi corretto/incorretto del brand kit.
Se fallisce, restituisce istruzioni di correzione per il CopyAgent.
"""

from __future__ import annotations

import json
import os
import re
from typing import TypedDict

import anthropic


class ToneResult(TypedDict):
    passed: bool
    score: float          # 0.0–1.0
    violations: list[str] # liste di problemi specifici trovati
    correction_prompt: str # istruzioni per il CopyAgent se passed=False


_SYSTEM = """Eres el Tone Validator de Studio Bravo. Tu trabajo es verificar si un copy respeta el tono de voz del brand.

Recibirás:
- El copy a validar (headline + caption)
- El tono de voz del cliente (descripción + ejemplo correcto + ejemplo incorrecto)
- Las reglas DO/DON'T del brand

Tu análisis debe ser BINARIO y CONCRETO. No des puntuaciones medias — el copy pasa o no pasa.

OUTPUT — JSON exacto:
{
  "passed": true,
  "score": 0.85,
  "violations": [],
  "correction_prompt": ""
}

Si hay violaciones:
{
  "passed": false,
  "score": 0.4,
  "violations": [
    "El headline usa imperativo ('RESERVA') — el brand nunca usa imperativos",
    "La caption tiene 2 exclamaciones — el brand prohíbe exclamaciones"
  ],
  "correction_prompt": "Reescribe el headline como declaración evocadora, no imperativo. Elimina las exclamaciones. Mantén el mismo mensaje pero en tono de anfitrión tranquilo."
}

CRITERIOS DE EVALUACIÓN:
1. Tono: ¿suena como el ejemplo correcto o como el incorrecto?
2. Exclamaciones: ¿hay alguna? (prohibidas en feed)
3. Urgencia/FOMO: ¿hay "reserva ahora", "últimas plazas", "solo hoy"?
4. Emojis en headline: ¿hay alguno? (prohibidos en feed)
5. Voz narrativa: ¿primera/segunda persona natural o impersonal/genérico?
6. Longitud headline: ¿más de 10 palabras? (suele ser demasiado largo)"""


class ToneValidator:
    """A15 — Valida il tono del copy contro il brand kit."""

    MAX_RETRIES = 2

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-haiku-4-5-20251001"

    def validate(
        self,
        headline: str,
        caption: str,
        brand_kit_opus: dict,
    ) -> ToneResult:
        """
        Valida headline + caption contro il tono del brand.
        Restituisce ToneResult con passed/fail e correction_prompt se fallisce.
        """
        identity = brand_kit_opus.get("identity", {})
        tone = (
            brand_kit_opus.get("tone_of_voice", "")
            or identity.get("tone_of_voice", "")
        )
        example_correct = identity.get("example_correct", "")
        example_incorrect = identity.get("example_incorrect", "")
        rules_do = (
            identity.get("rules_do", [])
            or brand_kit_opus.get("rules_do", [])
            or brand_kit_opus.get("design_system", {}).get("rules_do", [])
        )
        rules_dont = (
            identity.get("rules_dont", [])
            or brand_kit_opus.get("rules_dont", [])
            or brand_kit_opus.get("design_system", {}).get("rules_dont", [])
        )

        do_lines = "\n".join(f"  ✓ {r}" for r in rules_do[:5])
        dont_lines = "\n".join(f"  ✗ {r}" for r in rules_dont[:5])

        user_msg = (
            f"COPY A VALIDAR:\nHeadline: {headline}\nCaption: {caption}\n\n"
            f"TONO DE VOZ:\n{tone[:400]}\n\n"
            + (f"EJEMPLO CORRECTO: \"{example_correct}\"\n" if example_correct else "")
            + (f"EJEMPLO INCORRECTO: \"{example_incorrect}\"\n\n" if example_incorrect else "")
            + (f"DO:\n{do_lines}\n" if do_lines else "")
            + (f"DON'T:\n{dont_lines}\n" if dont_lines else "")
        )

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=400,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        return self._parse(raw)

    def validate_with_retry(
        self,
        headline: str,
        caption: str,
        brand_kit_opus: dict,
        copy_agent=None,
        brief=None,
    ) -> tuple[dict, ToneResult]:
        """
        Valida e riprova fino a MAX_RETRIES se il copy fallisce.
        Se copy_agent e brief sono passati, usa il CopyAgent per correggere.
        Restituisce (copy_final, tone_result_final).
        """
        copy = {"headline": headline, "caption": caption}
        result = self.validate(headline, caption, brand_kit_opus)

        if result["passed"] or copy_agent is None or brief is None:
            return copy, result

        for attempt in range(self.MAX_RETRIES):
            correction = result.get("correction_prompt", "")
            if not correction:
                break

            print(f"   🔄 ToneValidator: retry {attempt + 1}/{self.MAX_RETRIES} — {result['violations']}")
            copy = copy_agent.run(brief, extra_context=f"CORRECCIONES REQUERIDAS:\n{correction}")
            result = self.validate(copy["headline"], copy["caption"], brand_kit_opus)

            if result["passed"]:
                print(f"   ✅ ToneValidator: copy corregido en intento {attempt + 1}")
                break

        return copy, result

    def _parse(self, raw: str) -> ToneResult:
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return ToneResult(
                passed=True,
                score=0.5,
                violations=[],
                correction_prompt="",
            )

        return ToneResult(
            passed=bool(data.get("passed", True)),
            score=float(data.get("score", 0.5)),
            violations=data.get("violations", []),
            correction_prompt=data.get("correction_prompt", ""),
        )
