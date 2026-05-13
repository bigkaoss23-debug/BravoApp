"""
project_extractor.py — Step 4 della dependency chain.

Legge le sezioni canoniche del briefing (Step 1) e produce la lista dei
PROGETTI che lo Studio Bravo deve eseguire per quel cliente.

Principio cardine:
  ESTRAE — NON INTERPRETA — NON DISTILLA.
  Ogni progetto deve avere una `source_quote`: la frase letterale dello SCOPE
  (sez. 02) che giustifica la creazione del progetto. Se non c'è frase nello
  SCOPE, NON si crea il progetto.

Output: array di {type, title, description, frequency, volume, macro_agents,
source_quote}. Pronto per l'inserimento in client_projects.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

import anthropic


# ── Mappa universale tipo lavoro → macro-agente ─────────────────────────────
#
# Coerente con quanto definito in Supabase (tabella `agents` slug):
# contenido · resenas · calendario · analisis · estrategia
#
# Ogni "tipo lavoro" (project_type) si mappa a 1 macro-agente primario
# + eventuali co-agenti che intervengono.

_PROJECT_TYPES_MAP = """TIPOS DE PROYECTO POSIBLES — cada uno tiene su agente macro responsable:

contenidos_feed       — Posts de feed mensuales (foto + caption + diseño).
                        Responsable: contenido. Co-agentes: calendario.

contenidos_stories    — Stories mensuales (más simples que feed).
                        Responsable: contenido.

voz_huesped           — Reseñas reales convertidas en piezas editoriales.
                        Responsable: resenas. Co-agentes: contenido.

ugc_curacion          — Curación mensual de contenido generado por usuarios.
                        Responsable: resenas.

reporte_kpi           — Lectura mensual de métricas IG vs objetivos.
                        Responsable: analisis.

planificacion         — Distribución mensual de contenidos sobre el calendario.
                        Responsable: calendario.

analisis_mercado      — Monitoreo de competidores, contexto de sector.
                        Responsable: analisis.

estrategia            — Revisión semestral/anual de posicionamiento, ajustes.
                        Responsable: estrategia.
"""


_SYSTEM = """Eres un extractor determinístico. Tu única tarea: leer las secciones canónicas
del briefing y producir la lista de PROYECTOS que Studio Bravo debe ejecutar.

REGLAS ABSOLUTAS — sin excepciones:

1. SOLO LEE LO QUE ESTÁ ESCRITO. No interpretes. No infieras. No completes
   con conocimiento general. Si no está en el briefing, no existe.

2. La sección "02. ALCANCE DEL PROYECTO" (SCOPE) es la fuente de verdad
   sobre QUÉ proyectos crear. Si el SCOPE menciona "8 posts de feed por mes",
   crea UN proyecto contenidos_feed con volume=8. Si NO menciona algo, NO
   crees el proyecto.

3. Cada proyecto DEBE incluir `source_quote`: la frase EXACTA del briefing
   (palabra por palabra, sin modificar) que justifica la creación. Si no
   puedes citar una frase literal del briefing para justificar el proyecto,
   NO lo crees.

4. Las exclusiones explícitas del SCOPE ("No incluido: Reels, TikTok…") deben
   respetarse. NUNCA crear un proyecto sobre algo excluido.

5. Para `volume`: extrae el número exacto del SCOPE ("8 posts" → 8).
   Si no hay número, usa null.

6. Para `frequency`: extrae del briefing ("por mes" → "monthly", "trimestral"
   → "quarterly", etc.). Si no hay frecuencia explícita, usa "monthly" como
   default razonable solo para tipos contenidos_*.

7. `macro_agents` debe ser SOLO de la lista permitida:
   ['contenido', 'resenas', 'calendario', 'analisis', 'estrategia']
   El primer elemento es el responsable. Otros son co-agentes.

OUTPUT — JSON exacto, sin texto fuera:
{
  "projects": [
    {
      "type": "contenidos_feed",
      "title": "...",
      "description": "...",
      "frequency": "monthly|quarterly|annual|adhoc",
      "volume": 8,
      "macro_agents": ["contenido", "calendario"],
      "source_quote": "8 posts de feed en Instagram por mes"
    },
    ...
  ],
  "_reasoning": {
    "scope_summary": "qué dice exactamente el SCOPE",
    "exclusions_respected": ["cosas excluidas del scope que no se crearon"],
    "decision_log": "qué proyectos se crearon y por qué"
  }
}

Si el briefing no permite extraer ningún proyecto (SCOPE vacío o no canónico),
devuelve {"projects": [], "_reasoning": {...explicando por qué...}}."""


_VALID_AGENTS = {"contenido", "resenas", "calendario", "analisis", "estrategia"}
_VALID_TYPES = {
    "contenidos_feed", "contenidos_stories", "voz_huesped", "ugc_curacion",
    "reporte_kpi", "planificacion", "analisis_mercado", "estrategia",
}
_VALID_FREQUENCIES = {"monthly", "quarterly", "annual", "adhoc"}


class ProjectExtractor:
    """Estrattore Haiku — legge briefing canonico, produce lista progetti."""

    def __init__(self) -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-haiku-4-5-20251001"

    def run(self, briefing_sections: dict) -> dict:
        """
        briefing_sections: dict {01..10} con il testo letterale delle 10
        sezioni canoniche (vedi briefing_docx_parser.parse_briefing_docx).

        Ritorna: {projects: [...], _reasoning: {...}}
        """
        # Mandiamo ad Haiku SOLO le sezioni che contano per i progetti:
        # 02 SCOPE (cuore), 05 PILARES, 06 ÁNGULOS, 10 ESTACIONALIDAD.
        # Le altre (01 cliente, 03 identidad, 04 público, 07 mensajes,
        # 08 KPI, 09 mercado) non sono input per "che progetti creare".
        relevant = {
            "02_scope": briefing_sections.get("02", ""),
            "05_pilares": briefing_sections.get("05", ""),
            "06_angulos": briefing_sections.get("06", ""),
            "10_estacionalidad": briefing_sections.get("10", ""),
        }

        if not relevant["02_scope"].strip():
            return {
                "projects": [],
                "_reasoning": {
                    "scope_summary": "",
                    "exclusions_respected": [],
                    "decision_log": "Sez. 02 SCOPE vuota — nessun progetto da estrarre.",
                },
            }

        user_msg = "\n\n".join([
            _PROJECT_TYPES_MAP,
            "─" * 60,
            "BRIEFING — SECCIONES RELEVANTES (literales):",
            "",
            "## 02. ALCANCE DEL PROYECTO (SCOPE)",
            relevant["02_scope"],
            "",
            "## 05. PILARES EDITORIALES",
            relevant["05_pilares"],
            "",
            "## 06. ÁNGULOS NARRATIVOS",
            relevant["06_angulos"],
            "",
            "## 10. ESTACIONALIDAD",
            relevant["10_estacionalidad"],
            "",
            "─" * 60,
            "Extrae los proyectos según las reglas del system prompt. JSON exacto.",
        ])

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=2000,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text.strip()
        # Strip markdown fence se presente
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Output Haiku non JSON valido: {e}\n\n{text[:500]}")

        # Validazione difensiva: scarta progetti malformati
        clean_projects = []
        for p in parsed.get("projects", []):
            if not isinstance(p, dict):
                continue
            ptype = p.get("type")
            if ptype not in _VALID_TYPES:
                continue
            macros = p.get("macro_agents") or []
            macros = [m for m in macros if m in _VALID_AGENTS]
            if not macros:
                continue
            freq = p.get("frequency", "monthly")
            if freq not in _VALID_FREQUENCIES:
                freq = "monthly"
            if not p.get("source_quote"):
                continue  # NO source_quote → NO project (regola 3)
            clean_projects.append({
                "type": ptype,
                "title": str(p.get("title", "")).strip(),
                "description": str(p.get("description", "")).strip(),
                "frequency": freq,
                "volume": p.get("volume"),
                "macro_agents": macros,
                "source_quote": str(p.get("source_quote", "")).strip(),
            })

        return {
            "projects": clean_projects,
            "_reasoning": parsed.get("_reasoning", {}),
        }
