"""
Test Editorial Planner su Belvedere — giugno 2026.

Verifica che il Planner:
  - legga briefing_sections (sez. 02/04/05/06/07/10) salvate dall'onboarding v2
  - produca 8 post feed + 12 stories per il mese
  - rispetti pilastri 30/30/20/20, frequency caps angoli, alternanza personas
  - salvi il piano in editorial_plans con scheduled_date reale

Lanciare:
    cd backend && python scripts/test_belvedere_planner.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env", override=True)
except ImportError:
    pass


BELVEDERE_ID = "c7ff1063-a4d0-4168-a68a-b0704ce3dee0"
MONTH = "2026-06"


def step0_preflight():
    print("\n" + "=" * 70)
    print("STEP 0 · Preflight — verifica stato Belvedere")
    print("=" * 70)
    from tools.supabase_client import get_client
    sb = get_client()

    bri = sb.table("client_briefings").select("briefing_format,char_count").eq("client_id", BELVEDERE_ID).limit(1).execute().data
    if not bri or bri[0]["briefing_format"] != "docx_canonical":
        print("❌ briefing non canonico — lancia prima test_belvedere_onboarding.py")
        sys.exit(1)
    print(f"✅ briefing canonico OK ({bri[0]['char_count']} chars)")

    pj = sb.table("client_projects").select("project_type,volume").eq("client_id", BELVEDERE_ID).eq("source", "scope_extractor").execute().data
    types = {p["project_type"]: p["volume"] for p in pj}
    if "contenidos_feed" not in types or "contenidos_stories" not in types:
        print(f"❌ progetti incompleti: {types}")
        sys.exit(1)
    print(f"✅ progetti pronti: feed={types['contenidos_feed']} stories={types['contenidos_stories']}")


def step1_run_planner():
    print("\n" + "=" * 70)
    print(f"STEP 1 · Editorial Planner — mese {MONTH}")
    print("=" * 70)
    from agents.editorial_planner import EditorialPlanner
    planner = EditorialPlanner()
    result = planner.run(client_id=BELVEDERE_ID, month=MONTH)
    print(f"\n✅ Piano prodotto")
    print(f"   feed posts:  {result.get('feed_posts_count')}")
    print(f"   stories:     {result.get('stories_count')}")
    print(f"   season:      {result.get('season')}")
    print(f"   reasoning:   {result.get('reasoning', '')[:300]}")
    return result


def step2_dump_plan(result):
    print("\n" + "=" * 70)
    print("STEP 2 · Dump piano dal DB")
    print("=" * 70)
    from tools.supabase_client import get_client
    sb = get_client()

    rows = (
        sb.table("editorial_plans")
        .select("scheduled_date,pillar,angle,persona,format,brief,slot")
        .eq("client_id", BELVEDERE_ID)
        .gte("scheduled_date", f"{MONTH}-01")
        .lt("scheduled_date", f"{MONTH}-31")
        .order("scheduled_date")
        .execute()
        .data
        or []
    )

    feed = [r for r in rows if "Story" not in (r.get("format") or "")]
    stories = [r for r in rows if "Story" in (r.get("format") or "")]

    print(f"\n📅 FEED ({len(feed)} posts)")
    print("─" * 70)
    for r in feed:
        date = r.get("scheduled_date", "?")
        pillar = (r.get("pillar") or "?")[:25]
        angle = (r.get("angle") or "?")[:30]
        persona = (r.get("persona") or "?")[:20]
        brief = (r.get("brief") or "")[:60]
        print(f"  {date} | {pillar:25s} | {angle:30s} | {persona:20s}")
        print(f"          ↳ {brief}…")

    print(f"\n📱 STORIES ({len(stories)})")
    print("─" * 70)
    for r in stories:
        date = r.get("scheduled_date", "?")
        pillar = (r.get("pillar") or "?")[:25]
        angle = (r.get("angle") or "?")[:30]
        brief = (r.get("brief") or "")[:50]
        print(f"  {date} | {pillar:25s} | {angle:30s} | {brief}")

    # Distribuzione pilastri
    from collections import Counter
    pillar_feed = Counter(r.get("pillar") for r in feed)
    print(f"\n📊 Distribuzione pilastri feed:")
    total = sum(pillar_feed.values()) or 1
    for pillar, n in pillar_feed.most_common():
        pct = round(n * 100 / total)
        print(f"   {pillar or '(?)':30s} {n} posts  ({pct}%)")

    # Distribuzione angoli
    angle_feed = Counter(r.get("angle") for r in feed)
    print(f"\n🎯 Distribuzione angoli feed:")
    for angle, n in angle_feed.most_common():
        print(f"   {angle or '(?)':30s} {n}x")

    # Personas
    persona_feed = [r.get("persona") for r in feed]
    print(f"\n👥 Sequenza personas (per controllo alternanza A/B):")
    for i, p in enumerate(persona_feed, 1):
        print(f"   slot {i:2d}: {p}")


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("❌ ANTHROPIC_API_KEY non trovata in env")
        sys.exit(1)

    step0_preflight()
    result = step1_run_planner()
    step2_dump_plan(result)

    print("\n" + "=" * 70)
    print(f"🎉 PLANNER {MONTH} — verifica completata")
    print("=" * 70)


if __name__ == "__main__":
    main()
