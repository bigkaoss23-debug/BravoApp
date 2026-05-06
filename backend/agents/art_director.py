"""
art_director.py — A7 Art Director (Haiku).

Decide composizione visiva: layout, filtro foto, visual_prompt.
Input: CreativeBrief + copy (headline + caption) già scritti dal CopyAgent.
Output: {layout_variant, visual_prompt, content_type, format, photo_filter_applied}
"""

from __future__ import annotations

import json
import os
import re

import anthropic

from agents.brief_composer import CreativeBrief


_SYSTEM = """Eres el Art Director AI de Studio Bravo. Tu único trabajo es decidir la composición visual de un post ya redactado.

INPUT: brief del post + copy (headline, caption) + specs del filtro fotográfico.
OUTPUT JSON exacto:
{
  "layout_variant": "<bottom-left|bottom-right|bottom-full|top-left|top-right|center|centered-header|centered-with-logo|asymmetric-left|asymmetric-right>",
  "content_type": "<Detalle|Testimonio|Territorio|Temporada|Rutina|Contraste>",
  "format": "<Post 1:1|Story 9:16|Portada Reel>",
  "visual_prompt": "<descripción en inglés de la fotografía ideal, máx 40 palabras, NUNCA texto o logos en la imagen>",
  "photo_filter_applied": {
    "temperature": "warm +10 | cool +5 | neutro",
    "saturation": "+15 | -10 | neutro",
    "contrast": "alto | medio | bajo",
    "vignette": false,
    "special": "instrucción extra si aplica"
  },
  "reasoning": "<1 línea: por qué este layout con este copy>"
}

REGLAS layout:
- bottom-left/right: sujeto a un lado, zona opuesta limpia para el texto
- bottom-full: zona inferior amplia y oscura — texto centrado ancho completo
- top-left/right: sujeto en la mitad inferior — zona superior limpia
- center: fondo con bokeh fuerte o sujeto difuminado — texto dominante
- centered-header: logo arriba + headline dominante — portadas y reels
- asymmetric-left/right: bloque texto en columna 40% — equipo, testimonios

Responde SOLO JSON, sin texto adicional."""


_VALID_LAYOUTS = {
    "bottom-left", "bottom-right", "bottom-full",
    "top-left", "top-right", "center",
    "centered-header", "centered-with-logo",
    "asymmetric-left", "asymmetric-right",
}


class ArtDirector:
    """A7 — Decide layout, filtro e visual_prompt per un post."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-haiku-4-5-20251001"

    def run(
        self,
        brief: CreativeBrief,
        headline: str,
        caption: str,
        scene_description: str = "",
    ) -> dict:
        """
        Decide composizione visiva per il post.
        scene_description: output del PhotoAnalyzer (opzionale).
        """
        filter_spec = brief.get("photo_filter", {})
        filter_str = " | ".join(f"{k}: {v}" for k, v in filter_spec.items() if v)
        layouts_str = ", ".join(brief.get("layout_preference", [])) or "libero"
        mood_str = ", ".join(brief.get("mood_keywords", []))

        user_msg = f"""BRIEF:
Pilar: {brief['pillar']} | Ángulo: {brief['angle']} | Persona: {brief['persona']}
Mood: {mood_str}
Formato: {brief['format']} | Canal: {brief['platform']}
Layout preferidos por el brand kit: {layouts_str}

COPY GENERADO:
Headline: {headline}
Caption: {caption[:200]}

SPECS FILTRO FOTOGRÁFICO:
{filter_str or 'neutro'}
Acento de color: {brief.get('accent_variant', '')}

{f'ESCENA DETECTADA (foto cargada):{chr(10)}{scene_description}' if scene_description else ''}

Decide el layout y el tratamiento visual óptimo."""

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=600,
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
            data = {}

        # Valida layout
        layout = data.get("layout_variant", "")
        if layout not in _VALID_LAYOUTS:
            preferred = brief.get("layout_preference", [])
            layout = preferred[0] if preferred else "bottom-full"
            data["layout_variant"] = layout

        # Fallback photo_filter
        if not data.get("photo_filter_applied"):
            data["photo_filter_applied"] = brief.get("photo_filter", {})

        # Fallback format
        if not data.get("format"):
            data["format"] = brief.get("format", "Post 1:1")

        return data
