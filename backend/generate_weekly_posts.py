"""
generate_weekly_posts.py — Genera post con WEEKLY BRIEFING + brief quotidiano

Uso:
    venv/bin/python generate_weekly_posts.py \
        --photo "02_TEMPLATES_CANVA/IG_STORIES/28.png" \
        --daily-brief "Camilo ha visitado una serra en Almería" \
        --briefing "WEEKLY_BRIEFING_SOSTENIBILIDAD.md" \
        --output demo_weekly.html

Questo script:
1. Legge WEEKLY_BRIEFING.md (tema, partners, ángulos narrativi della settimana)
2. Combina con il brief quotidiano (foto specifica + dettagli del giorno)
3. Passa il tutto a Claude — il brand context è già nel system prompt
4. Genera 5 post COERENTI sul tema della settimana
"""

import os, sys, argparse, json
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

load_dotenv(dotenv_path=ROOT / ".env")

from tools.pipeline import generate_variants, photo_thumb_b64

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
NUM_VARIANTS  = 5


def main():
    parser = argparse.ArgumentParser(
        description="Genera post con Knowledge Base + Weekly Briefing coerente"
    )
    parser.add_argument("--photo",        required=True, help="Percorso della foto")
    parser.add_argument("--briefing",     required=True, help="File briefing settimanale (es. WEEKLY_BRIEFING_SOSTENIBILIDAD.md)")
    parser.add_argument("--daily-brief",  required=True, help="Brief quotidiano specifico")
    parser.add_argument("--output",       default="demo_weekly.html", help="File HTML output")
    parser.add_argument("--format",       default="Post 1:1",         help="Formato (es. 'Post 1:1', 'Story 9:16')")
    parser.add_argument("--num-contents", type=int, default=5,        help="Numero di varianti (default: 5)")
    args = parser.parse_args()

    photo_path = Path(args.photo)
    if not photo_path.exists():
        print(f"❌ Foto non trovata: {args.photo}")
        sys.exit(1)

    output_path = ROOT / args.output

    print("🎨 DaKady® Weekly Post Generator (v2.0)")
    print(f"   📷 Foto:     {args.photo}")
    print(f"   📋 Briefing: {args.briefing}")
    print(f"   📝 Brief diario: {args.daily_brief}\n")

    # Pipeline condiviso: Claude + Designer (briefing_file viene letto e unito nel pipeline)
    variants, _response = generate_variants(
        anthropic_key=ANTHROPIC_KEY,
        photo_path=str(photo_path.resolve()),
        brief=args.daily_brief,
        platform="Instagram",
        content_format=args.format,
        num_variants=args.num_contents,
        briefing_file=ROOT / args.briefing,
    )

    photo_b64 = photo_thumb_b64(str(photo_path.resolve()))

    # HTML specifico di questo script (review BRAVO con Instagram preview + copy)
    print(f"\n📄 Costruzione HTML demo...", flush=True)
    html = build_demo_html(variants, photo_b64, args.daily_brief)
    output_path.write_text(html, encoding="utf-8")
    print(f"   ✓ Salvato: {output_path}")
    print(f"\n✅ Demo settimanale pronta!\n")


def build_demo_html(variants: list, photo_b64: str, brief: str) -> str:
    """
    Interfaccia BRAVO completa:
    - Griglia di card con immagine composita
    - Pannello laterale con il post Instagram completo (caption) pronto da copiare
    - agent_notes collassabile per capire il ragionamento di Claude
    - Bottone "Copia caption" per workflow rapido
    """
    # Serializza tutti i dati per JavaScript
    data = {}
    for v in variants:
        caption_escaped  = v['caption'].replace('\\', '\\\\').replace('`', '\\`')
        notes_escaped    = v['agent_notes'].replace('\\', '\\\\').replace('`', '\\`')
        data[v['idx']] = {
            "img":      v['img_b64'],
            "headline": v['headline'],
            "body":     v['body'],
            "caption":  caption_escaped,
            "notes":    notes_escaped,
            "pillar":   v['pillar'],
            "format":   v['format'],
            "layout":   v['layout_variant'],
            "platform": v['platform'],
        }
    data_js = json.dumps(data, ensure_ascii=False)

    # Card HTML — una per variante
    cards = ""
    for v in variants:
        i = v['idx']
        active = "active" if i == 0 else ""
        cards += f"""
      <div class="card {active}" data-idx="{i}" onclick="selectCard(this, {i})">
        <img src="data:image/jpeg;base64,{v['img_b64']}" alt="Opción {i+1}">
        <div class="card-meta">
          <span class="card-num">Opción {i+1}</span>
          <span class="card-pillar">{v['pillar']}</span>
        </div>
        <div class="card-hl">{v['headline'][:60]}{'…' if len(v['headline']) > 60 else ''}</div>
        <div class="card-layout">{v['layout_variant']} · {v['platform']}</div>
      </div>"""

    # Caption del primo post (default panel)
    first = variants[0]
    first_caption_html = first['caption'].replace('\n', '<br>')
    first_notes_html   = first['agent_notes'].replace('\n', '<br>') if first['agent_notes'] else "—"

    brief_short = brief[:200] + ('…' if len(brief) > 200 else '')

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DaKady® — BRAVO Content Review</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
:root {{
  --red: #C0392B; --dark: #0C0C0C; --card-bg: #141414;
  --border: #1E1E1E; --text: #E0E0E0; --muted: #777;
}}
body {{ background: var(--dark); color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; min-height: 100vh; }}

/* NAV */
nav {{ position: sticky; top:0; z-index:100; background:#0c0c0cee; backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border); padding:14px 32px;
  display:flex; align-items:center; justify-content:space-between; }}
.nav-logo {{ font-weight:700; color:#fff; font-size:15px; }}
.nav-logo span {{ color: var(--red); }}
.nav-sub {{ font-size:11px; color:#444; letter-spacing:1px; text-transform:uppercase; }}

/* BRIEF BAR */
.brief-bar {{ background:#111; border-bottom:1px solid var(--border); padding:10px 32px;
  font-size:12px; color:var(--muted); }}
.brief-bar strong {{ color:#aaa; }}

/* LAYOUT: cards left, panel right */
.workspace {{ display:grid; grid-template-columns: 380px 1fr; min-height: calc(100vh - 96px); }}

/* CARDS COLUMN */
.cards-col {{ border-right:1px solid var(--border); overflow-y:auto; padding:20px 16px; }}
.col-title {{ font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:14px; padding-left:4px; }}
.card {{ border-radius:8px; border:2px solid transparent; background:var(--card-bg);
  cursor:pointer; margin-bottom:12px; overflow:hidden; transition:border-color .15s; }}
.card:hover {{ border-color:#333; }}
.card.active {{ border-color: var(--red); }}
.card img {{ width:100%; aspect-ratio:1; object-fit:cover; display:block; }}
.card-meta {{ display:flex; justify-content:space-between; align-items:center; padding:10px 12px 4px; }}
.card-num {{ font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; }}
.card-pillar {{ font-size:10px; background:#222; color:#aaa; padding:2px 8px; border-radius:10px; }}
.card-hl {{ padding:0 12px 6px; font-size:13px; font-weight:600; color:#ddd; line-height:1.3; }}
.card-layout {{ padding:0 12px 12px; font-size:11px; color:var(--muted); }}

/* PANEL */
.panel {{ padding:32px 40px; overflow-y:auto; }}
.panel-header {{ display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; gap:16px; }}
.panel-title {{ font-size:20px; font-weight:700; color:#fff; line-height:1.3; }}
.panel-badges {{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }}
.badge {{ font-size:10px; background:#1a1a1a; border:1px solid #333; color:#aaa; padding:3px 10px; border-radius:12px; text-transform:uppercase; letter-spacing:.5px; }}
.badge.red {{ border-color:var(--red); color:var(--red); }}

/* POST PREVIEW (simula schermata Instagram) */
.ig-preview {{ background:#111; border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:24px; }}
.ig-header {{ display:flex; align-items:center; gap:10px; margin-bottom:14px; }}
.ig-avatar {{ width:36px; height:36px; border-radius:50%; background:var(--red);
  display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:#fff; }}
.ig-account {{ font-size:13px; font-weight:600; color:#fff; }}
.ig-handle {{ font-size:11px; color:var(--muted); }}
.ig-image-wrap {{ border-radius:8px; overflow:hidden; margin-bottom:16px; max-width:420px; }}
.ig-image-wrap img {{ width:100%; display:block; }}
.ig-caption {{ font-size:13px; line-height:1.7; color:#ccc; white-space:pre-line; }}

/* CAPTION BOX */
.caption-box {{ background:#111; border:1px solid var(--border); border-radius:10px; margin-bottom:20px; }}
.caption-box-header {{ display:flex; justify-content:space-between; align-items:center;
  padding:14px 18px; border-bottom:1px solid var(--border); }}
.caption-box-header span {{ font-size:12px; font-weight:600; color:#aaa; text-transform:uppercase; letter-spacing:1px; }}
.copy-btn {{ background:var(--red); color:#fff; border:none; padding:7px 18px;
  border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:opacity .15s; }}
.copy-btn:hover {{ opacity:.85; }}
.copy-btn.copied {{ background:#27ae60; }}
.caption-text {{ padding:18px; font-size:13px; line-height:1.8; color:#ccc;
  white-space:pre-line; font-family:'Courier New', monospace; }}

/* NOTES */
.notes-toggle {{ background:none; border:1px solid #333; color:var(--muted);
  padding:8px 16px; border-radius:6px; font-size:12px; cursor:pointer; width:100%; text-align:left;
  margin-bottom:8px; display:flex; justify-content:space-between; }}
.notes-toggle:hover {{ border-color:#555; color:#aaa; }}
.notes-body {{ background:#0d0d0d; border:1px solid #222; border-radius:8px;
  padding:16px; font-size:12px; color:#888; line-height:1.7; display:none; margin-bottom:20px; }}
.notes-body.open {{ display:block; }}
</style>
</head>
<body>

<nav>
  <div class="nav-logo">Da<span>Kady</span>® <span style="color:#444;font-weight:400;font-size:12px;margin-left:12px;">BRAVO Content Review</span></div>
  <div class="nav-sub">5 variantes · {variants[0]['platform'] if variants else 'Instagram'}</div>
</nav>

<div class="brief-bar">
  <strong>Brief:</strong> {brief_short}
</div>

<div class="workspace">

  <!-- CARDS -->
  <div class="cards-col">
    <div class="col-title">Selecciona un post</div>
    {cards}
  </div>

  <!-- PANEL -->
  <div class="panel" id="panel">
    <div class="panel-header">
      <div>
        <div class="panel-title" id="p-headline">{first['headline']}</div>
        <div class="panel-badges">
          <span class="badge red" id="p-pillar">{first['pillar']}</span>
          <span class="badge" id="p-format">{first['format']}</span>
          <span class="badge" id="p-layout">{first['layout_variant']}</span>
        </div>
      </div>
    </div>

    <!-- Instagram preview -->
    <div class="ig-preview">
      <div class="ig-header">
        <div class="ig-avatar">KD</div>
        <div>
          <div class="ig-account">dakadygs</div>
          <div class="ig-handle">@dakadygs · Instagram</div>
        </div>
      </div>
      <div class="ig-image-wrap">
        <img id="p-img" src="data:image/jpeg;base64,{first['img_b64']}" alt="Post">
      </div>
      <div class="ig-caption" id="p-ig-caption">{first_caption_html}</div>
    </div>

    <!-- Caption copiable -->
    <div class="caption-box">
      <div class="caption-box-header">
        <span>Caption completa para Instagram</span>
        <button class="copy-btn" onclick="copyCaption()">Copiar</button>
      </div>
      <div class="caption-text" id="p-caption">{first['caption']}</div>
    </div>

    <!-- Agent notes -->
    <button class="notes-toggle" onclick="toggleNotes()">
      <span>¿Por qué este layout? — Razonamiento de Claude</span>
      <span id="notes-arrow">▼</span>
    </button>
    <div class="notes-body" id="notes-body">
      <div id="p-notes">{first_notes_html}</div>
    </div>

  </div>
</div>

<script>
const DATA = {data_js};

function selectCard(el, idx) {{
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const d = DATA[idx];
  document.getElementById('p-headline').textContent    = d.headline;
  document.getElementById('p-pillar').textContent      = d.pillar;
  document.getElementById('p-format').textContent      = d.format;
  document.getElementById('p-layout').textContent      = d.layout;
  document.getElementById('p-img').src                 = 'data:image/jpeg;base64,' + d.img;
  document.getElementById('p-ig-caption').innerHTML    = d.caption.replace(/\\n/g, '<br>');
  document.getElementById('p-caption').textContent     = d.caption;
  document.getElementById('p-notes').innerHTML         = d.notes.replace(/\\n/g, '<br>') || '—';
  // Reset copy button
  const btn = document.querySelector('.copy-btn');
  btn.textContent = 'Copiar'; btn.classList.remove('copied');
  // Close notes
  document.getElementById('notes-body').classList.remove('open');
  document.getElementById('notes-arrow').textContent = '▼';
}}

function copyCaption() {{
  const text = document.getElementById('p-caption').textContent;
  navigator.clipboard.writeText(text).then(() => {{
    const btn = document.querySelector('.copy-btn');
    btn.textContent = '✓ Copiado'; btn.classList.add('copied');
    setTimeout(() => {{ btn.textContent = 'Copiar'; btn.classList.remove('copied'); }}, 2500);
  }});
}}

function toggleNotes() {{
  const body  = document.getElementById('notes-body');
  const arrow = document.getElementById('notes-arrow');
  body.classList.toggle('open');
  arrow.textContent = body.classList.contains('open') ? '▲' : '▼';
}}
</script>

</body>
</html>"""


if __name__ == "__main__":
    main()
