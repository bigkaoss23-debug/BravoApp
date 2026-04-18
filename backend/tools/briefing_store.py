"""
Briefing Store — CRUD minimale su tabella client_briefings (Supabase).
Un solo record per client_id: ogni save sovrascrive.
"""
from __future__ import annotations

from typing import Optional

from tools.supabase_client import get_client


TABLE = "client_briefings"


def get_briefing(client_id: str) -> Optional[dict]:
    """Restituisce il briefing corrente del cliente, o None."""
    sb = get_client()
    if sb is None:
        return None
    resp = (
        sb.table(TABLE)
        .select("*")
        .eq("client_id", client_id)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


def save_briefing(
    client_id: str,
    briefing_text: str,
    source: str = "manual",
    source_filename: Optional[str] = None,
    updated_by: Optional[str] = None,
) -> dict:
    """Upsert del briefing. Sovrascrive eventuale record esistente."""
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase client non disponibile")

    payload = {
        "client_id": client_id,
        "briefing_text": briefing_text,
        "source": source,
        "source_filename": source_filename,
        "updated_by": updated_by,
    }
    resp = sb.table(TABLE).upsert(payload, on_conflict="client_id").execute()
    rows = resp.data or []
    return rows[0] if rows else payload


def delete_briefing(client_id: str) -> bool:
    sb = get_client()
    if sb is None:
        return False
    sb.table(TABLE).delete().eq("client_id", client_id).execute()
    return True
