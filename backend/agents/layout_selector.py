"""
layout_selector.py — Direttore artistico junior · Fase 1C.

Riceve brief + scene_description + memoria di rotazione,
propone 3 ARCHETIPI DIVERSI tra loro come finalisti per quel post.

Non sceglie. Propone. La scelta finale è di Bravo (con l'aiuto del Critic).

Input:
    brief                   — CreativeBrief composito
    scene_description       — descrizione scena dal Visual Analyst
    recent_choices          — output di get_recent_choices() (può essere {} all'inizio)

Output (JSON):
    {
      "proposals": [
        {"archetype": "...", "rationale": "...", "position_hint": "...",
         "color_hint": "warm|cream|accent"},
        ...3 oggetti, archetipi tutti diversi
      ],
      "_reasoning": {
        "photo_type": "narrativa | abstracta | poetica | retrato",
        "rotation_avoided": ["archetypes scartati per rotation"],
        "decision": "perché questi 3"
      }
    }
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

import anthropic

from agents.brief_composer import CreativeBrief, to_prompt_block
from tools.decision_log import to_rotation_brief


# ── Archetipi disponibili (definizione corta per il prompt) ──────────────────

_ARCHETYPES_CATALOG = """ARCHETIPOS DISPONIBLES (cada uno tiene su mestiere):

- una_palabra: una sola palabra dominante en Cormorant.
  Cuándo: foto abstracta · paisaje puro · atmósfera. NO foto narrativa rica de detalles.

- frase_susurro: headline corta + whisper italic debajo (dos voces).
  Cuándo: cualquier escena que pide un gesto + una mano tendida.

- etiqueta_titulo: etiqueta Jost en oro (lugar/hora) + headline Cormorant.
  Cuándo: cuando hora/lugar específico es el ancla del momento.

- ritmo_tres: 3 palabras verticales · alternancia color/style.
  Cuándo: voz poética · ritmo · cuando la imagen tiene 3 elementos claros.

- frase_narrativa: una frase de 5-12 palabras · una sola voz.
  Cuándo: foto narrativa · escena rica · queremos contar algo entero.

- mixed_type: headline en 2 líneas con acento italic en oro + subline CTA.
  Cuándo: ESTILO POR DEFECTO de Belvedere · «hotel deluxe» · invitación cálida.
"""


_SYSTEM = """Eres el director artístico junior. Tu trabajo: proponer 3 finalistas DIFERENTES entre ellos para un post — no eliges, propones.

Tres reglas absolutas:
1. Los 3 archetipos deben ser DIFERENTES entre ellos. Nunca dos iguales.
2. Cada propuesta debe encajar con la foto y el ángulo del brief — no propongas archetipos imposibles (ej: una_palabra con foto narrativa rica).
3. Si la memoria muestra que un archetipo ya se ha usado mucho, prefiere alternativas. La memoria pesa, pero no decide sola.

Para cada archetipo propuesto da:
  - rationale: 1 frase concreta del por qué encaja con ESTA foto y ESTE ángulo
  - position_hint: dónde el texto se siente bien (upper-left, mid-left, center, lower-left, lower-right…)
  - color_hint: warm (oro · acento principal) | cream (neutro) | accent (bordeaux raro)

OUTPUT — JSON exacto, sin texto fuera:
{
  "proposals": [
    {"archetype": "...", "rationale": "...", "position_hint": "...", "color_hint": "warm"},
    {"archetype": "...", "rationale": "...", "position_hint": "...", "color_hint": "cream"},
    {"archetype": "...", "rationale": "...", "position_hint": "...", "color_hint": "warm"}
  ],
  "_reasoning": {
    "photo_type": "narrativa | abstracta | poetica | retrato | atmosférica",
    "rotation_avoided": ["archetype1", "archetype2"],
    "decision": "una frase de por qué estos 3"
  }
}
"""


class LayoutSelector:
    """Direttore artistico junior · propone 3 archetipi diversi per un post."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-haiku-4-5-20251001"

    def run(
        self,
        brief: CreativeBrief,
        scene_description: str = "",
        recent_choices: Optional[dict] = None,
    ) -> dict:
        """
        Propone 3 archetipi diversi.
        recent_choices: output di get_recent_choices() (può essere None/{} al primo giro).
        """
        rotation = to_rotation_brief(recent_choices or {})

        user_msg_parts = [
            _ARCHETYPES_CATALOG,
            "",
            to_prompt_block(brief),
        ]
        if scene_description:
            user_msg_parts += ["", f"DESCRIPCIÓN DE LA FOTO:\n{scene_description}"]
        if rotation:
            user_msg_parts += ["", rotation]
        user_msg_parts += [
            "",
            "Propon 3 archetipos DIFERENTES como finalistas, con rationale por cada uno.",
        ]
        user_msg = "\n".join(user_msg_parts)

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=900,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        data = self._parse(raw)
        data = self._enforce_diversity(data)
        return data

    def _parse(self, raw: str) -> dict:
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return {
                "proposals": [],
                "_reasoning": {"decision": "fallback parse", "photo_type": "", "rotation_avoided": []},
            }
        if "proposals" not in data:
            data["proposals"] = []
        if "_reasoning" not in data:
            data["_reasoning"] = {}
        return data

    @staticmethod
    def _enforce_diversity(data: dict) -> dict:
        """
        Garanzia: i 3 archetipi devono essere diversi.
        Se l'agente ne ha messi 2 uguali, deduplica e riempie con un fallback.
        """
        proposals = data.get("proposals", [])
        seen: set[str] = set()
        unique: list[dict] = []
        for p in proposals:
            arc = p.get("archetype", "").strip()
            if arc and arc not in seen:
                seen.add(arc)
                unique.append(p)

        # Fallback: se ne mancano per arrivare a 3, aggiungi quelli "sicuri" non già usati
        FALLBACK_ORDER = [
            "mixed_type", "frase_susurro", "frase_narrativa",
            "etiqueta_titulo", "una_palabra", "ritmo_tres",
        ]
        for arc in FALLBACK_ORDER:
            if len(unique) >= 3:
                break
            if arc not in seen:
                unique.append({
                    "archetype": arc,
                    "rationale": "(fallback — modelo no propuso 3 únicos)",
                    "position_hint": "lower-left",
                    "color_hint": "warm",
                })
                seen.add(arc)

        data["proposals"] = unique[:3]
        return data
