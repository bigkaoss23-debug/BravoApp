"""
Content Store — CRUD per la tabella generated_content (post v2).
Una riga = un post generato dalla pipeline v2.
"""
from __future__ import annotations

import uuid
from typing import Optional

from tools.supabase_client import get_client

TABLE = "generated_content"


def save_generated_post(
    *,
    client_id: str,
    headline: str,
    caption: str,
    pillar: str,
    format: str,
    content_type: str,
    layout_variant: str,
    image_url: str,
    plan_slot_id: Optional[str] = None,
    brief: str = "",
    hashtags: Optional[list] = None,
    generated_by: str = "pipeline_v2",
    status: str = "draft",
) -> Optional[dict]:
    """
    Salva il post generato in generated_content.
    Se plan_slot_id è passato, aggiorna anche editorial_plans → status='generated'.
    Ritorna il record inserito o None se Supabase non è disponibile.
    """
    sb = get_client()
    if sb is None:
        print("   ⚠️  save_generated_post: Supabase non disponibile")
        return None

    content_id = str(uuid.uuid4())
    agent_notes = ""
    if hashtags:
        agent_notes = "hashtags: " + ", ".join(hashtags)

    row = {
        "content_id": content_id,
        "client_id": client_id,
        "brief": brief,
        "platform": "instagram",
        "pillar": pillar,
        "format": format,
        "content_type": content_type,
        "headline": headline,
        "caption": caption,
        "layout_variant": layout_variant,
        "agent_notes": agent_notes,
        "media_id": image_url,        # URL dell'immagine renderizzata
        "generated_by": generated_by,
        "status": status,
        "plan_id": plan_slot_id,
    }

    try:
        resp = sb.table(TABLE).insert(row).execute()
        inserted = resp.data[0] if resp.data else row
        print(f"   ✓ generated_content insert (content_id={content_id[:8]})")
    except Exception as e:
        print(f"   ⚠️  generated_content insert fallito: {e}")
        return None

    # Aggiorna lo slot del piano editoriale (se passato)
    if plan_slot_id:
        try:
            sb.table("editorial_plans").update({
                "status": "generated",
                "content_id": content_id,
            }).eq("id", plan_slot_id).execute()
            print(f"   ✓ editorial_plans slot {plan_slot_id[:8]} → generated")
        except Exception as e:
            print(f"   ⚠️  editorial_plans update fallito: {e}")

    return inserted


def find_plan_slot_id(
    client_id: str,
    scheduled_date: str,
    pillar: str,
    angle: str,
    format: str,
) -> Optional[str]:
    """
    Cerca lo slot del piano editoriale che corrisponde ai parametri dati.
    Ritorna l'id (uuid) o None.
    """
    sb = get_client()
    if sb is None:
        return None
    try:
        resp = (
            sb.table("editorial_plans")
            .select("id")
            .eq("client_id", client_id)
            .eq("scheduled_date", scheduled_date)
            .eq("pillar", pillar)
            .eq("angle", angle)
            .eq("format", format)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0].get("id")
    except Exception as e:
        print(f"   ⚠️  find_plan_slot_id fallito: {e}")
    return None
