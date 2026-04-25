"""
briefing_distiller.py — Distillazione automatica del briefing cliente.

Prende il testo integrale del briefing (anche 15.000+ caratteri) e produce
una versione compatta (~1.500-1.800 caratteri / ~400 token) con solo le
informazioni che gli agenti AI usano ogni settimana.

Viene chiamato in background ogni volta che viene salvato un briefing.
"""

from __future__ import annotations

import os
from typing import Optional

import anthropic

from tools.supabase_client import get_client


_DISTILL_SYSTEM = """Eres un asistente especializado en sintetizar briefings de clientes para agencias de marketing.

Tu tarea: transformar un briefing completo en una ficha de referencia compacta para agentes AI.
La ficha debe tener máximo 1.800 caracteres. Usa siempre el idioma del briefing (si está en español, responde en español).

ESTRUCTURA OBLIGATORIA (usa exactamente estas secciones, omite las que no haya datos):

=== BRIEFING DISTILLADO — [NOMBRE CLIENTE] ===
Sector: [sector/industria]
Ubicación: [ciudad, país]
Descripción: [1-2 líneas sobre quién es y qué hace]
Posicionamiento: [segmento de mercado, precio medio si relevante, diferencial clave]
Eslogan: "[eslogan si existe]"
Activos únicos: [2-4 puntos clave que los diferencia de la competencia]

PERSONAS OBJETIVO:
[lista numerada, máx 3 personas — nombre, edad, motivación principal, canal clave]

OBJETIVOS [AÑO]: [2-4 objetivos concretos y medibles]

COMPETIDOR A VIGILAR: [el más relevante y por qué]

VOZ DE MARCA: [2-3 adjetivos. Ejemplo correcto e incorrecto de tono]
Nunca: [qué tono/palabras evitar siempre]

REGLAS CONTENIDO: [caption length, primera línea, CTA, elementos obligatorios por post]
Idioma principal: [idioma del contenido]
=== FIN BRIEFING DISTILLADO ===

REGLAS:
- Máximo 1.800 caracteres totales, incluyendo cabecera y cierre
- Solo información que un agente AI necesita para crear contenido semanal
- No incluyas presupuestos, cronogramas, contactos, datos internos de agencia
- Si falta información para una sección, omite la sección completamente
- Responde SOLO con la ficha, sin texto antes ni después"""


def distill(briefing_text: str, client_name: str = "") -> str:
    """
    Chiama Claude Haiku per distillare il briefing.
    Restituisce il testo distillato (~1.500-1.800 char).
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY non configurata")

    claude = anthropic.Anthropic(api_key=api_key)

    user_msg = f"BRIEFING COMPLETO DEL CLIENTE{' (' + client_name + ')' if client_name else ''}:\n\n{briefing_text}"

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system=_DISTILL_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    return response.content[0].text.strip()


def save_distilled_to_brand_kit(client_id: str, distilled_text: str) -> bool:
    """
    Salva il testo distillato in brand_kit_opus.briefing_distilled.
    Se il cliente non ha ancora un record in client_brand, non fa nulla e restituisce False.
    """
    sb = get_client()
    if sb is None:
        return False

    try:
        # Legge il brand_kit_opus attuale
        res = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_id).limit(1).execute()
        if not res.data:
            print(f"⚠️  briefing_distiller: nessun record client_brand per {client_id} — salto")
            return False

        opus = res.data[0].get("brand_kit_opus") or {}
        opus["briefing_distilled"] = distilled_text

        sb.table("client_brand").update({"brand_kit_opus": opus}).eq("client_id", client_id).execute()
        print(f"✅ briefing_distiller: distillato salvato per {client_id} ({len(distilled_text)} chars)")
        return True

    except Exception as e:
        print(f"❌ briefing_distiller: errore salvataggio per {client_id}: {e}")
        return False


def run_for_client(client_id: str, briefing_text: str, client_name: str = "") -> bool:
    """
    Entry point principale: distilla e salva per un singolo cliente.
    Pensato per essere chiamato in background (BackgroundTasks di FastAPI).
    """
    if not briefing_text or len(briefing_text.strip()) < 100:
        print(f"⚠️  briefing_distiller: briefing troppo corto per {client_id} — salto")
        return False

    print(f"🔬 briefing_distiller: distillazione in corso per {client_name or client_id}...")
    try:
        distilled = distill(briefing_text, client_name)
        return save_distilled_to_brand_kit(client_id, distilled)
    except Exception as e:
        print(f"❌ briefing_distiller: distillazione fallita per {client_id}: {e}")
        return False


def run_migration_all_clients() -> dict:
    """
    Migrazione: itera su tutti i clienti che hanno un briefing ma non hanno
    ancora briefing_distilled nel brand_kit_opus. Da chiamare una volta sola
    tramite l'endpoint /api/briefing/distill-all.
    """
    sb = get_client()
    if sb is None:
        return {"error": "Supabase non disponibile"}

    results = {"processed": 0, "skipped": 0, "failed": 0, "clients": []}

    try:
        # Prende tutti i clienti con briefing
        briefings = sb.table("client_briefings").select("client_id,briefing_text").execute().data or []
        # Prende tutti i brand kit
        brand_kits = sb.table("client_brand").select("client_id,brand_kit_opus").execute().data or []
        bk_map = {row["client_id"]: row.get("brand_kit_opus") or {} for row in brand_kits}
        # Prende nomi clienti
        clients = sb.table("clients").select("id,name").execute().data or []
        name_map = {c["id"]: c["name"] for c in clients}

    except Exception as e:
        return {"error": f"Errore lettura DB: {e}"}

    for row in briefings:
        cid = row["client_id"]
        text = row.get("briefing_text") or ""
        name = name_map.get(cid, cid)
        opus = bk_map.get(cid, {})

        # Salta se ha già il distillato
        if opus.get("briefing_distilled"):
            print(f"♻️  {name}: già distillato — salto")
            results["skipped"] += 1
            results["clients"].append({"client": name, "status": "skipped"})
            continue

        # Salta se non ha un brand kit (non può salvare)
        if cid not in bk_map:
            print(f"⚠️  {name}: nessun brand kit — salto")
            results["skipped"] += 1
            results["clients"].append({"client": name, "status": "no_brand_kit"})
            continue

        ok = run_for_client(cid, text, name)
        if ok:
            results["processed"] += 1
            results["clients"].append({"client": name, "status": "ok"})
        else:
            results["failed"] += 1
            results["clients"].append({"client": name, "status": "failed"})

    return results
