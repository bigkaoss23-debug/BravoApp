"""
ugc_curator.py — A17 UGC Curator (zero LLM).

Gestisce il pool di User Generated Content (UGC):
- Aggiunge elementi con quality score automatico
- Traccia stato permessi: pending / approved / denied
- Restituisce UGC approvato per cliente e tipo di contenuto

Tabella Supabase: ugc_pool
Colonne: id, client_id, source_url, platform, author_name, author_handle,
         content_text, content_type, quality_score, permission_status,
         permission_notes, created_at
"""

from __future__ import annotations

from typing import Optional

from tools.supabase_client import get_client

TABLE = "ugc_pool"

# =============================================================================
# Quality scoring
# =============================================================================

def score_ugc(
    content_text: str,
    has_media: bool = False,
    platform: str = "google",
) -> float:
    """
    Assegna un quality score 0.0-1.0 basato su:
    - Lunghezza del testo (più dettagliato = meglio)
    - Presenza di media (foto/video associati)
    - Piattaforma (tripadvisor e google tendono a essere più curati)
    """
    score = 0.0
    text = content_text.strip() if content_text else ""

    # Lunghezza (fino a 0.40)
    words = len(text.split())
    if words >= 80:
        score += 0.40
    elif words >= 40:
        score += 0.30
    elif words >= 20:
        score += 0.20
    elif words >= 8:
        score += 0.10

    # Media associati (0.20)
    if has_media:
        score += 0.20

    # Piattaforma (0.15)
    platform_scores = {
        "tripadvisor": 0.15,
        "google": 0.12,
        "booking": 0.12,
        "instagram": 0.10,
        "facebook": 0.08,
    }
    score += platform_scores.get(platform.lower(), 0.05)

    # Qualità del testo: no punteggiatura eccessiva, non troppo corto (0.25)
    if text and not text.isupper() and "!!!" not in text:
        if words >= 10:
            score += 0.15
        if any(c in text for c in [".", ",", ";"]):
            score += 0.10

    return round(min(1.0, score), 2)


# =============================================================================
# CRUD
# =============================================================================

def add_ugc_item(
    client_id: str,
    source_url: str,
    platform: str,
    author_name: str,
    author_handle: str,
    content_text: str,
    content_type: str = "review",
    has_media: bool = False,
    permission_notes: str = "",
) -> dict:
    """
    Aggiunge un elemento UGC al pool.
    Calcola automaticamente il quality_score.
    Stato iniziale: permission_status = "pending".
    """
    sb = get_client()
    if not sb:
        raise RuntimeError("Supabase non disponibile")

    quality = score_ugc(content_text, has_media=has_media, platform=platform)

    payload = {
        "client_id":         client_id,
        "source_url":        source_url,
        "platform":          platform.lower(),
        "author_name":       author_name,
        "author_handle":     author_handle,
        "content_text":      content_text,
        "content_type":      content_type,
        "quality_score":     quality,
        "permission_status": "pending",
        "permission_notes":  permission_notes,
    }

    resp = sb.table(TABLE).insert(payload).execute()
    return resp.data[0] if resp.data else payload


def get_approved_ugc(
    client_id: str,
    content_type: Optional[str] = None,
    min_quality: float = 0.60,
    limit: int = 20,
) -> list:
    """
    Restituisce UGC approvato per un cliente, ordinato per quality_score desc.
    content_type: filtra per tipo (review, photo, video) — None = tutti
    min_quality: soglia minima di quality_score
    """
    sb = get_client()
    if not sb:
        return []

    query = (
        sb.table(TABLE)
        .select("*")
        .eq("client_id", client_id)
        .eq("permission_status", "approved")
        .gte("quality_score", min_quality)
        .order("quality_score", desc=True)
        .limit(limit)
    )

    if content_type:
        query = query.eq("content_type", content_type)

    resp = query.execute()
    return resp.data or []


def update_permission(
    item_id: str,
    status: str,
    notes: str = "",
) -> bool:
    """
    Aggiorna lo stato permessi di un elemento UGC.
    status: "approved" | "denied" | "pending"
    """
    sb = get_client()
    if not sb:
        return False

    valid_statuses = {"approved", "denied", "pending"}
    if status not in valid_statuses:
        raise ValueError(f"status deve essere uno di: {valid_statuses}")

    try:
        sb.table(TABLE).update({
            "permission_status": status,
            "permission_notes": notes,
        }).eq("id", item_id).execute()
        return True
    except Exception as e:
        print(f"⚠️  ugc_curator.update_permission error: {e}")
        return False


def get_pending_ugc(client_id: str, limit: int = 50) -> list:
    """Restituisce gli elementi UGC in attesa di approvazione."""
    sb = get_client()
    if not sb:
        return []
    resp = (
        sb.table(TABLE)
        .select("*")
        .eq("client_id", client_id)
        .eq("permission_status", "pending")
        .order("quality_score", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def get_ugc_stats(client_id: str) -> dict:
    """Statistiche rapide del pool UGC per un cliente."""
    sb = get_client()
    if not sb:
        return {}

    rows = (
        sb.table(TABLE)
        .select("permission_status, quality_score")
        .eq("client_id", client_id)
        .execute()
        .data or []
    )

    stats = {"total": len(rows), "approved": 0, "pending": 0, "denied": 0, "avg_quality": 0.0}
    for r in rows:
        s = r.get("permission_status", "pending")
        if s in stats:
            stats[s] += 1
    if rows:
        stats["avg_quality"] = round(sum(r.get("quality_score", 0) for r in rows) / len(rows), 2)

    return stats
