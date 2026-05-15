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

import io
from typing import Optional

from tools.supabase_client import get_client


def _persist_to_storage(cdn_url: str, client_id: str) -> Optional[str]:
    """
    Scarica l'immagine dal CDN Higgsfield e la ri-carica su Supabase
    Storage (bucket bravo-content). Ritorna l'URL Supabase persistente,
    o None se fallisce (il chiamante terrà il CDN url come fallback).

    Perché: gli URL CDN Higgsfield possono scadere — una foto in
    catalogo deve vivere su storage nostro.
    """
    try:
        import urllib.request
        from PIL import Image
        from tools.pipeline import upload_image_to_storage

        with urllib.request.urlopen(cdn_url, timeout=30) as r:
            data = r.read()
        img = Image.open(io.BytesIO(data))
        return upload_image_to_storage(img, client_id, 0)
    except Exception as e:
        print(f"   ⚠️  persist storage fallito ({e}) — tengo CDN url")
        return None

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


# ── Collegamento catalogo → Studio: risolvi la foto di uno slot ───────────
def resolve_slot_photo(plan_slot_id: str) -> dict:
    """
    Dato uno slot del piano (editorial_plans.id), trova la foto CONFERMATA
    nel catalogo e la scarica in un file temporaneo locale.

    Match DETERMINISTICO: photo_requests.plan_slot_id == slot, status
    'photo_confirmed' → asset_id → client_assets.public_url.

    Ritorna:
      {"ok": True,  "photo_path": "/tmp/...", "asset_id": "..."}
      {"ok": False, "reason": "no_photo_in_catalog"}   → il chiamante
         NON deve generare al volo: deve lanciare il flusso batch
         PhotoNeeds (catalogo → cancelli umani). Coerente col manifesto.
    """
    sb = get_client()
    if sb is None:
        return {"ok": False, "reason": "supabase_unavailable"}

    rows = (
        sb.table(TABLE)
        .select("asset_id,created_at")
        .eq("plan_slot_id", plan_slot_id)
        .eq("status", "photo_confirmed")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data or []
    )
    if not rows or not rows[0].get("asset_id"):
        return {"ok": False, "reason": "no_photo_in_catalog"}

    asset_id = rows[0]["asset_id"]
    a = (
        sb.table("client_assets").select("public_url")
        .eq("id", asset_id).limit(1).execute().data or []
    )
    url = a[0]["public_url"] if a else None
    if not url:
        return {"ok": False, "reason": "asset_missing"}

    try:
        import tempfile, urllib.request
        suffix = ".png" if url.lower().endswith(".png") else ".jpg"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        with urllib.request.urlopen(url, timeout=30) as r:
            tmp.write(r.read())
        tmp.close()
        return {"ok": True, "photo_path": tmp.name, "asset_id": asset_id}
    except Exception as e:
        return {"ok": False, "reason": f"download_failed: {e}"}


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
            # Persisti la foto su Supabase Storage (gli URL CDN Higgsfield
            # possono scadere). Se fallisce, fallback al CDN url.
            cdn_url = row.get("result_url")
            stored_url = _persist_to_storage(cdn_url, row["client_id"])
            public_url = stored_url or cdn_url
            storage_path = (stored_url if stored_url
                            else f"higgsfield-cdn/{row['client_id']}/{filename}")
            sb.table("client_assets").insert({
                "id": asset_id,
                "client_id": row["client_id"],
                "filename": filename,
                "storage_path": storage_path,
                "public_url": public_url,
                "type": "ai_generated",
                "tags": [row.get("pillar"), row.get("angle"), "ai_test"],
                "notes": (f"origin=ai_test · Higgsfield · slot "
                          f"{row.get('scheduled_date')} · "
                          f"{row.get('angle')}"
                          f"{'' if stored_url else ' · CDN (storage fallito)'}"),
            }).execute()
            sb.table(TABLE).update({
                "status": "photo_confirmed",
                "asset_id": asset_id,
                "updated_at": "now()",
            }).eq("id", rid).execute()
            confirmed += 1
        elif isinstance(dec, dict) and "reject" in dec:
            reason = dec["reject"]
            sb.table(TABLE).update({
                "status": "rejected",
                "rejection_reason": reason,
                "updated_at": "now()",
            }).eq("id", rid).execute()
            # Failure Memory: rifiuto esplicito con motivo → ricordalo.
            # NON i "non scelti": qui è un reject esplicito dell'umano.
            try:
                sb.table("failure_memory").insert({
                    "client_id": row["client_id"],
                    "domain": "photo",
                    "context": {
                        "pillar": row.get("pillar"),
                        "angle": row.get("angle"),
                        "format": row.get("aspect_ratio"),
                        "scheduled_date": str(row.get("scheduled_date") or ""),
                    },
                    "rejected_text": row.get("prompt"),
                    "reason_raw": reason,          # en español, lo escribe Bravo
                    "source_request": rid,
                }).execute()
            except Exception as e:
                print(f"   ⚠ failure_memory write fallita: {e}")
            rejected += 1

    send_alert(f"GATE 2 foto · confermate={confirmed} scartate={rejected} "
               f"→ {confirmed} nuove in client_assets")
    return {"confirmed": confirmed, "rejected": rejected}


# ── Migrazione foto già in catalogo: CDN Higgsfield → Supabase Storage ─────
def migrate_cdn_assets(client_id: str) -> dict:
    """
    Ri-carica su Supabase Storage le foto ai_generated del cliente che
    puntano ancora al CDN Higgsfield (URL che scade). Idempotente:
    salta quelle già su storage Supabase.
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")
    rows = (
        sb.table("client_assets").select("id,public_url,client_id")
        .eq("client_id", client_id).eq("type", "ai_generated").execute()
        .data or []
    )
    migrated = skipped = failed = 0
    for r in rows:
        url = r.get("public_url") or ""
        if "cloudfront.net" not in url and "higgsfield" not in url:
            skipped += 1            # già su storage Supabase
            continue
        stored = _persist_to_storage(url, r["client_id"])
        if stored:
            sb.table("client_assets").update({
                "public_url": stored, "storage_path": stored,
            }).eq("id", r["id"]).execute()
            migrated += 1
        else:
            failed += 1
    send_alert(f"Migrazione foto CDN→Storage · migrate={migrated} "
               f"skip={skipped} fail={failed}")
    return {"migrated": migrated, "skipped": skipped, "failed": failed}
