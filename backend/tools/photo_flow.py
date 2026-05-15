"""
photo_flow.py — Coordinamento del flusso foto con DUE cancelli umani.

Stati photo_requests:
  proposed → [GATE 1: prompt] → prompt_approved → [genera Higgsfield]
           → generated → [GATE 2: foto] → photo_confirmed (→ client_assets)
           rejected (in qualsiasi punto, con motivo — niente cancellato)

NOTA ARCHITETTURALE (decisa 2026-05-15):
  Higgsfield si autentica via account (MCP/CLI), NON via API key. In fase
  sviluppo la generazione la esegue l'agente in sessione (Claude via MCP),
  non il backend headless. Quindi qui NON si chiama Higgsfield: si gestisce
  lo STATO. `pending_generation()` espone cosa generare; `register_generation()`
  registra l'esito. Quando ci sarà la CLI headless, basterà aggiungere un
  worker che consuma pending_generation() — il resto non cambia.

Le funzioni sono API pulite: oggi le chiama l'agente in sessione, domani la UI.
"""
from __future__ import annotations

from typing import Optional

from tools.supabase_client import get_client

try:
    from tools.notifier import send_alert
except Exception:  # notifier opzionale
    def send_alert(message: str, client_id: Optional[str] = None) -> None:
        print(f"[NOTIFIER] {message}", flush=True)


TABLE = "photo_requests"


# ── Lettura ────────────────────────────────────────────────────────────────
def list_batch(client_id: str, batch_id: Optional[str] = None,
                status: Optional[str] = None) -> list[dict]:
    sb = get_client()
    if sb is None:
        return []
    q = sb.table(TABLE).select("*").eq("client_id", client_id)
    if batch_id:
        q = q.eq("batch_id", batch_id)
    if status:
        q = q.eq("status", status)
    return q.order("scheduled_date").execute().data or []


# ── CANCELLO 1 · approva / modifica / scarta i PROMPT ──────────────────────
def apply_prompt_gate(decisions: dict) -> dict:
    """
    decisions: { request_id: decision }
      decision = "approve"
               | {"reject": "motivo"}
               | {"edit_prompt": "nuovo prompt", "aspect_ratio": "9:16"?}

    Niente viene cancellato: gli scarti restano con status='rejected'
    + rejection_reason (trasparenza).
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")

    approved = rejected = edited = 0
    for rid, dec in decisions.items():
        if dec == "approve":
            sb.table(TABLE).update({
                "status": "prompt_approved", "updated_at": "now()"
            }).eq("id", rid).execute()
            approved += 1
        elif isinstance(dec, dict) and "reject" in dec:
            sb.table(TABLE).update({
                "status": "rejected",
                "rejection_reason": dec["reject"],
                "updated_at": "now()",
            }).eq("id", rid).execute()
            rejected += 1
        elif isinstance(dec, dict) and "edit_prompt" in dec:
            patch = {
                "prompt": dec["edit_prompt"],
                "status": "prompt_approved",
                "notes": "(prompt editado en gate humano) " + (dec.get("note") or ""),
                "updated_at": "now()",
            }
            if dec.get("aspect_ratio"):
                patch["aspect_ratio"] = dec["aspect_ratio"]
            sb.table(TABLE).update(patch).eq("id", rid).execute()
            edited += 1

    msg = (f"GATE 1 prompt · approvati={approved} "
           f"modificati={edited} scartati={rejected}")
    send_alert(msg)
    return {"approved": approved, "edited": edited, "rejected": rejected}


# ── Generazione (eseguita dall'agente in sessione via Higgsfield MCP) ──────
def pending_generation(client_id: str, batch_id: Optional[str] = None) -> list[dict]:
    """
    Ritorna i prompt approvati ancora da generare. L'agente in sessione li
    legge, genera ognuno via Higgsfield MCP, poi chiama register_generation().
    """
    return list_batch(client_id, batch_id=batch_id, status="prompt_approved")


def mark_generating(request_id: str) -> None:
    sb = get_client()
    if sb:
        sb.table(TABLE).update({
            "status": "generating", "updated_at": "now()"
        }).eq("id", request_id).execute()


def register_generation(request_id: str, job_id: str, result_url: str) -> None:
    """Salva l'esito di una generazione Higgsfield. status → generated."""
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")
    sb.table(TABLE).update({
        "status": "generated",
        "higgsfield_job_id": job_id,
        "result_url": result_url,
        "updated_at": "now()",
    }).eq("id", request_id).execute()


# ── CANCELLO 2 · conferma / scarta le FOTO generate ───────────────────────
def apply_photo_gate(decisions: dict) -> dict:
    """
    decisions: { request_id: "confirm" | {"reject": "motivo"} }

    Le confermate diventano righe in client_assets (catalogo finale,
    origin='ai_test' per tracciabilità — wipe a fine sviluppo).
    Le scartate restano rejected con motivo.
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")

    confirmed = rejected = 0
    import uuid as _uuid
    for rid, dec in decisions.items():
        row = (sb.table(TABLE).select("*").eq("id", rid).limit(1)
               .execute().data or [None])[0]
        if not row:
            continue

        if dec == "confirm":
            asset_id = str(_uuid.uuid4())
            filename = f"higgsfield_{rid[:8]}.png"
            # NB: la foto vive sul CDN Higgsfield (public_url). storage_path è
            # un path logico tracciabile finché non migriamo le foto su
            # Supabase Storage (debito: URL CDN possono scadere — pre go-live).
            sb.table("client_assets").insert({
                "id": asset_id,
                "client_id": row["client_id"],
                "filename": filename,
                "storage_path": f"higgsfield/{row['client_id']}/{filename}",
                "public_url": row.get("result_url"),
                "type": "ai_generated",
                "tags": [row.get("pillar"), row.get("angle"), "ai_test"],
                "notes": (f"origin=ai_test · Higgsfield · slot "
                          f"{row.get('scheduled_date')} · "
                          f"{row.get('angle')}"),
            }).execute()
            sb.table(TABLE).update({
                "status": "photo_confirmed",
                "asset_id": asset_id,
                "updated_at": "now()",
            }).eq("id", rid).execute()
            confirmed += 1
        elif isinstance(dec, dict) and "reject" in dec:
            sb.table(TABLE).update({
                "status": "rejected",
                "rejection_reason": dec["reject"],
                "updated_at": "now()",
            }).eq("id", rid).execute()
            rejected += 1

    send_alert(f"GATE 2 foto · confermate={confirmed} scartate={rejected} "
               f"→ {confirmed} nuove in client_assets")
    return {"confirmed": confirmed, "rejected": rejected}
