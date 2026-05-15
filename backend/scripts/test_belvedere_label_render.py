"""
Test mirato: etiqueta_titulo con label separata → render PNG corretto.

Verifica il fix BUG #4 end-to-end:
  CopyAgent (label+headline) → _save_proposal_row (label in jsonb)
  → finalize_post (legge label) → renderer (label oro + headline crema)

Lanciare: cd backend && python scripts/test_belvedere_label_render.py
"""
from __future__ import annotations
import base64, os, sys, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env", override=True)

CID = "c7ff1063-a4d0-4168-a68a-b0704ce3dee0"
PHOTO = "/Users/bigart/Downloads/Gemini_Generated_Image_ux65k0ux65k0ux65.png"
OUT = ROOT / "scripts" / "_renders"
OUT.mkdir(exist_ok=True)


def main():
    from agents.copy_agent import CopyAgent
    from agents.brief_composer import compose
    from agents.art_director import ArtDirector
    from tools.supabase_client import get_client
    from tools.pipeline_v2_studio import _save_proposal_row, finalize_post

    sb = get_client()
    bk = sb.table("client_brand").select("brand_kit_opus").eq("client_id", CID).limit(1).execute().data[0]["brand_kit_opus"]
    slot = {"pillar": "EXPERIENCIA ÍNTIMA", "angle": "La Mañana en Belvedere",
            "persona": "La Pareja en Pausa", "scheduled_date": "2026-06-12", "format": "Post 1:1"}
    brief = compose(slot, bk)

    print("→ CopyAgent · etiqueta_titulo")
    copy = CopyAgent().run(brief=brief, archetype="etiqueta_titulo")
    label = copy.get("label", "")
    headline = copy.get("headline", "")
    print(f"   label    = {label!r}")
    print(f"   headline = {headline!r}")

    print("\n→ Salvo proposta (label in pipeline_decisions.copy_agent)")
    cid = _save_proposal_row(
        client_id=CID, proposal_set_id=str(uuid.uuid4()),
        archetype="etiqueta_titulo", headline=headline, caption=copy.get("caption", ""),
        hashtags=copy.get("hashtags", []), pillar=slot["pillar"], format="Post 1:1",
        plan_slot_id=None, critic_score=0.9, critic_risk="low", critic_comment="(test)",
        critic_rank=1, position_hint="bottom-left", color_hint="warm",
        whisper=copy.get("whisper", ""), headline_alt=copy.get("headline_alt", ""),
        label=label, brief_text=brief.get("brief", "") or "",
    )
    print(f"   content_id = {cid}")

    # Verifica che label sia davvero nel jsonb
    row = sb.table("generated_content").select("pipeline_decisions").eq("content_id", cid).limit(1).execute().data[0]
    saved_label = (row.get("pipeline_decisions") or {}).get("copy_agent", {}).get("label")
    print(f"   ✓ label in DB jsonb = {saved_label!r}")

    print("\n→ finalize_post · render")
    res = finalize_post(content_id=cid, art_director=ArtDirector(),
                        brand_kit_opus=bk, photo_path=PHOTO, scene_description="")
    print(f"   render_error = {res.get('render_error') or 'None'}")

    img_b64 = res.get("img_b64")
    if img_b64:
        path = OUT / f"belvedere_label_{cid[:8]}.png"
        path.write_bytes(base64.b64decode(img_b64))
        print(f"\n💾 PNG: {path}")
    print("\n✅ Test label end-to-end completo")


if __name__ == "__main__":
    main()
