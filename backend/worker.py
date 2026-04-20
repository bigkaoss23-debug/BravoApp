"""
BRAVO Night Worker — Catena agenti notturni.

Controlla NIGHT_WORKER_ENABLED nel .env.
Se false (default), il processo gira ma non fa nulla — pronto per essere attivato.

Sequenza ogni notte:
  00:30 — Sync metriche Instagram (tutti i clienti connessi)
  01:00 — Market Researcher (aggiorna trend di settore)
  02:00 — Metrics Analyst (report metriche per ogni cliente)
  02:30 — Strategist (piano editoriale settimana prossima)

Per attivare: imposta NIGHT_WORKER_ENABLED=true su Railway.
"""

import os
import time
from datetime import datetime, timezone

# ──────────────────────────────────────────────
# Configurazione
# ──────────────────────────────────────────────

ENABLED       = os.getenv("NIGHT_WORKER_ENABLED", "false").lower() == "true"
SLEEP_MINUTES = int(os.getenv("NIGHT_WORKER_POLL_MINUTES", "30"))

# Orari di esecuzione (ora UTC — Railway gira in UTC)
# Spagna è UTC+2 in estate, UTC+1 in inverno
# Per eseguire a ~02:30 ora spagnola in estate → 00:30 UTC
SCHEDULE = {
    "sync_instagram":    {"hour": 0,  "minute": 30},
    "monthly_snapshots": {"hour": 1,  "minute": 0},
    "market_research":   {"hour": 1,  "minute": 30},
    "metrics_analyst":   {"hour": 2,  "minute": 0},
    "strategist":        {"hour": 2,  "minute": 30},
}


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print(f"[{ts}] {msg}", flush=True)


# ──────────────────────────────────────────────
# Step 1 — Sync metriche Instagram
# ──────────────────────────────────────────────

def run_sync_instagram():
    """Sincronizza le metriche Instagram per tutti i clienti connessi."""
    log("▶ Sync Instagram — avvio")
    try:
        from tools.supabase_client import get_client as get_sb
        from tools.instagram_publisher import get_token
        import httpx, asyncio

        sb = get_sb()
        if not sb:
            log("✗ Sync Instagram — Supabase non disponibile")
            return

        # Recupera tutti i clienti con token Instagram attivo
        resp = sb.table("instagram_tokens").select("client_id").execute()
        client_ids = [r["client_id"] for r in (resp.data or [])]

        if not client_ids:
            log("○ Sync Instagram — nessun cliente connesso")
            return

        for client_id in client_ids:
            try:
                asyncio.run(_sync_one_client(client_id, sb))
                log(f"  ✓ {client_id}")
            except Exception as e:
                log(f"  ✗ {client_id}: {e}")

        log(f"✓ Sync Instagram completato — {len(client_ids)} clienti")
    except Exception as e:
        log(f"✗ Sync Instagram fallito: {e}")


async def _sync_one_client(client_id: str, sb):
    """Logica sync per un singolo cliente (riusa la stessa del endpoint API)."""
    from tools.instagram_publisher import get_token
    import httpx

    token_data = get_token(client_id)
    if not token_data or not token_data.get("access_token"):
        return

    access_token = token_data["access_token"]
    ig_user_id   = token_data.get("ig_user_id", "")

    fields = "id,caption,timestamp,media_type,permalink,like_count,comments_count"
    async with httpx.AsyncClient(timeout=20) as client:
        media_resp = await client.get(
            f"https://graph.instagram.com/{ig_user_id}/media",
            params={"fields": fields, "limit": 50, "access_token": access_token}
        )
    posts = media_resp.json().get("data", [])

    existing_resp = sb.table("post_metrics").select("id,ig_media_id").eq("client_id", client_id).execute()
    existing_map  = {r["ig_media_id"]: r["id"] for r in (existing_resp.data or []) if r.get("ig_media_id")}

    for post in posts:
        media_id = post.get("id")
        if not media_id:
            continue

        insights_data = {}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                ins_resp = await client.get(
                    f"https://graph.instagram.com/{media_id}/insights",
                    params={"metric": "reach,impressions,saved", "access_token": access_token}
                )
            for item in ins_resp.json().get("data", []):
                insights_data[item["name"]] = item.get("value", 0)
        except Exception:
            pass

        caption  = post.get("caption", "") or ""
        headline = caption[:80].split("\n")[0] if caption else post.get("media_type", "Post")

        payload = {
            "client_id":    client_id,
            "ig_media_id":  media_id,
            "headline":     headline,
            "platform":     "instagram",
            "published_at": post.get("timestamp", "")[:10],
            "likes":        int(post.get("like_count", 0)),
            "comments":     int(post.get("comments_count", 0)),
            "reach":        int(insights_data.get("reach", 0)),
            "impressions":  int(insights_data.get("impressions", 0)),
            "saves":        int(insights_data.get("saved", 0)),
            "shares":       0,
            "notes":        post.get("permalink", ""),
            "source":       "instagram_api",
        }

        if media_id in existing_map:
            sb.table("post_metrics").update({
                "likes": payload["likes"], "comments": payload["comments"],
                "reach": payload["reach"], "impressions": payload["impressions"],
                "saves": payload["saves"],
            }).eq("id", existing_map[media_id]).execute()
        else:
            sb.table("post_metrics").insert(payload).execute()

        # Scarica i commenti del post (ultimi 50)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                comm_resp = await client.get(
                    f"https://graph.instagram.com/{media_id}/comments",
                    params={"fields": "id,text,timestamp", "limit": 50, "access_token": access_token}
                )
            comments = comm_resp.json().get("data", [])

            # Deduplicazione: prende gli id già salvati per questo post
            existing_comm = sb.table("post_comments").select("ig_comment_id").eq("ig_media_id", media_id).execute()
            existing_comm_ids = {r["ig_comment_id"] for r in (existing_comm.data or [])}

            new_comments = [c for c in comments if c.get("id") and c["id"] not in existing_comm_ids]
            if new_comments:
                sb.table("post_comments").insert([{
                    "client_id":      client_id,
                    "ig_media_id":    media_id,
                    "ig_comment_id":  c["id"],
                    "text":           c.get("text", ""),
                    "timestamp":      c.get("timestamp"),
                } for c in new_comments]).execute()
        except Exception:
            pass  # commenti opzionali — non bloccano il sync


# ──────────────────────────────────────────────
# Step 1b — Snapshot mensili (gira dopo il sync)
# ──────────────────────────────────────────────

def run_monthly_snapshots():
    """Ricalcola e salva gli snapshot mensili per tutti i clienti con metriche."""
    log("▶ Snapshot mensili — avvio")
    try:
        from tools.supabase_client import get_client as get_sb
        from datetime import date

        sb = get_sb()
        if not sb:
            log("✗ Snapshot — Supabase non disponibile")
            return

        # Clienti con metriche
        resp = sb.table("post_metrics").select("client_id").execute()
        client_ids = list({r["client_id"] for r in (resp.data or [])})

        count = 0
        for client_id in client_ids:
            try:
                _compute_snapshots_for_client(client_id, sb)
                count += 1
            except Exception as e:
                log(f"  ✗ snapshot {client_id}: {e}")

        log(f"✓ Snapshot mensili completati — {count} clienti aggiornati")
    except Exception as e:
        log(f"✗ Snapshot mensili falliti: {e}")


def _compute_snapshots_for_client(client_id: str, sb):
    """Calcola gli aggregati mese per mese per un cliente e li salva."""
    from datetime import date

    resp = sb.table("post_metrics").select("*").eq("client_id", client_id).execute()
    rows = resp.data or []
    if not rows:
        return

    # Raggruppa per mese
    by_month: dict = {}
    for r in rows:
        pub = r.get("published_at", "")
        if not pub or len(pub) < 7:
            continue
        month = pub[:7]  # YYYY-MM
        by_month.setdefault(month, [])
        by_month[month].append(r)

    for month, posts in by_month.items():
        n = len(posts)
        avg_likes    = round(sum(p.get("likes", 0) for p in posts) / n, 1)
        avg_reach    = round(sum(p.get("reach", 0) for p in posts) / n, 1)
        avg_saves    = round(sum(p.get("saves", 0) for p in posts) / n, 1)
        avg_comments = round(sum(p.get("comments", 0) for p in posts) / n, 1)

        pillar_agg: dict = {}
        for p in posts:
            pl = p.get("pillar") or "Sin pilar"
            pillar_agg.setdefault(pl, {"posts": 0, "avg_reach": 0, "_reach_sum": 0})
            pillar_agg[pl]["posts"] += 1
            pillar_agg[pl]["_reach_sum"] += p.get("reach", 0)
        for pl in pillar_agg:
            n_pl = pillar_agg[pl]["posts"]
            pillar_agg[pl]["avg_reach"] = round(pillar_agg[pl]["_reach_sum"] / n_pl, 1)
            del pillar_agg[pl]["_reach_sum"]

        sb.table("metrics_monthly").upsert({
            "client_id":    client_id,
            "month":        month,
            "total_posts":  n,
            "avg_likes":    avg_likes,
            "avg_reach":    avg_reach,
            "avg_saves":    avg_saves,
            "avg_comments": avg_comments,
            "by_pillar":    pillar_agg,
            "updated_at":   datetime.now(timezone.utc).isoformat(),
        }, on_conflict="client_id,month").execute()


# ──────────────────────────────────────────────
# Step 2 — Market Researcher
# ──────────────────────────────────────────────

def run_market_research():
    """Aggiorna la ricerca di mercato per tutti i clienti con task in coda."""
    log("▶ Market Researcher — avvio")
    try:
        from agents.market_researcher import MarketResearcher
        researcher = MarketResearcher()
        count = 0
        while researcher.run_from_queue(force=False):
            count += 1
        log(f"✓ Market Researcher completato — {count} task eseguiti")
    except Exception as e:
        log(f"✗ Market Researcher fallito: {e}")


# ──────────────────────────────────────────────
# Step 3 — Metrics Analyst
# ──────────────────────────────────────────────

def run_metrics_analyst():
    """Genera il report metriche per tutti i clienti con dati."""
    log("▶ Metrics Analyst — avvio")
    try:
        from agents.metrics_analyst import MetricsAnalyst
        from tools.supabase_client import get_client as get_sb

        sb = get_sb()
        if not sb:
            log("✗ Metrics Analyst — Supabase non disponibile")
            return

        # Clienti che hanno metriche registrate
        resp = sb.table("post_metrics").select("client_id").execute()
        client_ids = list({r["client_id"] for r in (resp.data or [])})

        if not client_ids:
            log("○ Metrics Analyst — nessun dato disponibile")
            return

        analyst = MetricsAnalyst()
        count   = 0
        for client_id in client_ids:
            try:
                result = analyst.run(client_id=client_id, days=90)
                if result.get("ok"):
                    # Salva il report in metrics_reports
                    sb.table("metrics_reports").upsert({
                        "client_id":      client_id,
                        "report":         result["report"],
                        "posts_analyzed": result.get("posts_analyzed", 0),
                        "generated_at":   datetime.now(timezone.utc).isoformat(),
                    }, on_conflict="client_id").execute()
                    count += 1
                    log(f"  ✓ {client_id} — {result.get('posts_analyzed', 0)} posts analizzati")
            except Exception as e:
                log(f"  ✗ {client_id}: {e}")

        log(f"✓ Metrics Analyst completato — {count} report generati")
    except Exception as e:
        log(f"✗ Metrics Analyst fallito: {e}")


# ──────────────────────────────────────────────
# Step 4 — Strategist
# ──────────────────────────────────────────────

def run_strategist():
    """Genera il piano editoriale della settimana per tutti i clienti in coda."""
    log("▶ Strategist — avvio")
    try:
        from agents.strategist import Strategist
        strategist = Strategist()
        count = 0
        while strategist.run_from_queue():
            count += 1
        log(f"✓ Strategist completato — {count} piani generati")
    except Exception as e:
        log(f"✗ Strategist fallito: {e}")


# ──────────────────────────────────────────────
# Loop principale
# ──────────────────────────────────────────────

def should_run(job_name: str, now: datetime) -> bool:
    s = SCHEDULE[job_name]
    return now.hour == s["hour"] and now.minute < s["minute"] + SLEEP_MINUTES


def main():
    if not ENABLED:
        log("⏸  Night Worker in pausa — imposta NIGHT_WORKER_ENABLED=true per attivare")
        # Rimane in vita ma non fa nulla (Railway non lo considera crashed)
        while True:
            time.sleep(3600)

    log("🌙 Night Worker attivo — polling ogni " + str(SLEEP_MINUTES) + " minuti")

    last_run: dict = {}

    while True:
        now = datetime.now(timezone.utc)
        date_key = now.strftime("%Y-%m-%d")

        for job_name, fn in [
            ("sync_instagram",    run_sync_instagram),
            ("monthly_snapshots", run_monthly_snapshots),
            ("market_research",   run_market_research),
            ("metrics_analyst",   run_metrics_analyst),
            ("strategist",        run_strategist),
        ]:
            run_key = f"{date_key}_{job_name}"
            if run_key not in last_run and should_run(job_name, now):
                fn()
                last_run[run_key] = True

        time.sleep(SLEEP_MINUTES * 60)


if __name__ == "__main__":
    main()
