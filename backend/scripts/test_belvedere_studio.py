"""
Test Studio v2 (propose_post) su Belvedere — slot del 12 giugno 2026.

Pipeline:
  1. Recupera slot del 12 giugno da editorial_plans
  2. Recupera brand_kit_opus + seasonal_context
  3. Lancia propose_post → 3 finalisti (archetipi diversi)
  4. Stampa i 3 finalisti per scelta umana

NIENTE render finale qui — solo le 3 proposte. Bravo sceglie, poi
finalize_post chiamato in un secondo step.

Lanciare:
    cd backend && python scripts/test_belvedere_studio.py
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
SCHEDULED_DATE = "2026-06-12"  # La Mañana en Belvedere — EXPERIENCIA ÍNTIMA
PHOTO_PATH = "/Users/bigart/Downloads/Gemini_Generated_Image_ux65k0ux65k0ux65.png"


def get_slot():
    from tools.supabase_client import get_client
    sb = get_client()
    res = (
        sb.table("editorial_plans")
        .select("*")
        .eq("client_id", BELVEDERE_ID)
        .eq("scheduled_date", SCHEDULED_DATE)
        .eq("format", "Post 1:1")
        .limit(1)
        .execute()
    )
    if not res.data:
        print(f"❌ Slot non trovato per {SCHEDULED_DATE}")
        sys.exit(1)
    slot = res.data[0]
    # Aggiungi persona se manca (route_plan non l'ha salvata in DB)
    slot.setdefault("persona", "La Pareja en Pausa")
    return slot


def get_brand_kit():
    from tools.supabase_client import get_client
    sb = get_client()
    res = sb.table("client_brand").select("brand_kit_opus").eq("client_id", BELVEDERE_ID).limit(1).execute()
    if not res.data:
        return {}
    return res.data[0].get("brand_kit_opus") or {}


def get_seasonal():
    from tools.briefing_store import get_briefing
    from tools.seasonality import get_seasonal_context
    brand_kit = get_brand_kit()
    return get_seasonal_context(brand_kit, month_num=6)


def main():
    if not Path(PHOTO_PATH).exists():
        print(f"❌ Foto non trovata: {PHOTO_PATH}")
        sys.exit(1)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("❌ ANTHROPIC_API_KEY mancante")
        sys.exit(1)

    print("=" * 70)
    print(f"STUDIO V2 · slot {SCHEDULED_DATE} · Belvedere")
    print("=" * 70)

    slot = get_slot()
    print(f"\nSlot recuperato:")
    print(f"  pillar:  {slot.get('pillar')}")
    print(f"  angle:   {slot.get('angle')}")
    print(f"  format:  {slot.get('format')}")
    print(f"  brief:   {(slot.get('brief') or '')[:200]}")

    brand_kit = get_brand_kit()
    print(f"\nBrand kit Opus: {len(brand_kit)} chiavi top-level")

    season = get_seasonal()
    print(f"Stagionalità giugno: {season.get('season_level')} — {(season.get('mood') or '')[:80]}")

    # Istanzia agenti
    from agents.copy_agent import CopyAgent
    from agents.layout_selector import LayoutSelector
    from tools.tone_validator import ToneValidator

    print("\n→ Istanzio agenti…")
    copy_agent = CopyAgent()
    layout_selector = LayoutSelector()
    tone_validator = ToneValidator()

    # Chiamata propose_post
    from tools.pipeline_v2_studio import propose_post

    print("\n→ Lancio propose_post (può richiedere 30-60s)…\n")
    result = propose_post(
        client_id=BELVEDERE_ID,
        slot=slot,
        photo_path=PHOTO_PATH,
        brand_kit_opus=brand_kit,
        copy_agent=copy_agent,
        layout_selector=layout_selector,
        tone_validator=tone_validator,
        seasonal_context=season,
        scene_description="",
    )

    print("\n" + "=" * 70)
    print(f"🎯 3 FINALISTI (proposal_set_id: {result.get('proposal_set_id')})")
    print("=" * 70)

    for i, p in enumerate(result.get("proposals", []), 1):
        print(f"\n┌─── FINALISTA {i} · archetipo: {p.get('archetype')}")
        if p.get('label'):
            print(f"│  LABEL:       {p.get('label')}")
        print(f"│  HEADLINE:    {p.get('headline')}")
        if p.get('headline_alt'):
            print(f"│  alt:         {p.get('headline_alt')}")
        if p.get('whisper'):
            print(f"│  WHISPER:     {p.get('whisper')}")
        print(f"│")
        print(f"│  CAPTION:     {(p.get('caption') or '')[:200]}")
        print(f"│")
        print(f"│  position:    {p.get('position_hint')}")
        print(f"│  color:       {p.get('color_hint')}")
        print(f"│")
        print(f"│  CRITIC:")
        print(f"│    voice_score:     {p.get('critic_voice_score')}")
        print(f"│    repetition_risk: {p.get('critic_repetition_risk')}")
        print(f"│    comment:         {p.get('critic_comment')}")
        print(f"│    rank:            {p.get('critic_rank')}")
        print(f"└─── content_id: {p.get('content_id')}")

    print("\n" + "=" * 70)
    print("✅ 3 finalisti generati. Pari grado.")
    print("Scegli quale finalizzare e renderizzare.")
    print("=" * 70)

    # Salva il risultato in un file per riferimento
    out = ROOT / "scripts" / "_last_proposals.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    print(f"\n💾 Risultato completo salvato in {out}")


if __name__ == "__main__":
    main()
