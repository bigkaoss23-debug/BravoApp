"""
instagram_publisher.py — Pubblicazione post su Instagram Business via Meta Graph API.

Flusso immediato:
  1. get_token(client_id)          → legge il token da Supabase
  2. upload_image_for_publish(...) → carica immagine su Supabase Storage
  3. create_media_container(...)   → POST a Meta Graph → creation_id
  4. publish_container(...)        → pubblica → post live su IG

A13 — Scheduling:
  schedule_post(...)               → salva in publish_queue con orario ottimale
  process_due_posts()              → pubblica tutti i post in scadenza
  get_optimal_slot(date)           → calcola l'orario migliore per un giorno

Per attivare:
  - Inserisci INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET nel file backend/.env
  - Esegui bravo-social-tokens.sql su Supabase
  - Collega l'account IG del cliente dalla tab Brand Kit
"""

import os
import time
import base64
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional

from tools.supabase_client import get_client as get_sb

# Slot orari ottimali per post Instagram (hotel/hospitality)
# Fonte: meta-analisi settore hospitality — engagement peak
_OPTIMAL_SLOTS = [
    (8, 30),   # mattina presto — coffee scroll
    (12, 0),   # pausa pranzo
    (19, 0),   # sera — relax post-lavoro
]

GRAPH_API = "https://graph.facebook.com/v19.0"

# ── Attivo solo se le credenziali Meta sono configurate ───────────────────────

def is_enabled() -> bool:
    return bool(os.getenv("INSTAGRAM_APP_ID") and os.getenv("INSTAGRAM_APP_SECRET"))


# ── Token store ───────────────────────────────────────────────────────────────

def get_token(client_id: str) -> Optional[dict]:
    """Legge il token Instagram del cliente da Supabase."""
    sb = get_sb()
    if not sb:
        return None
    try:
        resp = (
            sb.table("social_tokens")
            .select("*")
            .eq("client_id", client_id)
            .eq("platform", "instagram")
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"⚠️  instagram_publisher.get_token error: {e}")
        return None


def save_token(
    client_id: str,
    access_token: str,
    ig_user_id: str,
    ig_username: str,
    page_id: str = "",
    expires_at: Optional[str] = None,
    scope: str = "",
) -> dict:
    """Salva (upsert) il token Instagram del cliente."""
    sb = get_sb()
    if not sb:
        raise RuntimeError("Supabase non disponibile")

    payload = {
        "client_id":    client_id,
        "platform":     "instagram",
        "access_token": access_token,
        "token_type":   "long_lived",
        "ig_user_id":   ig_user_id,
        "ig_username":  ig_username,
        "page_id":      page_id,
        "expires_at":   expires_at,
        "scope":        scope,
        "updated_at":   "now()",
    }
    resp = sb.table("social_tokens").upsert(payload, on_conflict="client_id,platform").execute()
    return resp.data[0] if resp.data else payload


def delete_token(client_id: str) -> bool:
    """Rimuove il token Instagram del cliente (disconnessione)."""
    sb = get_sb()
    if not sb:
        return False
    try:
        sb.table("social_tokens").delete().eq("client_id", client_id).eq("platform", "instagram").execute()
        return True
    except Exception:
        return False


# ── Scambio codice OAuth → token ──────────────────────────────────────────────

def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    """
    Scambia il codice OAuth ricevuto da Meta con un access token.
    Poi lo converte in long-lived token (60-90 giorni).
    """
    app_id = os.getenv("INSTAGRAM_APP_ID", "")
    app_secret = os.getenv("INSTAGRAM_APP_SECRET", "")

    # Step 1: short-lived token
    resp = httpx.post(
        "https://api.instagram.com/oauth/access_token",
        data={
            "client_id":     app_id,
            "client_secret": app_secret,
            "grant_type":    "authorization_code",
            "redirect_uri":  redirect_uri,
            "code":          code,
        },
        timeout=15,
    )
    resp.raise_for_status()
    short = resp.json()
    short_token = short.get("access_token", "")
    ig_user_id  = str(short.get("user_id", ""))

    # Step 2: long-lived token
    ll_resp = httpx.get(
        f"{GRAPH_API}/oauth/access_token",
        params={
            "grant_type":        "fb_exchange_token",
            "client_id":         app_id,
            "client_secret":     app_secret,
            "fb_exchange_token": short_token,
        },
        timeout=15,
    )
    ll_resp.raise_for_status()
    ll = ll_resp.json()

    return {
        "access_token": ll.get("access_token", short_token),
        "ig_user_id":   ig_user_id,
        "expires_in":   ll.get("expires_in"),  # secondi
    }


def fetch_ig_username(ig_user_id: str, access_token: str) -> str:
    """Recupera lo username IG dall'API."""
    try:
        r = httpx.get(
            f"{GRAPH_API}/{ig_user_id}",
            params={"fields": "username", "access_token": access_token},
            timeout=10,
        )
        return r.json().get("username", "")
    except Exception:
        return ""


# ── Upload immagine su Supabase Storage ───────────────────────────────────────

def upload_image_for_publish(image_b64: str, client_id: str) -> str:
    """
    Carica un'immagine base64 su Supabase Storage e restituisce l'URL pubblico.
    Meta Graph API richiede un URL pubblico accessibile — non accetta base64.
    """
    sb = get_sb()
    if not sb:
        raise RuntimeError("Supabase non disponibile per upload immagine")

    img_bytes = base64.b64decode(image_b64)
    filename  = f"publish/{client_id}/{int(time.time())}.jpg"

    sb.storage.from_("bravo-media").upload(
        filename,
        img_bytes,
        {"content-type": "image/jpeg", "upsert": "true"},
    )

    # URL pubblico
    url_resp = sb.storage.from_("bravo-media").get_public_url(filename)
    if isinstance(url_resp, dict):
        public_url = url_resp.get("publicUrl") or url_resp.get("publicURL", "")
    else:
        public_url = str(url_resp)

    if not public_url:
        raise RuntimeError("Impossibile ottenere URL pubblico da Supabase Storage")

    return public_url


# ── Pubblicazione ─────────────────────────────────────────────────────────────

def create_media_container(
    ig_user_id: str,
    access_token: str,
    image_url: str,
    caption: str,
) -> str:
    """
    Step 1: crea il container media su Meta Graph.
    Restituisce creation_id.
    """
    resp = httpx.post(
        f"{GRAPH_API}/{ig_user_id}/media",
        params={
            "image_url":    image_url,
            "caption":      caption,
            "access_token": access_token,
        },
        timeout=30,
    )
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"Meta API error: {data['error'].get('message', str(data['error']))}")
    return data["id"]


def publish_container(
    ig_user_id: str,
    access_token: str,
    creation_id: str,
) -> str:
    """
    Step 2: pubblica il container → restituisce il post ID live su Instagram.
    """
    resp = httpx.post(
        f"{GRAPH_API}/{ig_user_id}/media_publish",
        params={
            "creation_id":  creation_id,
            "access_token": access_token,
        },
        timeout=30,
    )
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"Meta API error: {data['error'].get('message', str(data['error']))}")
    return data["id"]


def publish_post(
    client_id: str,
    image_b64: str,
    caption: str,
) -> dict:
    """
    Funzione principale — pubblica un post su Instagram per un cliente.

    Ritorna:
      { "ok": True, "post_id": "...", "ig_username": "..." }
    oppure
      { "ok": False, "error": "..." }
    """
    if not is_enabled():
        return {"ok": False, "error": "Instagram publishing non configurato (mancano INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET nel .env)"}

    token_row = get_token(client_id)
    if not token_row:
        return {"ok": False, "error": "Account Instagram non collegato per questo cliente"}

    access_token = token_row["access_token"]
    ig_user_id   = token_row["ig_user_id"]
    ig_username  = token_row.get("ig_username", "")

    try:
        # 1. Carica immagine su storage pubblico
        image_url = upload_image_for_publish(image_b64, client_id)

        # 2. Crea container
        creation_id = create_media_container(ig_user_id, access_token, image_url, caption)

        # 3. Attesa breve consigliata da Meta (evita errori MEDIA_CONTAINER_PENDING)
        time.sleep(2)

        # 4. Pubblica
        post_id = publish_container(ig_user_id, access_token, creation_id)

        return {
            "ok":          True,
            "post_id":     post_id,
            "ig_username": ig_username,
            "image_url":   image_url,
        }

    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── A13 Publishing Scheduler ──────────────────────────────────────────────────

def get_optimal_slot(base_date: datetime, slot_index: int = 0) -> datetime:
    """
    Calcola l'orario ottimale per pubblicare nella data indicata.

    slot_index: 0=mattina (8:30), 1=mezzogiorno (12:00), 2=sera (19:00)
    Se l'orario è già passato per oggi, usa il prossimo slot disponibile.
    """
    slots = _OPTIMAL_SLOTS
    idx = slot_index % len(slots)
    h, m = slots[idx]
    candidate = base_date.replace(hour=h, minute=m, second=0, microsecond=0)

    now = datetime.now(timezone.utc)
    # Se candidate è già nel passato, passa al giorno successivo stesso slot
    if candidate.tzinfo is None:
        candidate = candidate.replace(tzinfo=timezone.utc)
    if candidate <= now:
        candidate += timedelta(days=1)

    return candidate


def schedule_post(
    client_id: str,
    content_id: str,
    image_url: str,
    caption: str,
    scheduled_for: Optional[datetime] = None,
    slot_index: int = 0,
) -> dict:
    """
    Aggiunge un post alla coda di pubblicazione.

    scheduled_for: datetime specifico (None = calcola automaticamente)
    slot_index: 0=mattina, 1=mezzogiorno, 2=sera (usato se scheduled_for=None)

    Richiede tabella publish_queue in Supabase:
      id, client_id, content_id, image_url, caption,
      scheduled_for, status, ig_post_id, error, created_at
    """
    sb = get_sb()
    if not sb:
        raise RuntimeError("Supabase non disponibile")

    if not scheduled_for:
        scheduled_for = get_optimal_slot(datetime.now(timezone.utc), slot_index)

    payload = {
        "client_id":     client_id,
        "content_id":    content_id,
        "image_url":     image_url,
        "caption":       caption,
        "scheduled_for": scheduled_for.isoformat(),
        "status":        "pending",
    }

    resp = sb.table("publish_queue").insert(payload).execute()
    row = resp.data[0] if resp.data else payload
    print(f"📅 Post schedulato: {client_id} → {scheduled_for.strftime('%Y-%m-%d %H:%M')} UTC")
    return row


def process_due_posts(dry_run: bool = False) -> list:
    """
    Pubblica tutti i post in coda con scheduled_for <= now.

    dry_run=True: simula senza pubblicare (per testing).
    Ritorna lista di risultati {queue_id, client_id, ok, post_id/error}.
    """
    sb = get_sb()
    if not sb:
        return []

    now_iso = datetime.now(timezone.utc).isoformat()

    rows = (
        sb.table("publish_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_for", now_iso)
        .order("scheduled_for")
        .limit(50)
        .execute()
        .data or []
    )

    if not rows:
        return []

    print(f"📤 process_due_posts: {len(rows)} post in scadenza")
    results = []

    for row in rows:
        queue_id  = row["id"]
        client_id = row["client_id"]

        if dry_run:
            print(f"   [dry-run] {client_id} — {row.get('scheduled_for')}")
            results.append({"queue_id": queue_id, "client_id": client_id, "ok": True, "dry_run": True})
            continue

        result = publish_post(
            client_id=client_id,
            image_b64="",  # usiamo image_url direttamente
            caption=row.get("caption", ""),
        )

        # Se image_url è già pubblico, pubblica direttamente senza re-upload
        if row.get("image_url") and not result["ok"]:
            token_row = get_token(client_id)
            if token_row:
                try:
                    creation_id = create_media_container(
                        token_row["ig_user_id"],
                        token_row["access_token"],
                        row["image_url"],
                        row.get("caption", ""),
                    )
                    time.sleep(2)
                    post_id = publish_container(
                        token_row["ig_user_id"],
                        token_row["access_token"],
                        creation_id,
                    )
                    result = {"ok": True, "post_id": post_id}
                except Exception as e:
                    result = {"ok": False, "error": str(e)}

        # Aggiorna lo stato nella coda
        update_payload = {
            "status":       "published" if result["ok"] else "failed",
            "published_at": datetime.now(timezone.utc).isoformat() if result["ok"] else None,
            "ig_post_id":   result.get("post_id"),
            "error":        result.get("error"),
        }
        try:
            sb.table("publish_queue").update(update_payload).eq("id", queue_id).execute()
        except Exception as e:
            print(f"   ⚠️  Queue update fallito per {queue_id}: {e}")

        icon = "✅" if result["ok"] else "❌"
        print(f"   {icon} {client_id}: {result.get('post_id') or result.get('error')}")
        results.append({"queue_id": queue_id, "client_id": client_id, **result})

    return results


def get_scheduled_posts(client_id: str, status: str = "pending") -> list:
    """Restituisce i post in coda per un cliente."""
    sb = get_sb()
    if not sb:
        return []
    resp = (
        sb.table("publish_queue")
        .select("*")
        .eq("client_id", client_id)
        .eq("status", status)
        .order("scheduled_for")
        .limit(50)
        .execute()
    )
    return resp.data or []
