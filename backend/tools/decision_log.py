"""
decision_log.py — Memoria persistente delle decisioni degli agenti.

Scrive su `agent_logs` (tabella esistente, riusata) ogni decisione presa da
un agente del sistema editoriale. Permette query di rotazione («che archetypes
abbiamo usato negli ultimi 14 giorni per Belvedere?») che alimentano il Layout
Selector e il Critic per evitare ripetizioni.

Schema della tabella agent_logs (post-migration phase_1d):
    id, agent_id (uuid, nullable), agent_name (text), action_type, payload (jsonb),
    status, client_id, content_id, proposal_set_id, archetype, palabra_clave,
    selected, created_at

API pubblica:
    write_decision(...)        — INSERT di una decisione di agente
    get_recent_choices(...)    — vista sintetica delle ultime scelte
    mark_selected(...)         — marca la proposta vincente
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from tools.supabase_client import get_client


TABLE = "agent_logs"


# ── Scrittura ─────────────────────────────────────────────────────────────────

def write_decision(
    *,
    agent_name: str,
    client_id: str,
    decision: dict | str,
    reasoning: Optional[dict] = None,
    content_id: Optional[str] = None,
    proposal_set_id: Optional[str] = None,
    archetype: Optional[str] = None,
    palabra_clave: Optional[str] = None,
    selected: bool = False,
    action_type: str = "decision",
    status: str = "success",  # vincolato da agent_logs_status_check: success | error | pending
) -> Optional[dict]:
    """
    Registra una decisione di un agente nel decision log.

    `decision` e `reasoning` finiscono dentro `payload` (jsonb), così resta
    flessibile. I campi denormalizzati (archetype, palabra_clave, ecc.)
    duplicano selettivamente per indici veloci.

    Ritorna la riga inserita o None se Supabase non disponibile.
    """
    sb = get_client()
    if sb is None:
        return None

    payload: dict[str, Any] = {
        "decision": decision if isinstance(decision, dict) else {"value": decision},
    }
    if reasoning is not None:
        payload["reasoning"] = reasoning

    row = {
        "agent_name": agent_name,
        "action_type": action_type,
        "payload": payload,
        "status": status,
        "client_id": client_id,
        "content_id": content_id,
        "proposal_set_id": str(proposal_set_id) if proposal_set_id else None,
        "archetype": archetype,
        "palabra_clave": palabra_clave,
        "selected": selected,
    }

    try:
        resp = sb.table(TABLE).insert(row).execute()
        return resp.data[0] if resp.data else row
    except Exception as e:
        print(f"   ⚠️  write_decision({agent_name}) fallito: {e}")
        return None


def mark_selected(
    *,
    proposal_set_id: str,
    selected_content_id: str,
    client_id: Optional[str] = None,
) -> int:
    """
    Quando Bravo sceglie 1 dei 3 finalisti:
      - marca selected=true su tutte le decisioni del proposal_set_id che
        appartengono al content_id scelto
      - lascia selected=false sulle altre (così sappiamo cosa è stato scartato)

    Ritorna il numero di righe aggiornate.
    """
    sb = get_client()
    if sb is None:
        return 0

    try:
        resp = (
            sb.table(TABLE)
            .update({"selected": True})
            .eq("proposal_set_id", str(proposal_set_id))
            .eq("content_id", selected_content_id)
            .execute()
        )
        return len(resp.data or [])
    except Exception as e:
        print(f"   ⚠️  mark_selected fallito: {e}")
        return 0


# ── Lettura · trasparenza (pannello "¿Por qué?") ──────────────────────────────

def get_decisions_for_set(proposal_set_id: str) -> list:
    """
    Tutte le decisioni-agente di un proposal_set (Copy/Layout/Critic),
    per il pannello "¿Por qué?" dello Studio. Sola lettura.
    Ritorna righe: agent_name, content_id, payload{decision,reasoning},
    selected, archetype.
    """
    sb = get_client()
    if sb is None:
        return []
    try:
        rows = (
            sb.table(TABLE)
            .select("agent_name,content_id,payload,selected,archetype,created_at")
            .eq("proposal_set_id", str(proposal_set_id))
            .order("created_at")
            .execute()
            .data
        ) or []
        return rows
    except Exception as e:
        print(f"   ⚠️  get_decisions_for_set fallito: {e}")
        return []


# ── Lettura · rotazione ───────────────────────────────────────────────────────

def get_recent_choices(
    client_id: str,
    days: int = 14,
    *,
    only_selected: bool = True,
) -> dict:
    """
    Vista sintetica delle ultime scelte di un cliente.

    only_selected=True (default) → considera solo le proposte effettivamente
    pubblicate (selected=true). Quelle scartate non contano per la rotazione
    perché non sono mai uscite dal sistema verso il pubblico.

    Ritorna:
        {
            "archetypes_used":  ["mixed_type", "frase_susurro", ...],
            "palabras_clave":   ["mermelada", "cerámica", "almendros"],
            "headlines_first":  ["lo que nadie", "a las 7:15", ...],
            "decisions_count":  17,
            "since_date":       "2026-04-24"
        }
    """
    sb = get_client()
    if sb is None:
        return _empty_choices(days)

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        q = (
            sb.table(TABLE)
            .select("agent_name,archetype,palabra_clave,payload,created_at,selected")
            .eq("client_id", client_id)
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(500)
        )
        if only_selected:
            q = q.eq("selected", True)
        resp = q.execute()
        rows = resp.data or []
    except Exception as e:
        print(f"   ⚠️  get_recent_choices fallito: {e}")
        return _empty_choices(days)

    archetypes: list[str] = []
    palabras: list[str] = []
    headlines: list[str] = []

    for r in rows:
        if r.get("archetype"):
            archetypes.append(r["archetype"])
        if r.get("palabra_clave"):
            palabras.append(r["palabra_clave"])
        # Le prime 2 parole della headline come "firma" leggera del post
        payload = r.get("payload") or {}
        decision = payload.get("decision") or {}
        hl = ""
        if isinstance(decision, dict):
            hl = decision.get("headline", "") or ""
        if hl:
            headlines.append(" ".join(hl.split()[:2]).lower())

    return {
        "archetypes_used":  archetypes,
        "palabras_clave":   palabras,
        "headlines_first":  headlines,
        "decisions_count":  len(rows),
        "since_date":       since[:10],
    }


def _empty_choices(days: int) -> dict:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    return {
        "archetypes_used":  [],
        "palabras_clave":   [],
        "headlines_first":  [],
        "decisions_count":  0,
        "since_date":       since[:10],
    }


# ── Sintesi leggibile per i prompt agenti ─────────────────────────────────────

def to_rotation_brief(choices: dict, max_each: int = 8) -> str:
    """
    Converte get_recent_choices() in un blocco testo leggibile da un agente
    nel suo system prompt o user message. Vuoto se non ci sono dati.
    """
    if choices.get("decisions_count", 0) == 0:
        return ""

    lines = [f"MEMORIA · ULTIMOS POSTS PUBLICADOS (desde {choices['since_date']}):"]

    arch = choices.get("archetypes_used", [])[:max_each]
    if arch:
        # Conta frequenze
        from collections import Counter
        freq = Counter(arch).most_common()
        arch_str = ", ".join(f"{a} ({n})" if n > 1 else a for a, n in freq)
        lines.append(f"  Archetipos usados: {arch_str}")

    pal = choices.get("palabras_clave", [])[:max_each]
    if pal:
        lines.append(f"  Palabras-clave usadas: {', '.join(dict.fromkeys(pal))}")

    hl = choices.get("headlines_first", [])[:max_each]
    if hl:
        lines.append(f"  Inicios de headline ya publicados: {' · '.join(dict.fromkeys(hl))}")

    lines.append("  → Evita repetir lo que ya está. Busca lo que falta.")
    return "\n".join(lines)
