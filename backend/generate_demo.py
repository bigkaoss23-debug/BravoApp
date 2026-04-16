"""
generate_demo.py — Genera una demo HTML da inviare al cliente

Crea una pagina di presentazione professionale con:
  - Spiegazione del workflow AI
  - 5 varianti reali generate da Claude + Pillow
  - Layout da pitch deck, inviabile via email o link

Uso:
    venv/bin/python generate_demo.py \
        --photo "../02_TEMPLATES_CANVA/IG_STORIES/28.png" \
        --brief "visita tecnica Chema, pimiento extragrande, BRAVERIA fase arranque" \
        --output demo_dakady.html
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
NUM_VARIANTS  = 5


def build_demo_html(variants: list, photo_b64: str, brief: str) -> str:

    # ── Cards HTML ──────────────────────────────────────────────
    cards = ""
    for v in variants:
        i = v["idx"]
        cards += f"""
        <div class="post-card" onclick="pick(this, {i})">
          <div class="card-num">Opción {i+1}</div>
          <img class="card-img" src="data:image/jpeg;base64,{v['img_b64']}" alt="Opción {i+1}">
          <div class="card-hl">{v['headline']}</div>
          <div class="card-tag">{v['layout_variant']}</div>
        </div>"""

    # ── Captions JSON for panel ─────────────────────────────────
    _data = {str(v['idx']): {
        "headline": v['headline'],
        "body":     v['body'],
        "caption":  v['caption'],
        "pillar":   v['pillar'],
        "layout":   v['layout_variant'],
    } for v in variants}
    data_js = json.dumps(_data, ensure_ascii=False)

    first = variants[0]
    first_caption_html = first['caption'].replace('\n', '<br>')

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DaKady® × BRAVO — AI Content System</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
:root {{
  --red:   #C0392B;
  --dark:  #0C0C0C;
  --card:  #141414;
  --line:  #1E1E1E;
  --muted: #555;
  --text:  #E8E8E8;
}}
html {{ scroll-behavior: smooth; }}
body {{
  background: var(--dark);
  color: var(--text);
  font-family: 'Libre Franklin', sans-serif;
  font-size: 15px;
  line-height: 1.6;
}}

/* ── NAV ── */
nav {{
  position: sticky; top: 0; z-index: 100;
  background: #0c0c0cee; backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 48px;
}}
.nav-logo {{
  display: flex; align-items: center; gap: 10px;
}}
.kd {{
  width: 28px; height: 28px; background: var(--red); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
}}
.nav-brand {{
  font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 600;
  letter-spacing: 3px; color: var(--muted); text-transform: uppercase;
}}
.nav-by {{
  font-size: 11px; color: #333;
  letter-spacing: 1px; text-transform: uppercase;
}}
.nav-by span {{ color: var(--red); }}

/* ── HERO ── */
.hero {{
  padding: 96px 48px 80px;
  max-width: 960px; margin: 0 auto;
  text-align: center;
}}
.hero-eyebrow {{
  display: inline-block;
  font-size: 10px; font-weight: 700; letter-spacing: 3px;
  color: var(--red); text-transform: uppercase;
  border: 1px solid #C0392B33; border-radius: 4px;
  padding: 4px 12px; margin-bottom: 28px;
}}
.hero h1 {{
  font-family: 'Oswald', sans-serif;
  font-size: clamp(36px, 5vw, 60px);
  font-weight: 700; line-height: 1.05;
  letter-spacing: -0.5px; text-transform: uppercase;
  color: #fff; margin-bottom: 22px;
}}
.hero h1 em {{ color: var(--red); font-style: normal; }}
.hero-sub {{
  font-size: 17px; color: var(--muted); max-width: 580px; margin: 0 auto 48px;
  line-height: 1.7;
}}
.hero-brief {{
  display: inline-block;
  background: #161616; border: 1px solid var(--line);
  border-radius: 8px; padding: 14px 24px;
  font-size: 13px; color: #666;
  text-align: left; max-width: 560px; width: 100%;
}}
.hero-brief strong {{ color: #aaa; display: block; margin-bottom: 4px;
  font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }}

/* ── SECTION ── */
section {{ padding: 80px 48px; max-width: 1100px; margin: 0 auto; }}
.section-label {{
  font-size: 9px; font-weight: 700; letter-spacing: 3px;
  color: var(--muted); text-transform: uppercase;
  margin-bottom: 12px;
}}
.section-title {{
  font-family: 'Oswald', sans-serif;
  font-size: clamp(24px, 3vw, 36px); font-weight: 700;
  text-transform: uppercase; color: #fff;
  margin-bottom: 14px; line-height: 1.1;
}}
.section-desc {{
  font-size: 15px; color: var(--muted); max-width: 560px;
  line-height: 1.7; margin-bottom: 48px;
}}

/* ── FLOW ── */
.flow {{
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 2px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
}}
.flow-step {{
  background: #111; padding: 32px 28px;
  border-right: 1px solid var(--line);
  position: relative;
}}
.flow-step:last-child {{ border-right: none; }}
.step-num {{
  font-family: 'Oswald', sans-serif;
  font-size: 48px; font-weight: 700; color: #1a1a1a;
  line-height: 1; margin-bottom: 16px;
}}
.step-icon {{
  font-size: 22px; margin-bottom: 12px; display: block;
}}
.step-title {{
  font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 1px; color: #ccc;
  margin-bottom: 8px;
}}
.step-desc {{ font-size: 13px; color: var(--muted); line-height: 1.6; }}
.step-arrow {{
  position: absolute; right: -14px; top: 50%;
  transform: translateY(-50%);
  width: 28px; height: 28px; background: var(--dark); border: 1px solid var(--line);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--muted); z-index: 1;
}}

/* ── DIVIDER ── */
.divider {{
  height: 1px; background: var(--line);
  margin: 0 48px;
}}

/* ── RESULTS SECTION ── */
.results-section {{
  padding: 80px 48px;
  max-width: 1400px; margin: 0 auto;
}}

/* ── POSTS STRIP ── */
.posts-strip {{
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 32px;
}}
@media (max-width: 900px) {{
  .posts-strip {{ grid-template-columns: repeat(2, 1fr); }}
  nav {{ padding: 14px 24px; }}
  section, .results-section {{ padding: 60px 24px; }}
  .hero {{ padding: 60px 24px; }}
  .flow {{ grid-template-columns: 1fr; }}
  .flow-step {{ border-right: none; border-bottom: 1px solid var(--line); }}
  .step-arrow {{ display: none; }}
}}

.post-card {{
  background: var(--card); border: 2px solid var(--line);
  border-radius: 10px; overflow: hidden;
  cursor: pointer; transition: border-color .2s, transform .15s;
}}
.post-card:hover {{ border-color: #383838; transform: translateY(-3px); }}
.post-card.selected {{
  border-color: var(--red);
  box-shadow: 0 0 0 3px #C0392B1a;
}}
.card-num {{
  padding: 8px 12px;
  font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 700;
  color: var(--red); letter-spacing: 1px; text-transform: uppercase;
  border-bottom: 1px solid var(--line);
}}
.card-img {{ width: 100%; display: block; line-height: 0; }}
.card-hl {{
  padding: 10px 12px 4px;
  font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 700;
  color: #bbb; text-transform: uppercase; line-height: 1.2;
}}
.card-tag {{
  padding: 4px 12px 10px;
  font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 0.5px;
}}

/* ── CAPTION PANEL ── */
.caption-panel {{
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 24px; background: #101010;
  border: 1px solid var(--line); border-radius: 12px;
  padding: 28px; margin-top: 8px;
}}
.panel-left h3 {{
  font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700;
  text-transform: uppercase; color: #fff; margin-bottom: 6px; line-height: 1.2;
}}
.panel-left .body-text {{
  font-size: 13px; color: var(--muted); margin-bottom: 16px;
}}
.panel-meta {{
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px;
}}
.meta-chip {{
  background: #181818; border: 1px solid #222; border-radius: 5px;
  padding: 4px 10px; font-size: 11px; color: #666;
}}
.meta-chip strong {{ color: #bbb; }}
.panel-label {{
  font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
  color: #333; margin-bottom: 8px; font-weight: 700;
}}
.caption-text {{
  font-size: 13px; color: #777; line-height: 1.75;
  background: #0c0c0c; border: 1px solid var(--line);
  border-radius: 8px; padding: 16px;
  max-height: 240px; overflow-y: auto;
}}

/* ── FOOTER ── */
footer {{
  border-top: 1px solid var(--line);
  padding: 32px 48px;
  display: flex; align-items: center; justify-content: space-between;
}}
.footer-brand {{
  font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600;
  letter-spacing: 2px; color: #333; text-transform: uppercase;
}}
.footer-brand span {{ color: var(--red); }}
.footer-note {{
  font-size: 11px; color: #2a2a2a;
  letter-spacing: 1px; text-transform: uppercase;
}}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <div class="nav-logo">
    <div class="kd">KD</div>
    <div class="nav-brand">DaKady® Content AI</div>
  </div>
  <div class="nav-by">Desarrollado por <span>BRAVO Studio</span></div>
</nav>

<!-- HERO -->
<div class="hero">
  <div class="hero-eyebrow">Sistema de Producción de Contenido</div>
  <h1>Tu foto.<br>5 posts listos<br>en <em>30 segundos.</em></h1>
  <p class="hero-sub">
    Un sistema de inteligencia artificial diseñado exclusivamente para DaKady®.
    Convierte cada visita técnica, cada producto y cada resultado en contenido
    publicable para Instagram, Facebook y LinkedIn.
  </p>
  <div class="hero-brief">
    <strong>Brief utilizado en esta demo</strong>
    {brief}
  </div>
</div>

<div class="divider"></div>

<!-- WORKFLOW -->
<section>
  <div class="section-label">Cómo funciona</div>
  <div class="section-title">Tres pasos.<br>Cero trabajo manual.</div>
  <p class="section-desc">
    El fotógrafo sube la foto y escribe un brief en español. El sistema hace el resto.
  </p>

  <div class="flow">
    <div class="flow-step">
      <div class="step-num">01</div>
      <span class="step-icon">📷</span>
      <div class="step-title">Foto + Brief</div>
      <div class="step-desc">El fotógrafo o técnico sube la foto del día y escribe un par de líneas sobre lo que ocurrió en campo.</div>
      <div class="step-arrow">→</div>
    </div>
    <div class="flow-step">
      <div class="step-num">02</div>
      <span class="step-icon">🤖</span>
      <div class="step-title">Claude AI genera</div>
      <div class="step-desc">La IA crea 5 variantes de copy distintas — headline, body, caption completa con hashtags — respetando el tono y la identidad de DaKady®.</div>
      <div class="step-arrow">→</div>
    </div>
    <div class="flow-step">
      <div class="step-num">03</div>
      <span class="step-icon">✅</span>
      <div class="step-title">BRAVO elige y publica</div>
      <div class="step-desc">El equipo revisa las 5 opciones, selecciona la mejor y la publica directamente. Sin editar nada. Sin esperar.</div>
    </div>
  </div>
</section>

<div class="divider"></div>

<!-- RESULTS -->
<div class="results-section">
  <div class="section-label">Resultado de esta demo</div>
  <div class="section-title">5 opciones generadas.<br>Elige la mejor.</div>
  <p class="section-desc">
    Cada opción tiene un ángulo narrativo diferente: resultado técnico, producto, equipo, pregunta viral...
    Claude decide el layout más adecuado para cada texto según la composición de la foto.
  </p>

  <div class="posts-strip">
    {cards}
  </div>

  <div class="caption-panel">
    <div class="panel-left">
      <div class="panel-label">Contenido seleccionado</div>
      <h3 id="p-headline">{first['headline']}</h3>
      <div class="body-text" id="p-body">{first['body']}</div>
      <div class="panel-meta">
        <div class="meta-chip">Pilar <strong id="p-pillar">{first['pillar']}</strong></div>
        <div class="meta-chip">Layout <strong id="p-layout">{first['layout_variant']}</strong></div>
      </div>
      <div class="panel-label">Caption lista para publicar</div>
      <div class="caption-text" id="p-caption">{first_caption_html}</div>
    </div>
    <div class="panel-right">
      <div class="panel-label">Foto original del fotógrafo</div>
      <img src="data:image/jpeg;base64,{photo_b64}" style="width:100%; border-radius:8px; display:block;">
    </div>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <div class="footer-brand">DaKady® × <span>BRAVO Studio</span></div>
  <div class="footer-note">Powered by Claude AI · Anthropic</div>
</footer>

<script>
const DATA = {data_js};

function pick(el, idx) {{
  document.querySelectorAll('.post-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const d = DATA[idx];
  document.getElementById('p-headline').textContent = d.headline;
  document.getElementById('p-body').textContent     = d.body || '';
  document.getElementById('p-pillar').textContent   = d.pillar;
  document.getElementById('p-layout').textContent   = d.layout || '';
  document.getElementById('p-caption').innerHTML    =
    d.caption.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
  document.querySelector('.caption-panel').scrollIntoView({{behavior:'smooth', block:'nearest'}});
}}

document.addEventListener('DOMContentLoaded', () => {{
  const first = document.querySelector('.post-card');
  if (first) first.classList.add('selected');
}});
</script>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--photo",    required=True)
    parser.add_argument("--brief",    required=True)
    parser.add_argument("--format",   default="Post 1:1",
                        choices=["Post 1:1", "Story 9:16", "Carosello", "Portada Reel"])
    parser.add_argument("--platform", default="Instagram",
                        choices=["Instagram", "Facebook", "LinkedIn"])
    parser.add_argument("--output",   default="demo_dakady.html")
    args = parser.parse_args()

    photo_path = str(Path(args.photo).resolve())
    output_path = ROOT / args.output

    print(f"\n🎨 DaKady® Demo Generator")
    print(f"   📷 Foto:  {photo_path}")
    print(f"   📝 Brief: {args.brief}\n")

    # Pipeline condiviso: Claude + Designer
    variants, _response = generate_variants(
        anthropic_key=ANTHROPIC_KEY,
        photo_path=photo_path,
        brief=args.brief,
        platform=args.platform,
        content_format=args.format,
        num_variants=NUM_VARIANTS,
        ideogram_key=IDEOGRAM_KEY,
    )

    photo_b64 = photo_thumb_b64(photo_path)

    # HTML specifico di questo script (pitch-deck per il cliente)
    print(f"\n📄 Costruzione HTML demo...", flush=True)
    html = build_demo_html(variants, photo_b64, args.brief)
    output_path.write_text(html, encoding="utf-8")
    print(f"   ✓ Salvato: {output_path}")
    print(f"\n✅ Demo pronta! Apri: http://localhost:3333/{args.output}\n")


if __name__ == "__main__":
    main()
