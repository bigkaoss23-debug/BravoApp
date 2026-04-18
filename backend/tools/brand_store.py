"""
brand_store.py — Lettura e scrittura del brand kit per cliente.
Usa Supabase come storage primario; ritorna struttura vuota se non configurato.
"""

import json
from tools.supabase_client import get_client


def get_brand_kit(client_id: str) -> dict:
    """
    Ritorna il brand kit del cliente da Supabase.
    Struttura: { colors: [...], fonts: [...], templates: [...] }
    """
    empty = {"colors": [], "fonts": [], "templates": []}
    db = get_client()
    if not db:
        return empty
    try:
        res = db.table("client_brand").select("*").eq("client_id", client_id).single().execute()
        if res.data:
            return {
                "colors":        res.data.get("colors", []),
                "fonts":         res.data.get("fonts", []),
                "templates":     res.data.get("templates", []),
                "tone_of_voice": res.data.get("tone_of_voice", ""),
                "pillars":       res.data.get("pillars", []),
                "layouts":       res.data.get("layouts", []),
                "notes":         res.data.get("notes", ""),
            }
        return empty
    except Exception as e:
        print(f"⚠️  brand_store.get_brand_kit error: {e}")
        return empty


def save_brand_kit(client_id: str, colors: list, fonts: list, templates: list) -> bool:
    """
    Salva (upsert) il brand kit del cliente su Supabase.
    Ritorna True se salvato, False se errore.
    """
    db = get_client()
    if not db:
        return False
    try:
        db.table("client_brand").upsert({
            "client_id": client_id,
            "colors":    colors,
            "fonts":     fonts,
            "templates": templates,
        }, on_conflict="client_id").execute()
        return True
    except Exception as e:
        print(f"⚠️  brand_store.save_brand_kit error: {e}")
        return False


def build_brand_context(brand_kit: dict) -> str:
    """
    Costruisce il blocco di testo da iniettare nel prompt di Claude
    con le info complete del brand kit del cliente.
    Ritorna stringa vuota se il kit è vuoto.
    """
    parts = []

    if brand_kit.get("colors"):
        color_list = ", ".join(
            f"{c['name']} ({c['hex']}) — {c.get('uso','')}" for c in brand_kit["colors"]
        )
        parts.append(f"COLORI BRAND: {color_list}")

    if brand_kit.get("fonts"):
        font_list = ", ".join(
            f"{f['name']} ({f.get('tipo','')})" for f in brand_kit["fonts"]
        )
        parts.append(f"FONT BRAND: {font_list}")

    if brand_kit.get("tone_of_voice"):
        parts.append(f"TONO DI VOCE: {brand_kit['tone_of_voice']}")

    if brand_kit.get("pillars"):
        pillar_list = ", ".join(
            f"{p['nombre']} {p.get('pct','')}%" for p in brand_kit["pillars"]
        )
        parts.append(f"PILLAR EDITORIALI: {pillar_list}")

    if brand_kit.get("layouts"):
        layout_list = ", ".join(
            f"{l['name']} ({l.get('descripcion','')})" for l in brand_kit["layouts"]
        )
        parts.append(f"LAYOUT PREFERITI: {layout_list}")

    templates = brand_kit.get("templates", [])
    if templates:
        parts.append(
            "TEMPLATE STORY APPROVATI — Ruota tra questi:\n" +
            "\n".join(
                f"  [{i+1}] {t.get('name','?')} — {t.get('descripcion', t.get('analysis',''))}"
                for i, t in enumerate(templates)
            )
        )
        parts.append(
            "REGOLA VARIETÀ: ogni post DEVE usare un layout_variant diverso dagli altri."
        )

    if brand_kit.get("notes"):
        parts.append(f"NOTE BRAND (segui sempre): {brand_kit['notes']}")

    if not parts:
        return ""

    return "\n\n=== BRAND KIT CLIENTE ===\n" + "\n".join(parts) + "\n=== FINE BRAND KIT ==="
