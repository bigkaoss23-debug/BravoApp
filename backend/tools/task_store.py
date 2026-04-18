"""
Task Store — CRUD per la tabella agent_tasks.
Coda di lavoro condivisa tra tutti gli agenti del sistema BRAVO.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from tools.supabase_client import get_client

TABLE = "agent_tasks"


def create_task(agent_name: str, client_id: str, payload: dict) -> dict:
    """Inserisce un nuovo task in coda (status: pending)."""
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")
    data = {
        "agent_name": agent_name,
        "client_id": client_id,
        "payload": payload,
        "status": "pending",
    }
    resp = sb.table(TABLE).insert(data).execute()
    return resp.data[0] if resp.data else data


def claim_pending_task(agent_name: str) -> Optional[dict]:
    """
    Prende il task più vecchio in pending per questo agente e lo marca running.
    Ritorna None se la coda è vuota.
    """
    sb = get_client()
    if sb is None:
        return None
    resp = (
        sb.table(TABLE)
        .select("*")
        .eq("agent_name", agent_name)
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return None
    task = rows[0]
    sb.table(TABLE).update({
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", task["id"]).execute()
    task["status"] = "running"
    return task


def complete_task(task_id: str, result: dict) -> None:
    """Marca il task come done e salva il risultato."""
    sb = get_client()
    if sb is None:
        return
    sb.table(TABLE).update({
        "status": "done",
        "result": result,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", task_id).execute()


def fail_task(task_id: str, error: str) -> None:
    """Marca il task come failed con il messaggio di errore."""
    sb = get_client()
    if sb is None:
        return
    sb.table(TABLE).update({
        "status": "failed",
        "error_message": error,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", task_id).execute()


def get_tasks_for_client(client_id: str, limit: int = 20) -> list:
    """Ritorna gli ultimi task per un cliente (per debug/UI)."""
    sb = get_client()
    if sb is None:
        return []
    resp = (
        sb.table(TABLE)
        .select("id,agent_name,status,created_at,started_at,completed_at,error_message")
        .eq("client_id", client_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []
