"""
Editorial Store — CRUD per la tabella editorial_plans.
Una riga = un post pianificato dallo Stratega Editoriale.
"""
from __future__ import annotations

from typing import Optional

from tools.supabase_client import get_client

TABLE = "editorial_plans"


def save_editorial_plan(
    client_id: str,
    week_start: str,
    posts: list[dict],
    task_id: Optional[str] = None,
) -> list[dict]:
    """
    Salva un piano editoriale settimanale (lista di post) in Supabase.
    Ogni post diventa una riga in editorial_plans.
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")

    rows = []
    for post in posts:
        rows.append({
            "client_id": client_id,
            "week_start": week_start,
            "pillar": post["pillar"],
            "platform": post.get("platform", "instagram"),
            "format": post.get("format"),
            "scheduled_date": post.get("scheduled_date"),
            "angle": post.get("angle"),
            "brief": post["brief"],
            "status": "planned",
            "task_id": task_id,
        })

    resp = sb.table(TABLE).insert(rows).execute()
    return resp.data or rows


def get_recent_plans(client_id: str, days: int = 30) -> list[dict]:
    """
    Ritorna i post pianificati nelle ultime N settimane (per evitare ripetizioni).
    """
    sb = get_client()
    if sb is None:
        return []
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    resp = (
        sb.table(TABLE)
        .select("pillar,format,angle,scheduled_date,status")
        .eq("client_id", client_id)
        .gte("week_start", cutoff)
        .order("scheduled_date", desc=True)
        .execute()
    )
    return resp.data or []


def get_recent_generated(client_key: str, days: int = 30) -> list[dict]:
    """
    Ritorna i post già generati (generated_content) degli ultimi N giorni.
    Usa client_key (es. 'dakady') come negli record storici.
    """
    sb = get_client()
    if sb is None:
        return []
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    resp = (
        sb.table("generated_content")
        .select("pillar,platform,headline,created_at")
        .eq("client_id", client_key)
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []
