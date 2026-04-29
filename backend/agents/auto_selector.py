"""
AutoSelector — sceglie la variante migliore tra N generate.

Usa Claude Haiku (veloce + economico) per valutare ogni variante
in base a: coerenza con il pillar, qualità headline, forza del CTA,
allineamento al tone of voice del brand kit.

Ritorna:
  {
    "best_variant": dict,      # la variante scelta (incluso content_id)
    "score":        float,     # 0.0–1.0
    "reasoning":    str,       # perché è stata scelta
    "needs_review": bool,      # True se score < REVIEW_THRESHOLD
  }

Se Haiku fallisce, sceglie la prima variante con score=0.5.
"""

import json
import os
from typing import Optional

REVIEW_THRESHOLD = 0.65  # sotto questa soglia → escalation a Bravo


class AutoSelector:
    def __init__(self, anthropic_key: Optional[str] = None):
        self._key = anthropic_key or os.getenv("ANTHROPIC_API_KEY", "")

    def select_best(
        self,
        variants: list[dict],
        brand_kit: dict,
        plan: dict,
    ) -> dict:
        """
        Valuta le varianti e sceglie la migliore.

        variants  → lista di dict con almeno: idx, headline, caption, pillar, agent_notes
        brand_kit → brand kit completo del cliente (per tone_of_voice, pillars)
        plan      → riga editorial_plans (per pillar, angle, brief)
        """
        if not variants:
            return {"best_variant": {}, "score": 0.0, "reasoning": "nessuna variante", "needs_review": True}

        if len(variants) == 1:
            return {"best_variant": variants[0], "score": 0.75, "reasoning": "unica variante disponibile", "needs_review": False}

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self._key)

            opus = brand_kit.get("brand_kit_opus") or {}
            tone = opus.get("tone_of_voice") or brand_kit.get("tone_of_voice") or "Profesional, cercano"
            target_pillar = plan.get("pillar", "")
            angle = plan.get("angle", "")

            variants_text = "\n\n".join(
                f"VARIANTE {v.get('idx', i)+1}:\n"
                f"  Headline: {v.get('headline', '')}\n"
                f"  Caption:  {(v.get('caption', '') or '')[:300]}\n"
                f"  Pillar:   {v.get('pillar', '')}\n"
                f"  Layout:   {v.get('layout_variant', '')}"
                for i, v in enumerate(variants)
            )

            prompt = f"""Eres el director creativo de BRAVO!COMUNICA. Evalúa estas variantes de post y elige la mejor.

CONTEXTO DEL POST:
- Pilar objetivo: {target_pillar}
- Ángulo narrativo: {angle}
- Tono de voz del brand: {tone}

VARIANTES:
{variants_text}

Evalúa según estos criterios (0-10 cada uno):
1. Coherencia con el pilar y ángulo pedido
2. Fuerza del headline (impacto, claridad, memorabilidad)
3. Calidad del CTA en la caption
4. Alineación con el tono de voz

Responde SOLO con este JSON (sin texto fuera):
{{
  "best_idx": <número de variante elegida, empezando por 1>,
  "score": <promedio ponderado 0.0-1.0>,
  "reasoning": "<1-2 frases explicando por qué es la mejor>"
}}"""

            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text.strip()
            if "```" in raw:
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:].strip()

            data = json.loads(raw)
            best_idx_1based = int(data.get("best_idx", 1))
            score = float(data.get("score", 0.5))
            reasoning = data.get("reasoning", "")

            # Cerca la variante con idx == best_idx_1based - 1 (0-based)
            best = next(
                (v for v in variants if v.get("idx") == best_idx_1based - 1),
                variants[0],
            )

            return {
                "best_variant": best,
                "score":        score,
                "reasoning":    reasoning,
                "needs_review": score < REVIEW_THRESHOLD,
            }

        except Exception as e:
            # Fallback: prima variante, score neutro
            return {
                "best_variant": variants[0],
                "score":        0.5,
                "reasoning":    f"fallback automatico (errore Haiku: {e})",
                "needs_review": True,
            }
