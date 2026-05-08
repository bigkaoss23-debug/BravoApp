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


# ── System prompt per rank_proposals (Critic role · Fase 1C) ─────────────────

_SYSTEM_RANK = """Eres el Senior Critic del estudio. Tu trabajo: evaluar comparativamente N propuestas para un mismo post y ayudar al director (Bravo) a elegir.

NO eliges tú la propuesta final — Bravo elige. Pero ordenas, anotas, y avisas si alguna repite algo que ya se ha publicado.

Recibirás:
  - El tono de voz del brand + un ejemplo concreto correcto
  - Las reglas «no hacer» del brand
  - La memoria de los últimos posts publicados (archetypes, palabras-clave, headlines)
  - N propuestas (cada una con archetype, headline, whisper opcional, caption)

Para cada propuesta da:
  - voice_score (0.0-1.0): qué tan cerca está del tono correcto del brand
  - repetition_risk: «low» | «medium» | «high» — riesgo de repetir lo que ya se publicó
  - comment: 1 frase concreta. Qué funciona, qué falta, o qué memoria recuerda.
  - rank: posición en orden de preferencia (1 = mejor, N = peor)

Reglas de ranking:
  - Una propuesta con repetition_risk «high» debe bajar de rank, aunque el voice_score sea alto
  - Una propuesta con voice_score < 0.6 baja de rank (no respeta la voz)
  - El criterio relativo importa: si dos propuestas son buenas, gana la más diferente de lo que ya hay

OUTPUT — JSON exacto, sin texto fuera:
{
  "rankings": [
    {"index": 1, "voice_score": 0.9, "repetition_risk": "low", "comment": "...", "rank": 1},
    {"index": 2, "voice_score": 0.75, "repetition_risk": "medium", "comment": "...", "rank": 2},
    {"index": 3, "voice_score": 0.85, "repetition_risk": "high", "comment": "...", "rank": 3}
  ]
}

«index» referencia el número de la propuesta (1, 2, 3...). «rank» es la posición de preferencia."""


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

    # ── Critic role (Fase 1C) ──────────────────────────────────────────────
    def rank_proposals(
        self,
        proposals: list[dict],
        brand_kit_opus: dict,
        recent_choices: dict | None = None,
    ) -> list[dict]:
        """
        Riceve N proposte (ognuna con archetype + headline + whisper + caption),
        le confronta tra loro e annota ognuna con:
          - voice_score (0.0-1.0): quanto suona della voce del brand
          - repetition_risk ('low'|'medium'|'high'): rischio di sovrapposizione con post recenti
          - comment: 1 frase concreta del Critic (cosa funziona, cosa stride)
          - rank (1, 2, 3...): posizione preferita dal Critic
        Ritorna la lista riordinata per rank, con i nuovi campi aggiunti.

        Chiamata UNICA all'API: il modello vede tutte le proposte insieme e le confronta.
        """
        if not proposals:
            return []

        identity = brand_kit_opus.get("identity", {})
        tone = (
            identity.get("tone_of_voice", "")
            or brand_kit_opus.get("tone_of_voice", "")
        )
        example_correct = identity.get("example_correct", "")
        rules_dont = (
            identity.get("rules_dont", [])
            or brand_kit_opus.get("rules_dont", [])
        )

        # Memoria
        from tools.decision_log import to_rotation_brief
        rotation = to_rotation_brief(recent_choices or {})

        # Compone le proposte come blocchi numerati per il prompt
        prop_blocks = []
        for i, p in enumerate(proposals, 1):
            block = (
                f"PROPUESTA {i}\n"
                f"  Archetipo:  {p.get('archetype', '')}\n"
                f"  Headline:   {p.get('headline', '')}\n"
            )
            if p.get("whisper"):
                block += f"  Whisper:    {p.get('whisper')}\n"
            if p.get("caption"):
                cap = (p.get("caption") or "")
                block += f"  Caption:    {cap[:300]}\n"
            prop_blocks.append(block)

        user_msg = (
            f"TONO DE VOZ DE LA MARCA:\n{tone[:400]}\n\n"
            + (f"EJEMPLO CORRECTO DE VOZ:\n«{example_correct}»\n\n" if example_correct else "")
            + (f"REGLAS NO HACER:\n{chr(10).join('  ✗ ' + r for r in rules_dont[:6])}\n\n" if rules_dont else "")
            + (f"{rotation}\n\n" if rotation else "")
            + "PROPUESTAS A EVALUAR:\n\n"
            + "\n".join(prop_blocks)
            + "\nEvalúa las propuestas comparándolas. No las trates en aislamiento."
        )

        try:
            response = self.claude.messages.create(
                model=self.model,
                max_tokens=1200,
                system=_SYSTEM_RANK,
                messages=[{"role": "user", "content": user_msg}],
            )
            raw = response.content[0].text.strip()
            ranked = self._parse_rank(raw, len(proposals))
        except Exception as e:
            print(f"   ⚠ rank_proposals fallito: {e}")
            ranked = [
                {"index": i + 1, "voice_score": 0.5, "repetition_risk": "low",
                 "comment": "(critic non disponibile)", "rank": i + 1}
                for i in range(len(proposals))
            ]

        # Compone l'output finale: proposte arricchite + riordinate
        index_to_eval = {r["index"]: r for r in ranked}
        enriched = []
        for i, p in enumerate(proposals, 1):
            ev = index_to_eval.get(i, {
                "voice_score": 0.5, "repetition_risk": "low",
                "comment": "", "rank": i,
            })
            enriched.append({
                **p,
                "critic_voice_score":     ev.get("voice_score", 0.5),
                "critic_repetition_risk": ev.get("repetition_risk", "low"),
                "critic_comment":         ev.get("comment", ""),
                "critic_rank":            ev.get("rank", i),
            })

        # Ordina per rank crescente
        enriched.sort(key=lambda x: x.get("critic_rank", 999))
        return enriched

    def _parse_rank(self, raw: str, n_proposals: int) -> list[dict]:
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
        rankings = data.get("rankings", [])
        out: list[dict] = []
        for r in rankings:
            try:
                out.append({
                    "index":            int(r.get("index", 0)),
                    "voice_score":      float(r.get("voice_score", 0.5)),
                    "repetition_risk":  str(r.get("repetition_risk", "low")),
                    "comment":          str(r.get("comment", "")),
                    "rank":             int(r.get("rank", 999)),
                })
            except (ValueError, TypeError):
                continue
        return out

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
