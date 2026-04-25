"""
briefing_analyzer.py — Analisi completa del briefing cliente con Claude Opus.

Opus legge il briefing integrale e produce UN UNICO output strutturato che
popola tutte le tabelle client_brand, client_profile e client_projects
in un solo passaggio.

Viene chiamato in background ogni volta che viene salvato un briefing.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from typing import Optional

import anthropic

from tools.supabase_client import get_client


_ANALYZER_SYSTEM = """Eres el analista estratégico de Studio Bravo, una agencia de marketing.

Tu tarea: leer un briefing completo de cliente y extraer TODA la información estratégica en un JSON estructurado.
Este JSON será la fuente de verdad para todos los agentes AI que trabajarán con este cliente.

Sé profundo, creativo y estratégico. Usa siempre el idioma del briefing.

Responde SOLO con el JSON válido, sin texto antes ni después, sin markdown fences.

ESTRUCTURA DEL JSON:

{
  "brand": {
    "briefing_distilled": "Ficha compacta de 1.500-1.800 caracteres con: sector, ubicación, descripción, posicionamiento, eslogan, activos únicos, personas objetivo (max 3), objetivos del año, competidor principal, voz de marca, reglas de contenido. Esta ficha la usan los agentes AI semanalmente.",
    "tone_of_voice": "2-3 párrafos describiendo la voz de marca: qué transmite, cómo suena, ejemplos de tono correcto e incorrecto. Máx 400 caracteres.",
    "pillars": [
      {
        "name": "Nombre del pilar",
        "description": "Qué temas cubre y por qué importa",
        "percentage": 30,
        "examples": ["Ejemplo de post 1", "Ejemplo de post 2"]
      }
    ],
    "content_types": [
      {
        "name": "Nombre del tipo de contenido",
        "when_to_use": "Cuándo y por qué usar este formato",
        "tone": "Tono específico para este tipo",
        "example_headline": "EJEMPLO DE TITULAR EN MAYÚSCULAS"
      }
    ]
  },
  "profile": {
    "team_bravo": [
      {"name": "Nombre", "role": "Rol en el proyecto", "detail": "Responsabilidades concretas"}
    ],
    "key_contacts": [
      {"name": "Nombre", "role": "Cargo en la empresa cliente", "description": "Quién es y qué decide"}
    ],
    "history": "Narrativa del histórico del cliente y del trabajo realizado. Máx 400 palabras.",
    "objectives": [
      "Objetivo concreto y medible 1",
      "Objetivo concreto y medible 2"
    ],
    "strategy": "Texto de la estrategia editorial y de comunicación. Máx 400 palabras.",
    "editorial_pillars": [
      {"name": "Nombre", "description": "Descripción", "percentage": 30}
    ],
    "scope": [
      "Qué hace Studio Bravo para este cliente — punto 1"
    ],
    "out_of_scope": [
      "Qué NO hace Studio Bravo — punto 1"
    ],
    "partners": [
      {"name": "Nombre partner", "category": "Categoría", "description": "Relación con el cliente"}
    ]
  },
  "projects": [
    {
      "title": "Título corto (máx 6 palabras)",
      "category": "CONTENIDO|PUBLICIDAD|ALIANZAS|SEO_LOCAL|CONVERSION|CAMPANA",
      "priority": "alta|media|baja",
      "description": "Descripción concreta en 2-3 líneas. Qué hacer y por qué.",
      "deliverable": "Qué se entrega concretamente (1 línea)",
      "month_target": "Inmediato|Mes 5|Mes 6|Mes 7|Mes 8|Mes 9|Mes 10|Mes 11|Mes 12",
      "why": "Referencia directa al briefing que justifica este proyecto (1 línea)"
    }
  ]
}

REGLAS:
- Genera entre 12 y 18 proyectos, ordenados por impacto
- Usa nombres reales del briefing (marcas, personas, plataformas)
- Los pilares deben sumar 100% en porcentaje
- El briefing_distilled debe ser autocontenido: un agente que solo lee ese campo puede trabajar con el cliente
- Si falta información para un campo, omite el campo (no pongas null ni string vacío)"""


def analyze(briefing_text: str, client_name: str = "") -> dict:
    """
    Chiama Claude Opus per analizzare il briefing completo.
    Restituisce il JSON strutturato con brand, profile e projects.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY non configurata")

    claude = anthropic.Anthropic(api_key=api_key)

    user_msg = (
        f"BRIEFING COMPLETO DEL CLIENTE{' (' + client_name + ')' if client_name else ''}:\n\n"
        f"{briefing_text}"
    )

    response = claude.messages.create(
        model="claude-opus-4-7",
        max_tokens=8000,
        system=_ANALYZER_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()

    # Rimuovi eventuali markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw)


def save_to_supabase(client_id: str, data: dict) -> bool:
    """
    Salva i risultati dell'analisi di Opus in client_brand, client_profile e client_projects.
    """
    sb = get_client()
    if sb is None:
        return False

    brand  = data.get("brand", {})
    profile = data.get("profile", {})
    projects = data.get("projects", [])

    try:
        # ── 1. client_brand ──────────────────────────────────────────────────
        res = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_id).limit(1).execute()
        existing_opus = {}
        if res.data:
            existing_opus = res.data[0].get("brand_kit_opus") or {}

        # Aggiorna brand_kit_opus preservando campi esistenti non toccati da Opus
        new_opus = {**existing_opus}
        if brand.get("briefing_distilled"):
            new_opus["briefing_distilled"] = brand["briefing_distilled"]

        update_brand: dict = {"brand_kit_opus": new_opus, "updated_at": "now()"}
        if brand.get("tone_of_voice"):
            update_brand["tone_of_voice"] = brand["tone_of_voice"]
        if brand.get("pillars"):
            update_brand["pillars"] = brand["pillars"]
        if brand.get("content_types"):
            update_brand["content_types"] = brand["content_types"]

        if res.data:
            sb.table("client_brand").update(update_brand).eq("client_id", client_id).execute()
        else:
            update_brand["client_id"] = client_id
            sb.table("client_brand").insert(update_brand).execute()

        print(f"✅ briefing_analyzer: client_brand aggiornato per {client_id}")

        # ── 2. client_profile ────────────────────────────────────────────────
        if profile:
            profile_row = {"client_id": client_id, "updated_at": "now()", **{
                k: v for k, v in profile.items() if v
            }}
            sb.table("client_profile").upsert(profile_row, on_conflict="client_id").execute()
            print(f"✅ briefing_analyzer: client_profile aggiornato per {client_id}")

        # ── 3. client_projects ───────────────────────────────────────────────
        if projects:
            # Cancella solo i progetti proposti precedenti (preserva approvati/rifiutati)
            sb.table("client_projects").delete().eq("client_id", client_id).eq("status", "propuesto").execute()

            rows = []
            for p in projects:
                if not p.get("title"):
                    continue
                rows.append({
                    "id": str(uuid.uuid4()),
                    "client_id": client_id,
                    "title": p.get("title", ""),
                    "category": p.get("category", "CONTENIDO"),
                    "priority": p.get("priority", "media"),
                    "description": p.get("description", ""),
                    "deliverable": p.get("deliverable", ""),
                    "month_target": p.get("month_target", ""),
                    "why": p.get("why", ""),
                    "status": "propuesto",
                    "source": "opus_briefing_analysis",
                })
            if rows:
                sb.table("client_projects").insert(rows).execute()
            print(f"✅ briefing_analyzer: {len(rows)} proyectos salvati per {client_id}")

        return True

    except Exception as e:
        print(f"❌ briefing_analyzer: errore salvataggio per {client_id}: {e}")
        return False


def run_for_client(client_id: str, briefing_text: str, client_name: str = "") -> bool:
    """
    Entry point principale: analizza e salva per un singolo cliente.
    Pensato per essere chiamato in background (BackgroundTasks di FastAPI).
    """
    if not briefing_text or len(briefing_text.strip()) < 100:
        print(f"⚠️  briefing_analyzer: briefing troppo corto per {client_id} — salto")
        return False

    print(f"🧠 briefing_analyzer: Opus analizza il briefing di {client_name or client_id}...")

    try:
        data = analyze(briefing_text, client_name)
        ok = save_to_supabase(client_id, data)
        if ok:
            print(f"🎉 briefing_analyzer: analisi completata per {client_name or client_id}")
        return ok
    except json.JSONDecodeError as e:
        print(f"❌ briefing_analyzer: JSON non valido per {client_id}: {e}")
        return False
    except Exception as e:
        print(f"❌ briefing_analyzer: analisi fallita per {client_id}: {e}")
        return False
