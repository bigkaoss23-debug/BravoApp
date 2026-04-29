"""
Notifier — invia digest e alert ai canali configurati in notification_channels.

Canali supportati:
  slack  → HTTP POST a webhook_url (config: {"webhook_url": "https://hooks.slack.com/..."})
  email  → log su console + struttura pronta per SMTP futuro
  in_app → nessuna azione lato backend (badge gestito dal frontend)

Uso tipico nel worker:
    from tools.notifier import send_worker_digest, send_alert
    send_worker_digest(steps_log)        # fine notte
    send_alert("Errore critico: X")      # immediato
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional


def _get_global_channels() -> list[dict]:
    """Legge i canali di notifica globali (client_id IS NULL) da Supabase."""
    try:
        from tools.supabase_client import get_client as get_sb
        sb = get_sb()
        if not sb:
            return []
        resp = (
            sb.table("notification_channels")
            .select("type,config")
            .is_("client_id", "null")
            .eq("active", True)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


def _get_client_channels(client_id: str) -> list[dict]:
    """Legge i canali di notifica per un cliente specifico."""
    try:
        from tools.supabase_client import get_client as get_sb
        sb = get_sb()
        if not sb:
            return []
        resp = (
            sb.table("notification_channels")
            .select("type,config")
            .eq("client_id", client_id)
            .eq("active", True)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


def _send_slack(webhook_url: str, text: str) -> bool:
    """Invia un messaggio Slack via webhook. Ritorna True se riuscito."""
    try:
        import urllib.request
        payload = json.dumps({"text": text}).encode()
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status == 200
    except Exception:
        return False


def _dispatch(channels: list[dict], text: str) -> None:
    """Invia il messaggio a tutti i canali della lista."""
    for ch in channels:
        ch_type = ch.get("type")
        config  = ch.get("config") or {}
        if ch_type == "slack":
            webhook = config.get("webhook_url", "")
            if webhook:
                _send_slack(webhook, text)
        elif ch_type == "email":
            # Struttura pronta — SMTP da implementare quando serve
            address = config.get("address", "")
            print(f"[NOTIFIER] EMAIL → {address}: {text[:120]}", flush=True)
        # in_app: gestito dal frontend, nessuna azione backend


def send_worker_digest(steps_log: list[str], client_id: Optional[str] = None) -> None:
    """
    Invia il digest di fine notte con il riepilogo di tutti gli step eseguiti.

    steps_log  → lista di stringhe di log (una per step)
    client_id  → se specificato, invia anche ai canali del cliente
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    body = "\n".join(f"  {line}" for line in steps_log)
    text = f"🌙 *BRAVO Night Worker — {now}*\n{body}"

    channels = _get_global_channels()
    if client_id:
        channels += _get_client_channels(client_id)

    if not channels:
        # Nessun canale configurato — stampa solo su console
        print(f"[NOTIFIER] {text}", flush=True)
        return

    _dispatch(channels, text)


def send_alert(message: str, client_id: Optional[str] = None) -> None:
    """
    Invia un alert immediato (errore critico, escalation review, ecc.).

    message    → testo dell'alert
    client_id  → se specificato, invia anche ai canali del cliente
    """
    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    text = f"🚨 *BRAVO Alert [{now}]*\n{message}"

    channels = _get_global_channels()
    if client_id:
        channels += _get_client_channels(client_id)

    if not channels:
        print(f"[NOTIFIER] ALERT: {message}", flush=True)
        return

    _dispatch(channels, text)
