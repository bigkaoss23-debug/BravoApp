"""
generate_preview.py — Pipeline completo DaKady® Content Production

Uso:
    venv/bin/python generate_preview.py --photo ../02_TEMPLATES_CANVA/IG_STORIES/28.png \\
                                         --brief "visita tecnica Chema, pimiento extragrande BRAVERIA"

Pipeline:
  1. Claude genera 5 varianti di copy (headline + body + caption differenti)
  2. Designer Agent (Pillow) renderizza ogni variante con il layout suggerito da Claude
  3. HTML di review: 5 card → clic su una → pannello destro aggiorna con quella caption
"""

import os, sys, argparse, json
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

load_dotenv(dotenv_path=ROOT / ".env")

from tools.pipeline import generate_variants, photo_thumb_b64

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
IDEOGRAM_KEY  = os.getenv("IDEOGRAM_API_KEY", "")
OUTPUT_HTML   = ROOT / "dakady_preview.html"

NUM_VARIANTS  = 5


# ─────────────────────────────────────────────────────────────────
# HTML builder
# ─────────────────────────────────────────────────────────────────

def build_html(variants: list, photo_b64: str) -> str:
    """
    variants: list of dicts with keys:
      img_b64, headline, body, caption, pillar, format, platform,
      layout_variant, logo_position, idx
    """

    # ── Cards ───────────────────────────────────────────────────
    cards_html = ""
    captions_json = {}

    for v in variants:
        i       = v["idx"]
        variant = v["layout_variant"]
        label_map = {
            "bottom-left":  "↙ Bottom Left",
            "bottom-right": "↘ Bottom Right",
            "bottom-full":  "↓ Bottom Full",
            "top-left":     "↖ Top Left",
            "top-right":    "↗ Top Right",
            "center":       "⊙ Center",
        }
        label = label_map.get(variant, variant)

        # Store data for JS panel update
        captions_json[i] = {
            "headline":  v["headline"],
            "body":      v["body"] or "",
            "caption":   v["caption"],
            "pillar":    v["pillar"],
            "format":    v["format"],
            "platform":  v["platform"],
            "layout":    variant,
        }

        cards_html += f"""
        <div class="variant-card" data-idx="{i}" onclick="selectCard(this, {i})">
          <div class="card-header">
            <span class="variant-num">Opción {i+1}</span>
            <span class="variant-layout">{label}</span>
          </div>
          <div class="img-wrap">
            <img src="data:image/jpeg;base64,{v['img_b64']}" alt="Variante {i+1}" loading="lazy">
          </div>
          <div class="card-headline">{v['headline']}</div>
          <div class="card-footer">
            <button class="btn-select">Seleccionar esta</button>
          </div>
        </div>"""

    captions_js = json.dumps(captions_json, ensure_ascii=False)

    # ── First variant info (default) ────────────────────────────
    first = variants[0]
    first_caption_escaped = first["caption"].replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DaKady® — Content Review</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{
    background: #0a0a0a;
    font-family: 'Libre Franklin', sans-serif;
    color: #fff;
    min-height: 100vh;
  }}

  /* ── Header ── */
  .top-bar {{
    background: #111; border-bottom: 1px solid #1e1e1e;
    padding: 14px 28px;
    display: flex; align-items: center; gap: 12px;
    position: sticky; top: 0; z-index: 10;
  }}
  .kd-dot {{
    width: 30px; height: 30px; background: #C0392B; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 700;
  }}
  .top-bar h1 {{
    font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 600;
    letter-spacing: 3px; color: #666; text-transform: uppercase;
  }}
  .top-bar .sep {{ color: #2a2a2a; font-size: 18px; }}
  .top-bar .client {{ color: #C0392B; font-size: 14px; font-weight: 700; }}
  .top-bar .count {{
    margin-left: auto;
    font-size: 11px; color: #444; letter-spacing: 1px; text-transform: uppercase;
  }}

  /* ── Page layout ── */
  .page {{ display: flex; height: calc(100vh - 57px); }}

  /* ── Left panel: cards ── */
  .cards-panel {{
    flex: 1; overflow-y: auto; padding: 24px 20px;
  }}
  .cards-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 18px;
  }}

  /* ── Card ── */
  .variant-card {{
    background: #141414; border: 2px solid #1e1e1e;
    border-radius: 10px; overflow: hidden;
    cursor: pointer;
    transition: border-color .2s, transform .15s, box-shadow .2s;
  }}
  .variant-card:hover {{
    border-color: #333; transform: translateY(-2px);
  }}
  .variant-card.active {{
    border-color: #C0392B;
    box-shadow: 0 0 0 3px #C0392B22;
  }}
  .card-header {{
    padding: 9px 13px; border-bottom: 1px solid #1e1e1e;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .variant-num {{
    font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 700;
    color: #C0392B; letter-spacing: 1px; text-transform: uppercase;
  }}
  .variant-layout {{
    font-size: 10px; color: #444; letter-spacing: 0.5px;
    text-transform: uppercase;
  }}
  .img-wrap {{ line-height: 0; }}
  .img-wrap img {{ width: 100%; display: block; }}

  .card-headline {{
    padding: 10px 13px 4px;
    font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 700;
    color: #ddd; text-transform: uppercase; letter-spacing: 0.5px;
    line-height: 1.25;
  }}
  .card-footer {{ padding: 10px 13px 13px; }}
  .btn-select {{
    width: 100%; padding: 8px;
    background: transparent; border: 1px solid #2a2a2a;
    color: #555; border-radius: 6px;
    font-family: 'Libre Franklin', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: 1px;
    text-transform: uppercase; cursor: pointer;
    transition: all .2s;
  }}
  .btn-select:hover {{ border-color: #C0392B; color: #C0392B; }}
  .variant-card.active .btn-select {{
    background: #C0392B; border-color: #C0392B; color: #fff;
  }}

  /* ── Right panel: info ── */
  .info-panel {{
    width: 320px; flex-shrink: 0;
    background: #0e0e0e; border-left: 1px solid #1a1a1a;
    overflow-y: auto; padding: 22px 20px;
    display: flex; flex-direction: column; gap: 22px;
  }}
  .section-label {{
    font-family: 'Oswald', sans-serif; font-size: 9px; font-weight: 600;
    letter-spacing: 3px; color: #333; text-transform: uppercase;
    margin-bottom: 10px; padding-bottom: 6px;
    border-bottom: 1px solid #1a1a1a;
  }}

  #panel-headline {{
    font-family: 'Oswald', sans-serif; font-size: 20px; font-weight: 700;
    color: #fff; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.3px;
  }}
  #panel-body {{
    font-size: 13px; color: #666; line-height: 1.5; margin-top: 6px;
  }}

  .meta-row {{ display: flex; flex-wrap: wrap; gap: 6px; }}
  .chip {{
    display: inline-flex; align-items: center; gap: 5px;
    background: #161616; border: 1px solid #222; border-radius: 5px;
    padding: 4px 9px; font-size: 11px; color: #777;
  }}
  .chip strong {{ color: #ccc; font-weight: 600; }}

  #panel-caption {{
    background: #121212; border: 1px solid #1e1e1e; border-radius: 8px;
    padding: 14px; font-size: 12px; color: #777; line-height: 1.7;
    white-space: pre-wrap; word-break: break-word;
  }}

  .photo-thumb {{ border-radius: 8px; overflow: hidden; line-height: 0; }}
  .photo-thumb img {{ width: 100%; border-radius: 8px; }}

  /* scrollbars */
  ::-webkit-scrollbar {{ width: 4px; }}
  ::-webkit-scrollbar-track {{ background: transparent; }}
  ::-webkit-scrollbar-thumb {{ background: #222; border-radius: 4px; }}
</style>
</head>
<body>

<div class="top-bar">
  <div class="kd-dot">KD</div>
  <h1>Content Review</h1>
  <span class="sep">—</span>
  <span class="client">DaKady®</span>
  <span class="count">{NUM_VARIANTS} variantes generadas por Claude</span>
</div>

<div class="page">

  <!-- CARDS -->
  <div class="cards-panel">
    <div class="cards-grid">
      {cards_html}
    </div>
  </div>

  <!-- INFO PANEL -->
  <div class="info-panel">

    <div>
      <div class="section-label">Contenido seleccionado</div>
      <div id="panel-headline">{first["headline"]}</div>
      <div id="panel-body">{first["body"] or ""}</div>
    </div>

    <div>
      <div class="section-label">Metadatos</div>
      <div class="meta-row">
        <div class="chip">Pilar <strong id="panel-pillar">{first["pillar"]}</strong></div>
        <div class="chip">Formato <strong id="panel-format">{first["format"]}</strong></div>
        <div class="chip">Layout <strong id="panel-layout">{first["layout_variant"]}</strong></div>
      </div>
    </div>

    <div>
      <div class="section-label">Caption completa</div>
      <div id="panel-caption">{first_caption_escaped}</div>
    </div>

    <div>
      <div class="section-label">Foto original</div>
      <div class="photo-thumb">
        <img src="data:image/jpeg;base64,{photo_b64}" alt="Foto">
      </div>
    </div>

  </div>
</div>

<script>
const DATA = {captions_js};

function selectCard(el, idx) {{
  document.querySelectorAll('.variant-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  const d = DATA[idx];
  document.getElementById('panel-headline').textContent = d.headline;
  document.getElementById('panel-body').textContent     = d.body;
  document.getElementById('panel-pillar').textContent   = d.pillar;
  document.getElementById('panel-format').textContent   = d.format;
  document.getElementById('panel-layout').textContent   = d.layout;
  document.getElementById('panel-caption').innerHTML    = d.caption
    .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
}}

// Select first card on load
document.addEventListener('DOMContentLoaded', () => {{
  const first = document.querySelector('.variant-card');
  if (first) first.classList.add('active');
}});
</script>
</body>
</html>"""
    return html


# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DaKady® Content Preview Generator")
    parser.add_argument("--photo",    required=True)
    parser.add_argument("--brief",    required=True)
    parser.add_argument("--format",   default="Post 1:1",
                        choices=["Post 1:1", "Story 9:16", "Carosello", "Portada Reel"])
    parser.add_argument("--platform", default="Instagram",
                        choices=["Instagram", "Facebook", "LinkedIn"])
    args = parser.parse_args()

    photo_path = str(Path(args.photo).resolve())
    if not os.path.exists(photo_path):
        print(f"❌ Foto non trovata: {photo_path}")
        sys.exit(1)

    print(f"\n🎨 DaKady® Content Preview Generator")
    print(f"   📷 Foto:    {photo_path}")
    print(f"   📝 Brief:   {args.brief}")
    print(f"   📐 Formato: {args.format}\n")

    # Pipeline condiviso: Claude + Designer
    rendered_variants, _response = generate_variants(
        anthropic_key=ANTHROPIC_KEY,
        photo_path=photo_path,
        brief=args.brief,
        platform=args.platform,
        content_format=args.format,
        num_variants=NUM_VARIANTS,
        ideogram_key=IDEOGRAM_KEY,
    )

    photo_b64 = photo_thumb_b64(photo_path, size=500, quality=75)

    # HTML specifico di questo script (review interna compatta)
    print(f"\n📄 Step 3 — Costruzione HTML di review...", flush=True)
    html = build_html(rendered_variants, photo_b64)
    OUTPUT_HTML.write_text(html, encoding="utf-8")
    print(f"   ✓ Salvato: {OUTPUT_HTML}")
    print(f"\n✅ Apri: http://localhost:3333/dakady_preview.html\n")


if __name__ == "__main__":
    main()
