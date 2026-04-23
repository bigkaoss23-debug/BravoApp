"""
pipeline.py — Logica condivisa tra generate_demo.py, generate_preview.py,
generate_weekly_posts.py.

Elimina la duplicazione del flusso Claude → Designer (Pillow) → dict pronti
per HTML. Ogni script CLI conserva il proprio HTML template (demo pitch-deck,
preview interna, weekly review BRAVO) ma condivide TUTTA la parte di elaborazione.
"""

import base64
import io
import uuid
from pathlib import Path
from typing import Optional

from agents.content_designer import ContentDesignerAgent
from agents.designer import composite
from models.content import GenerateContentRequest, Platform, ContentFormat


# =============================================================================
# Utility
# =============================================================================

def img_to_b64(pil_image, quality: int = 84) -> str:
    """Converte un PIL.Image in base64 JPEG."""
    buf = io.BytesIO()
    pil_image.convert("RGB").save(buf, "JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()


_storage_bucket_ready = False

def upload_image_to_storage(pil_image, client_id: str, idx: int) -> Optional[str]:
    """
    Carica l'immagine su Supabase Storage bucket 'bravo-content'.
    Restituisce l'URL pubblico, oppure None se fallisce (il chiamante usa base64 come fallback).
    """
    global _storage_bucket_ready
    from tools.supabase_client import get_client
    sb = get_client()
    if sb is None:
        return None
    try:
        # Crea bucket una volta sola se non esiste
        if not _storage_bucket_ready:
            try:
                sb.storage.create_bucket("bravo-content", options={"public": True})
            except Exception:
                pass  # Già esistente è ok
            _storage_bucket_ready = True

        buf = io.BytesIO()
        pil_image.convert("RGB").save(buf, "JPEG", quality=84)
        img_bytes = buf.getvalue()
        filename = f"{client_id}/{uuid.uuid4().hex}_{idx}.jpg"
        sb.storage.from_("bravo-content").upload(filename, img_bytes, {"content-type": "image/jpeg"})
        url = sb.storage.from_("bravo-content").get_public_url(filename)
        print(f"   ☁️  Storage OK: {filename}")
        return url
    except Exception as e:
        print(f"   ⚠️  Storage upload fallito, uso base64: {e}")
        return None


def photo_thumb_b64(photo_path: str, size: int = 700, quality: int = 80) -> str:
    """Genera una thumbnail base64 della foto originale."""
    from PIL import Image as PILImage
    img = PILImage.open(photo_path)
    thumb = img.copy()
    thumb.thumbnail((size, size))
    return img_to_b64(thumb, quality=quality)


# =============================================================================
# Briefing (weekly merge)
# =============================================================================

def load_weekly_briefing(briefing_path: Path) -> str:
    """Legge un file di briefing settimanale. Stringa vuota se non trovato."""
    if not briefing_path.exists():
        print(f"⚠️  Briefing settimanale non trovato: {briefing_path}")
        return ""
    return briefing_path.read_text()


def build_enhanced_brief(daily_brief: str, weekly_briefing: str) -> str:
    """Combina briefing settimanale + brief quotidiano in un solo prompt utente."""
    if not weekly_briefing:
        return daily_brief
    return f"""
=== BRIEFING SETTIMANALE (TEMA + PARTNERS + ÁNGULOS) ===
{weekly_briefing}

---

=== BRIEF QUOTIDIANO DI OGGI ===
{daily_brief}

---

=== TUA MISSIONE ===
Genera varianti coerenti che:
1. SIGUE EL TEMA SEMANAL: coerenza con tema, puntos técnicos y ángulos del briefing.
2. MENCIONA SOLO PARTNERS EN FOCO: solo quelli specificati nel briefing.
3. ÁNGULOS NARRATIVOS: scegli tra gli ángulos disponibili, non inventare altri.
4. DETALLE CONCRETO: includi il brief quotidiano come dettaglio specifico del post.
5. DIVERSIDAD: i post devono essere DIFFERENTI tra loro (pilari, tipi, layout).
"""


# =============================================================================
# Pipeline principale
# =============================================================================

def generate_variants(
    *,
    anthropic_key: str,
    photo_path: str,
    brief: str,
    client_id: str = "",
    platform: str = "Instagram",
    content_format: str = "Post 1:1",
    num_variants: int = 5,
    ideogram_key: Optional[str] = None,
    briefing_file: Optional[Path] = None,
) -> tuple[list[dict], object]:
    """
    Esegue pipeline Claude → Designer e restituisce (variants, raw_response).

    Ogni variant è un dict pronto per essere serializzato in HTML:
      idx, img_b64, headline, body, caption, agent_notes, pillar,
      format, platform, layout_variant.

    raw_response è il GenerateContentResponse completo (per accedere ai
    agent_notes top-level con eventuali errori Ideogram).
    """
    # 1. Eventualmente arricchisci il brief con il briefing settimanale
    if briefing_file is not None:
        weekly = load_weekly_briefing(briefing_file)
        brief = build_enhanced_brief(brief, weekly)

    # 2. Carica brand kit completo
    from tools.brand_store import get_brand_kit
    from pathlib import Path as _Path
    brand_kit = get_brand_kit(client_id)
    logo_b64  = brand_kit.get("logo_b64")

    # brand_kit_opus: fonte primaria per colori, font, tipografia
    # Supporta sia brand_kit_opus (wrapper) sia JSON flat diretto
    opus_raw  = brand_kit.get("brand_kit_opus") or {}
    opus      = opus_raw if opus_raw else brand_kit
    opus_typo = opus.get("typography", {})
    opus_hier = opus.get("text_hierarchy", {})
    _styles   = opus_typo.get("styles", {})

    # ── Colori H1 / H2 / body ───────────────────────────────────────────────
    # Percorso 1: text_hierarchy.on_dark_bg (schema vecchio)
    on_dark = opus_hier.get("on_dark_bg", {})
    headline_color_hex    = (on_dark.get("h1")
                             or _styles.get("headline", {}).get("colors", {}).get("on_dark")
                             or "#FFFFFF")
    headline_color_h2_hex = (on_dark.get("h2")
                             or _styles.get("subheadline", {}).get("colors", {}).get("on_dark")
                             or None)
    body_color_hex        = (on_dark.get("body")
                             or _styles.get("body", {}).get("colors", {}).get("on_dark")
                             or "#E6E6E6")

    # primary_color = colore background_dark (per overlay logo e backdrop)
    primary_color_hex  = "#1C1C1C"
    bg_overlay_hex     = None
    bg_overlay_alpha   = 0.72
    opus_colors = opus.get("colors", {})
    if isinstance(opus_colors, dict):
        for _c in opus_colors.values():
            if _c.get("role") == "background_dark":
                primary_color_hex = _c.get("hex", primary_color_hex)
                bg_overlay_hex    = _c.get("hex")
                bg_overlay_alpha  = float(_c.get("overlay_opacity", 0.72))
                break
    elif isinstance(opus_colors, list):
        for _c in opus_colors:
            if _c.get("role") == "background_dark":
                primary_color_hex = _c.get("hex", primary_color_hex)
                bg_overlay_hex    = _c.get("hex")
                bg_overlay_alpha  = float(_c.get("overlay_opacity", 0.72))
                break

    # ── Uppercase ────────────────────────────────────────────────────────────
    force_uppercase = opus_typo.get("transform", "") == "uppercase"

    # ── Font sizes dal brand kit ─────────────────────────────────────────────
    # Mappa format → chiave nelle sizes del brand kit
    _format_key_map = {
        "Story 9:16":   "story_9x16_px",
        "Portada Reel": "story_9x16_px",
        "Post 1:1":     "square_1x1_px",
        "Carosello":    "square_1x1_px",
        "Landscape":    "landscape_16x9_px",
    }
    _size_key = _format_key_map.get(content_format, "square_1x1_px")

    opus_styles   = _styles  # già calcolato sopra
    # I valori px del brand kit sono per preview ridotta — scala ×2.5 per canvas 1080px reale
    _SCALE = 2.5
    _hl_raw   = (opus_styles.get("headline", {}).get("sizes", {}) or {}).get(_size_key)
    _body_raw = (opus_styles.get("body", {}).get("sizes", {}) or {}).get(_size_key)
    headline_size = int(_hl_raw * _SCALE)   if _hl_raw   else None
    body_size_val = int(_body_raw * _SCALE) if _body_raw else None

    # ── Font file ─────────────────────────────────────────────────────────────
    _assets = _Path(__file__).parent.parent / "assets"
    _font_map = {
        "barlow condensed": str(_assets / "BarlowCondensed-Black.otf"),
        "barlow":           str(_assets / "BarlowCondensed-Black.otf"),
        "oswald":           str(_assets / "Oswald-Bold.ttf"),
        "bebas":            str(_assets / "BebasNeue-Regular.ttf"),
        "libre":            str(_assets / "LibreFranklin.ttf"),
        "montserrat":       str(_assets / "Oswald-Bold.ttf"),
    }

    font_family    = (opus_typo.get("font_family") or "").lower()
    font_headline_path = None
    font_body_path     = None
    for key, path in _font_map.items():
        if key in font_family and _Path(path).exists():
            font_headline_path = path
            # Per body usa la variante Bold se disponibile
            bold_path = path.replace("-Black.otf", "-Bold.otf").replace("-Bold.ttf", "-Bold.ttf")
            font_body_path = bold_path if _Path(bold_path).exists() else path
            break

    # Fallback: leggi dai fonts del brand kit legacy
    if not font_headline_path:
        bk_fonts = brand_kit.get("fonts") or []
        if bk_fonts:
            hl_name = (bk_fonts[0].get("name") or "").lower()
            for key, path in _font_map.items():
                if key in hl_name and _Path(path).exists():
                    font_headline_path = path
                    break

    # 3. Analisi foto — layout compatibili (zero token, pura PIL)
    from tools.photo_analyzer import analyze_photo, pick_layout
    photo_ranked_layouts = analyze_photo(photo_path)
    top4 = photo_ranked_layouts[:4]
    print(f"📸 Layout compatibili con la foto: {top4}", flush=True)

    # Inietta nel brief i layout consigliati per questa foto specifica
    photo_layout_hint = (
        f"\n\nANÁLISIS DE FOTO: zonas más oscuras/libres detectadas. "
        f"Layouts recomendados para ESTA foto (ordenados por legibilidad): {top4}. "
        f"Usa layouts de esta lista. Si generas múltiples variantes, alterna entre ellos."
    )
    brief_with_hint = brief + photo_layout_hint

    # 4. Chiama Claude
    print(f"⚡ Claude genera {num_variants} varianti...", flush=True)
    agent = ContentDesignerAgent(api_key=anthropic_key, ideogram_api_key=ideogram_key)
    request = GenerateContentRequest(
        brief=brief_with_hint,
        client_id=client_id,
        platform=Platform(platform),
        format=ContentFormat(content_format),
        num_contents=num_variants,
        generate_image=False,
    )
    response = agent.run(request)
    contents = response.contents

    # Verifica varietà: se Claude ha scelto layout non nella lista consigliata,
    # sostituisce con il più adatto non ancora usato in questa sessione
    used_in_session: list[str] = []
    for c in contents:
        chosen = c.overlay.layout_variant.value
        if chosen not in top4:
            replacement = pick_layout(photo_path, used_layouts=used_in_session)
            print(f"   ⚠ Layout '{chosen}' non ottimale per foto → rimpiazzato con '{replacement}'")
            from models.content import LayoutVariant
            c.overlay.layout_variant = LayoutVariant(replacement)
        used_in_session.append(c.overlay.layout_variant.value)

    for i, c in enumerate(contents):
        print(f"   [{i+1}] {c.overlay.headline}  [{c.overlay.layout_variant.value}]")

    # 5. Rendering Pillow
    print(f"\n🖼  Designer renderizza {len(contents)} immagini...", flush=True)
    variants: list[dict] = []
    for i, content in enumerate(contents):
        img = composite(
            photo_path=photo_path,
            headline=content.overlay.headline,
            body=content.overlay.body,
            layout_variant=content.overlay.layout_variant.value,
            logo_position=content.overlay.logo_position,
            content_format=content_format,
            label=content.overlay.label,
            subtitle_color=content.overlay.subtitle_color,
            side=content.overlay.side or "left",
            logo_b64=logo_b64,
            primary_color_hex=primary_color_hex,
            headline_color_hex=headline_color_hex,
            body_color_hex=body_color_hex,
            headline_color_h2_hex=headline_color_h2_hex,
            bg_overlay_hex=bg_overlay_hex,
            bg_overlay_alpha=bg_overlay_alpha,
            font_headline_path=font_headline_path,
            font_body_path=font_body_path,
            force_uppercase=force_uppercase,
            headline_size=headline_size,
            body_size_override=body_size_val,
        )
        b64 = img_to_b64(img)          # sempre generato come fallback sicuro
        image_url = upload_image_to_storage(img, client_id, i)
        variants.append({
            "idx":            i,
            "img_b64":        b64,          # base64 sempre presente
            "image_url":      image_url or "",
            "headline":       content.overlay.headline,
            "body":           content.overlay.body or "",
            "caption":        content.caption,
            "agent_notes":    content.agent_notes or "",
            "pillar":         content.pillar.value,
            "format":         content.format.value,
            "platform":       content.platform.value,
            "layout_variant": content.overlay.layout_variant.value,
        })
        print(f"   ✓ Opción {i+1}")

    if response.agent_notes:
        print(f"\n⚠️  Note generali: {response.agent_notes}")

    return variants, response


# =============================================================================
# Pipeline Carosello
# =============================================================================

_CAROUSEL_SVG_LOGO = """<svg viewBox="0 0 200 200" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
  <polyline points="14,186 100,18 186,186" fill="none" stroke="{color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="38,180 100,46 162,180" fill="none" stroke="{color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 72,162 C 58,148 62,132 78,122 C 92,113 112,114 120,128 C 127,140 118,154 105,158 C 92,162 80,154 82,142 C 84,131 96,126 108,130" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"""

_LOGO_POS_CSS = {
    "tl": "top:20px;left:20px;",
    "tr": "top:20px;right:20px;",
    "bl": "bottom:20px;left:20px;",
    "br": "bottom:20px;right:20px;",
}

_TEXT_POS_CSS = {
    "mid": "top:50%;left:0;right:0;transform:translateY(-50%);text-align:center;",
    "bot": "bottom:0;left:0;right:0;",
    "top": "top:0;left:0;right:0;",
}


def _render_carousel_slide(slide: dict, recipe: dict) -> str:
    """Renderizza una singola slide HTML dal dict slide + recipe del brand kit."""
    bg = recipe.get("bg", "#141F2D")
    text_pos = recipe.get("text_pos", "mid")
    logo_pos = recipe.get("logo", "tl")
    logo_color = recipe.get("logo_color", "#C4A06A")
    h1_color = recipe.get("h1_color", "#FFFFFF")
    h2_color = recipe.get("h2_color", "#C4A06A")
    has_pill = recipe.get("has_pill", False)
    has_scroll = recipe.get("has_scroll_hint", False)

    logo_svg = _CAROUSEL_SVG_LOGO.replace("{color}", logo_color)
    logo_css = _LOGO_POS_CSS.get(logo_pos, "top:20px;left:20px;")
    txt_css  = _TEXT_POS_CSS.get(text_pos, "top:50%;left:0;right:0;transform:translateY(-50%);text-align:center;")

    tag      = slide.get("tag", "")
    headline = slide.get("headline", "")
    h2       = slide.get("h2", "")
    sub      = slide.get("sub", "")
    pill     = slide.get("pill_text", "")
    scroll   = slide.get("scroll_hint", "Desliza →") if has_scroll else ""

    tag_html  = f'<div class="tag">{tag}</div>' if tag else ""
    pill_html = f'<div class="pill">{pill}</div>' if has_pill and pill else ""
    scroll_html = f'<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#2A3A4A;margin-top:20px;">{scroll}</div>' if scroll else ""

    return f"""<div class="slide" style="background:{bg};">
  <div class="logo" style="position:absolute;z-index:4;{logo_css}">{logo_svg}</div>
  <div class="txt" style="position:absolute;z-index:4;padding:28px;{txt_css}">
    {tag_html}
    <div class="h1" style="font-size:68px;color:{h1_color};">{headline}<br><span style="color:{h2_color};">{h2}</span></div>
    {"<div class=\"sub\" style=\"font-size:14px;margin-top:12px;\">" + sub + "</div>" if sub else ""}
    {pill_html}
    {scroll_html}
  </div>
</div>"""


def generate_carousel(
    *,
    anthropic_key: str,
    brief: str,
    client_id: str = "",
    num_slides: int = 6,
    topic: str = "",
) -> dict:
    """
    Genera un carosello Instagram completo come HTML.

    Ritorna:
      {
        "carousel_html": "<html completo con slider>",
        "slides": [{"idx", "recipe_id", "headline", "h2", "tag", ...}, ...],
        "caption": "...",
        "error": None
      }
    """
    import anthropic
    import json as _json

    from tools.brand_store import get_brand_kit, get_client_info, build_carousel_system_prompt

    brand_kit   = get_brand_kit(client_id)
    client_info = get_client_info(client_id)
    opus        = brand_kit.get("brand_kit_opus") or {}
    carousel_cfg = opus.get("carousel", {})
    recipes     = carousel_cfg.get("slide_recipes", {})

    system_prompt = build_carousel_system_prompt(brand_kit, client_info, num_slides)

    user_msg = f"""Crea un carosello Instagram di ESATTAMENTE {num_slides} slide per {client_info.get('name', 'Sistema 360*')}.

TEMA / BRIEF: {brief}
{f'ARGOMENTO SPECIFICO: {topic}' if topic else ''}

Ricorda: segui la sequenza INTRO → corpo (variety) → CTA.
Rispetta TUTTE le regole del brand e le ricette slide.
Rispondi SOLO con JSON array valido."""

    try:
        client = anthropic.Anthropic(api_key=anthropic_key)
        response = client.messages.create(
            model="claude-opus-4-7-20251101",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()
        # Estrai JSON (rimuovi eventuali ```json ... ```)
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        slides_data = _json.loads(raw)
    except Exception as e:
        return {"carousel_html": "", "slides": [], "caption": "", "error": str(e)}

    # Costruisci HTML slide
    slides_html = []
    for slide in slides_data:
        rid = slide.get("recipe_id", "body_navy")
        recipe = recipes.get(rid, recipes.get("body_navy", {}))
        if not recipe and recipes:
            recipe = list(recipes.values())[0]
        slides_html.append(_render_carousel_slide(slide, recipe))

    total = len(slides_html)
    slides_joined = "\n".join(slides_html)

    brand_name = opus.get("meta", {}).get("brand_name", client_info.get("name", "Sistema 360*"))
    carousel_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Carosello — {brand_name}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0;}}
body{{background:#0A0E13;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;font-family:'Barlow',sans-serif;}}
.stage{{position:relative;width:420px;height:420px;overflow:hidden;border-radius:12px;box-shadow:0 32px 80px rgba(0,0,0,.7);user-select:none;}}
.track{{display:flex;height:100%;transition:transform .4s cubic-bezier(.4,0,.2,1);}}
.slide{{min-width:420px;height:420px;position:relative;overflow:hidden;flex-shrink:0;}}
.tag{{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#C4A06A;margin-bottom:10px;}}
.h1{{font-family:'Barlow Condensed',sans-serif;font-weight:900;text-transform:uppercase;line-height:.88;}}
.sub{{font-family:'Barlow Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#BCBAB5;margin-top:12px;line-height:1.3;}}
.pill{{display:inline-block;background:#C4A06A;color:#141F2D;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:.1em;padding:8px 18px;border-radius:40px;margin-top:16px;}}
.arr{{position:absolute;top:50%;transform:translateY(-50%);z-index:10;background:rgba(20,31,45,.7);border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;transition:background .2s;backdrop-filter:blur(4px);}}
.arr:hover{{background:rgba(196,160,106,.8);}}
.arr.prev{{left:12px;}} .arr.next{{right:12px;}}
.dots{{display:flex;gap:8px;margin-top:20px;align-items:center;justify-content:center;}}
.dot{{width:6px;height:6px;border-radius:50%;background:#2A3A4A;cursor:pointer;transition:all .25s;}}
.dot.active{{background:#C4A06A;width:20px;border-radius:3px;}}
.counter{{position:absolute;top:16px;right:16px;z-index:10;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.12em;background:rgba(20,31,45,.6);backdrop-filter:blur(4px);color:#BCBAB5;padding:4px 10px;border-radius:20px;}}
</style>
</head>
<body>
<div style="position:relative;">
  <div class="stage" id="stage">
    <div class="track" id="track">
{slides_joined}
    </div>
    <button class="arr prev" onclick="move(-1)">&#8592;</button>
    <button class="arr next" onclick="move(1)">&#8594;</button>
    <div class="counter" id="counter">1 / {total}</div>
  </div>
  <div class="dots" id="dots"></div>
</div>
<script>
const TOTAL={total};let cur=0;
const track=document.getElementById('track'),counter=document.getElementById('counter'),dotsEl=document.getElementById('dots');
for(let i=0;i<TOTAL;i++){{const d=document.createElement('div');d.className='dot'+(i===0?' active':'');d.onclick=()=>goTo(i);dotsEl.appendChild(d);}}
function goTo(n){{cur=Math.max(0,Math.min(TOTAL-1,n));track.style.transform='translateX(-'+(cur*420)+'px)';counter.textContent=(cur+1)+' / '+TOTAL;document.querySelectorAll('.dot').forEach((d,i)=>{{d.className='dot'+(i===cur?' active':'');}});}}
function move(dir){{goTo(cur+dir);}}
document.addEventListener('keydown',e=>{{if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1);}});
let startX=0;const stage=document.getElementById('stage');
stage.addEventListener('pointerdown',e=>{{startX=e.clientX;}});
stage.addEventListener('pointerup',e=>{{const dx=e.clientX-startX;if(Math.abs(dx)>40)move(dx<0?1:-1);}});
</script>
</body>
</html>"""

    # Caption per Instagram
    caption_parts = [slide.get("headline", "") + " " + slide.get("h2", "") for slide in slides_data[:3]]
    caption = " · ".join(p.strip() for p in caption_parts if p.strip())
    caption += f"\n\n#{brand_name.replace(' ', '').replace('*', '')} #fitness #training #sistema360"

    return {
        "carousel_html": carousel_html,
        "slides": slides_data,
        "caption": caption,
        "error": None,
    }
