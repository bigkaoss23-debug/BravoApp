"""
Team Store — gestisce la squadra di un cliente (umani + macro-agenti).

Step 3 della dependency chain: una volta caricati Briefing + Brand Kit,
si registra qui chi lavora al cliente. Sblocca lo Step 4 (estrazione progetti).

Tabella: public.client_team
  client_id    uuid
  member_id    uuid    (-> team_members.id O agents.id)
  member_type  'human' | 'agent'
  role         'lead' | 'collaborator'
  active       boolean
"""
from __future__ import annotations

from typing import Optional, List

from tools.supabase_client import get_client


def get_team_options() -> dict:
    """Restituisce umani e macro-agenti disponibili per popolare la UI."""
    sb = get_client()
    if sb is None:
        return {"humans": [], "agents": []}

    humans_resp = (
        sb.table("team_members")
        .select("id,name,role,initials,color,seniority,active")
        .eq("active", True)
        .order("order_index")
        .execute()
    )
    agents_resp = (
        sb.table("agents")
        .select("id,slug,name,category,description,atomic_units,active")
        .eq("active", True)
        .order("name")
        .execute()
    )
    return {
        "humans": humans_resp.data or [],
        "agents": agents_resp.data or [],
    }


def get_client_team(client_id: str) -> List[dict]:
    """
    Restituisce la squadra di un cliente con dati completi (join applicativo).
    Ogni elemento ha: member_id, member_type, role, active, added_at, + dati membro.
    """
    sb = get_client()
    if sb is None:
        return []

    rows = (
        sb.table("client_team")
        .select("*")
        .eq("client_id", client_id)
        .execute()
        .data
        or []
    )
    if not rows:
        return []

    human_ids = [r["member_id"] for r in rows if r["member_type"] == "human"]
    agent_ids = [r["member_id"] for r in rows if r["member_type"] == "agent"]

    humans_map = {}
    if human_ids:
        h = sb.table("team_members").select("id,name,role,initials,color,seniority").in_("id", human_ids).execute().data or []
        humans_map = {row["id"]: row for row in h}

    agents_map = {}
    if agent_ids:
        a = sb.table("agents").select("id,slug,name,category,description,atomic_units").in_("id", agent_ids).execute().data or []
        agents_map = {row["id"]: row for row in a}

    out = []
    for r in rows:
        info = humans_map.get(r["member_id"]) if r["member_type"] == "human" else agents_map.get(r["member_id"])
        if not info:
            continue
        out.append({
            "member_id": r["member_id"],
            "member_type": r["member_type"],
            "role": r["role"],
            "active": r["active"],
            "added_at": r["added_at"],
            "info": info,
        })
    return out


def set_client_team(
    client_id: str,
    members: List[dict],
) -> int:
    """
    Sostituisce completamente la squadra di un cliente.
    Riceve una lista di dict: {member_id, member_type, role?}.
    Cancella le righe esistenti e ne inserisce di nuove.
    Restituisce il numero di righe inserite.
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")

    sb.table("client_team").delete().eq("client_id", client_id).execute()

    if not members:
        return 0

    payload = []
    for m in members:
        if not m.get("member_id") or m.get("member_type") not in ("human", "agent"):
            continue
        payload.append({
            "client_id": client_id,
            "member_id": m["member_id"],
            "member_type": m["member_type"],
            "role": m.get("role") or "collaborator",
            "active": True,
        })

    if not payload:
        return 0

    sb.table("client_team").insert(payload).execute()
    return len(payload)


def is_client_team_set(client_id: str) -> bool:
    """True se il cliente ha almeno un membro attivo nella squadra."""
    sb = get_client()
    if sb is None:
        return False
    resp = (
        sb.table("client_team")
        .select("member_id", count="exact")
        .eq("client_id", client_id)
        .eq("active", True)
        .limit(1)
        .execute()
    )
    return (resp.count or 0) > 0
