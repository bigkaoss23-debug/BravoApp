"""
Finalize del finalista 🅐 round 4 (etiqueta_titulo "07:50 · El desayuno todavía espera").

Chiude l'end-to-end Belvedere:
  briefing → progetti → piano → studio (3 finalisti) → SCELTA → PNG finale

Lanciare:
    cd backend && python scripts/test_belvedere_finalize.py
"""
from __future__ import annotations

import os
import sys
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env", override=True)
except ImportError:
    pass


BELVEDERE_ID = "c7ff1063-a4d0-4168-a68a-b0704ce3dee0"
PHOTO_PATH = "/Users/bigart/Downloads/Gemini_Generated_Image_ux65k0ux65k0ux65.png"
CHOSEN_CONTENT_ID = "f572ca68-0ce6-4c80-b54e-d457e4af9ce8"  # 🅐 round 4 · etiqueta_titulo
OUT_DIR = ROOT / "scripts" / "_renders"
OUT_DIR.mkdir(exist_ok=True)


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("❌ ANTHROPIC_API_KEY mancante")
        sys.exit(1)
    if not Path(PHOTO_PATH).exists():
        print(f"❌ Foto non trovata: {PHOTO_PATH}")
        sys.exit(1)

    print("=" * 70)
    print(f"FINALIZE · Belvedere · content_id {CHOSEN_CONTENT_ID[:8]}…")
    print("=" * 70)

    # Carica brand kit
    from tools.supabase_client import get_client
    sb = get_client()
    res = sb.table("client_brand").select("brand_kit_opus").eq("client_id", BELVEDERE_ID).limit(1).execute()
    brand_kit = (res.data[0].get("brand_kit_opus") or {}) if res.data else {}
    print(f"✓ Brand kit caricato ({len(brand_kit)} chiavi)")

    # Istanzia Art Director
    from agents.art_director import ArtDirector
    art_director = ArtDirector()
    print("✓ Art Director istanziato")

    # Chiama finalize_post
    from tools.pipeline_v2_studio import finalize_post
    print("\n→ Chiamo finalize_post (ArtDirector + Renderer)…\n")

    try:
        result = finalize_post(
            content_id=CHOSEN_CONTENT_ID,
            art_director=art_director,
            brand_kit_opus=brand_kit,
            photo_path=PHOTO_PATH,
            scene_description="",
        )
    except Exception as e:
        print(f"❌ finalize_post fallito: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    print("\n" + "=" * 70)
    print("RISULTATO")
    print("=" * 70)
    print(f"  archetype:    {result.get('archetype')}")
    print(f"  headline:     {result.get('headline')}")
    print(f"  caption:      {(result.get('caption') or '')[:120]}…")
    print(f"  image_url:    {result.get('image_url') or '(non caricato su Storage)'}")
    print(f"  render_error: {result.get('render_error') or 'None'}")

    # Salva PNG localmente per ispezione visiva
    img_b64 = result.get("img_b64")
    if img_b64:
        local_path = OUT_DIR / f"belvedere_finalized_{CHOSEN_CONTENT_ID[:8]}.png"
        local_path.write_bytes(base64.b64decode(img_b64))
        print(f"\n💾 PNG salvato localmente: {local_path}")
        print(f"   Aprilo per vedere il render finale.")
    else:
        print(f"\n⚠ Nessun img_b64 nel risultato")

    print("\n" + "=" * 70)
    print("✅ End-to-end Belvedere completo: briefing → progetti → piano → studio → PNG")
    print("=" * 70)


if __name__ == "__main__":
    main()
