"""
Designer Agent — Pillow-based compositor for DaKady® social media posts.

Receives: photo path + headline + body text + layout_variant + logo_position
Outputs:  composited PNG with:
          - Photo background
          - Gradient dark overlay (scoped to text area)
          - Bold Bebas Neue headline in white
          - Libre Franklin body text in white
          - KD circle watermark
          - Optional red accent bar
          - Optional subtitle/label in red/orange
          - Optional bullet point formatting

Layout variants (CLASSIC):
  bottom-left   — text block anchored bottom-left
  bottom-right  — text block anchored bottom-right
  bottom-full   — text centered, full width at bottom
  top-left      — text block anchored top-left
  top-right     — text block anchored top-right
  center        — text centered, vertically mid

Layout variants (NEW - DaKady Brand Patterns):
  centered-header       — headline centered with optional label above
  centered-with-logo    — centered layout with logo at top
  asymmetric-left       — text left-aligned, text occupies ~40% width
  asymmetric-right      — text right-aligned, text occupies ~40% width
  product-infographic   — bullet points centered, stats/features focused
  vertical-center       — full-height vertical center with large spacing
"""

import os
import base64
import io
from pathlib import Path
from typing import Optional, List, Dict, Any
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from models.content import LayoutVariant, ContentFormat

# ──────────────────────────────────────────────
# Paths (font assets — condivisi tra tutti i clienti)
# ──────────────────────────────────────────────
ASSETS        = Path(__file__).parent.parent / "assets"
FONT_HEADLINE = str(ASSETS / "BebasNeue-Regular.ttf")
FONT_BODY     = str(ASSETS / "LibreFranklin.ttf")

# Cache loghi decodificati da base64: client_id → PIL Image
_LOGO_CACHE: dict = {}


def _hex_to_rgb(hex_color: str) -> tuple:
    """Converte '#C0392B' in (192, 57, 43)."""
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _load_logo_from_b64(logo_b64: str, primary_color_hex: str = "#C0392B") -> Optional[Image.Image]:
    """
    Decodifica un logo da base64 (PNG/SVG/JPEG).
    Se il logo ha uno sfondo del colore primario del brand, lo rende trasparente.
    """
    cache_key = logo_b64[:64]
    if cache_key in _LOGO_CACHE:
        return _LOGO_CACHE[cache_key]

    try:
        # Rimuovi prefisso data URI se presente
        if "," in logo_b64:
            logo_b64 = logo_b64.split(",", 1)[1]
        raw = base64.b64decode(logo_b64)
        logo = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        return None

    # Key-out del colore primario del brand (sfondo del logo)
    try:
        pr, pg, pb = _hex_to_rgb(primary_color_hex)
        pixels = logo.load()
        w, h = logo.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if abs(r - pr) < 60 and abs(g - pg) < 60 and abs(b - pb) < 60:
                    pixels[x, y] = (r, g, b, 0)
        # Crop al wordmark (top 55%)
        crop_h = int(h * 0.55)
        logo = logo.crop((0, 0, w, crop_h))
    except Exception:
        pass

    _LOGO_CACHE[cache_key] = logo
    return logo

# ──────────────────────────────────────────────
# Brand colours
# ──────────────────────────────────────────────
RED   = (192, 57, 43)       # #C0392B
ORANGE = (255, 127, 80)     # #FF7F50 (coral-orange)
WHITE = (255, 255, 255)
LIGHT_GRAY = (230, 230, 230)
BLACK = (26, 26, 26)        # #1A1A1A
NAVY  = (44, 62, 80)        # #2C3E50

# ──────────────────────────────────────────────
# Canvas sizes
# ──────────────────────────────────────────────
FORMAT_SIZES = {
    "Story 9:16":  (1080, 1920),
    "Post 1:1":    (1080, 1080),
    "Carosello":   (1080, 1080),
    "Portada Reel": (1080, 1920),
}

# Padding in pixels
PAD = 72


def _load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> List[str]:
    """Word-wrap text to fit within max_width pixels."""
    words = text.split()
    lines = []
    current = []
    dummy = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(dummy)

    for word in words:
        test = " ".join(current + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] > max_width and current:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def _text_block_size(lines: List[str], font: ImageFont.FreeTypeFont,
                     line_spacing: int = 8) -> tuple:
    """Return (width, height) of a block of wrapped lines."""
    dummy = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(dummy)
    max_w = 0
    total_h = 0
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        max_w = max(max_w, bbox[2])
        total_h += bbox[3]
        if i < len(lines) - 1:
            total_h += line_spacing
    return max_w, total_h


def _draw_gradient_overlay(img: Image.Image, x: int, y: int,
                            w: int, h: int,
                            start_alpha: int = 0, end_alpha: int = 200) -> None:
    """
    Draw a vertical gradient dark overlay on `img` within the given rectangle.
    Gradient goes from start_alpha (top) to end_alpha (bottom).
    """
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for row in range(h):
        t = row / max(h - 1, 1)
        alpha = int(start_alpha + (end_alpha - start_alpha) * t)
        for col in range(w):
            overlay.putpixel((col, row), (0, 0, 0, alpha))
    img.paste(overlay, (x, y), overlay)


def _draw_gradient_overlay_top(img: Image.Image, x: int, y: int,
                                w: int, h: int,
                                start_alpha: int = 200, end_alpha: int = 0) -> None:
    """Same but top-heavy (for top-left / top-right variants)."""
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for row in range(h):
        t = row / max(h - 1, 1)
        alpha = int(start_alpha + (end_alpha - start_alpha) * t)
        for col in range(w):
            overlay.putpixel((col, row), (0, 0, 0, alpha))
    img.paste(overlay, (x, y), overlay)


def _add_accent_bar(draw: ImageDraw.Draw, x: int, y: int, width: int,
                    color: tuple = RED, height: int = 8) -> None:
    """Draw a bold horizontal accent bar."""
    draw.rectangle([x, y, x + width, y + height], fill=color)


def _add_logo_watermark(img: Image.Image, logo_position: str,
                        canvas_w: int, canvas_h: int,
                        logo: Optional[Image.Image] = None,
                        primary_color_rgb: tuple = (192, 57, 43),
                        wm_size: int = 120) -> None:
    """
    Incolla il logo del brand sull'immagine su un backing colorato semi-trasparente.
    Il logo è SEMPRE visibile indipendentemente dal colore dello sfondo.
    """
    margin = PAD // 2

    if logo is not None:
        # Scala mantenendo proporzioni — altezza fissa 80px
        logo_h = 80
        ratio  = logo_h / logo.size[1]
        logo_w = int(logo.size[0] * ratio)
        logo   = logo.resize((logo_w, logo_h), Image.LANCZOS)

        # Calcola posizione
        positions = {
            "top-center":    ((canvas_w - logo_w) // 2, margin),
            "top-left":      (margin, margin),
            "top-right":     (canvas_w - logo_w - margin, margin),
            "bottom-left":   (margin, canvas_h - logo_h - margin),
            "bottom-right":  (canvas_w - logo_w - margin, canvas_h - logo_h - margin),
            "bottom-center": ((canvas_w - logo_w) // 2, canvas_h - logo_h - margin),
        }
        lx, ly = positions.get(logo_position, positions["top-right"])

        # Backing: pill colorato semi-trasparente — garantisce visibilità sempre
        pad_x, pad_y = 18, 10
        backing = Image.new("RGBA", (logo_w + pad_x * 2, logo_h + pad_y * 2), (0, 0, 0, 0))
        backing_draw = ImageDraw.Draw(backing)
        br, bg, bb = primary_color_rgb
        backing_draw.rounded_rectangle(
            [0, 0, logo_w + pad_x * 2 - 1, logo_h + pad_y * 2 - 1],
            radius=12,
            fill=(br, bg, bb, 210),
        )
        img.paste(backing, (lx - pad_x, ly - pad_y), backing)

        # Logo bianco sopra il backing
        img.paste(logo, (lx, ly), logo)
        return

    # Se nessun logo disponibile, non incolla nulla


def _render_centered_layout(
    canvas: Image.Image,
    draw: ImageDraw.Draw,
    canvas_w: int,
    canvas_h: int,
    headline: str,
    body: Optional[str],
    label: Optional[str],
    font_hl: ImageFont.FreeTypeFont,
    font_body: ImageFont.FreeTypeFont,
    font_label: ImageFont.FreeTypeFont,
) -> None:
    """
    Render CENTERED LAYOUT: Label (optional) → Headline → Body → Footer
    All elements are horizontally centered. Vertical positioning creates hierarchy.
    """
    text_max_w = canvas_w - PAD * 2

    # Wrap text — headline in maiuscolo, body e label in minuscolo (brand DaKady)
    hl_lines    = _wrap_text(headline.upper(), font_hl, text_max_w)
    body_lines  = _wrap_text(body, font_body, text_max_w) if body else []
    label_lines = _wrap_text(label.upper() if label else "", font_label, text_max_w) if label else []

    # Calculate dimensions
    hl_w, hl_h = _text_block_size(hl_lines, font_hl, line_spacing=4)
    body_w, body_h = _text_block_size(body_lines, font_body, line_spacing=6) if body_lines else (0, 0)
    label_w, label_h = _text_block_size(label_lines, font_label, line_spacing=4) if label_lines else (0, 0)

    # Positioning percentages (from top of canvas)
    logo_y_pct = 0.15  # Logo at 15% from top
    label_y_pct = 0.38  # Label at 38% from top
    hl_y_pct = 0.50  # Headline at 50% from top
    body_y_pct = 0.62  # Body at 62% from top
    footer_y_pct = 0.93  # Footer at 93% from top

    # Calculate dark overlay area
    overlay_start = int(canvas_h * 0.30)  # Overlay starts at 30% from top
    overlay_height = int(canvas_h * 0.70)  # Covers 70% of canvas
    _draw_gradient_overlay(canvas, 0, overlay_start, canvas_w, overlay_height,
                          start_alpha=0, end_alpha=220)

    # Helper per centrare una singola riga usando textbbox reale
    _dummy_draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    def _center_x(line: str, font: ImageFont.FreeTypeFont) -> int:
        bbox = _dummy_draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        return max(PAD, (canvas_w - line_w) // 2)

    # Render label if provided (red/orange color)
    if label_lines:
        label_y = int(canvas_h * label_y_pct) - (label_h // 2)
        for line in label_lines:
            x = _center_x(line, font_label)
            draw.text((x + 1, label_y + 1), line, font=font_label, fill=(0, 0, 0, 100))
            draw.text((x, label_y), line, font=font_label, fill=ORANGE)
            bbox = _dummy_draw.textbbox((0, 0), line, font=font_label)
            label_y += (bbox[3] - bbox[1]) + 4

    # Render headline
    hl_y = int(canvas_h * hl_y_pct) - (hl_h // 2)
    for line in hl_lines:
        x = _center_x(line, font_hl)
        draw.text((x + 2, hl_y + 2), line, font=font_hl, fill=(0, 0, 0, 120))
        draw.text((x, hl_y), line, font=font_hl, fill=WHITE)
        bbox = _dummy_draw.textbbox((0, 0), line, font=font_hl)
        hl_y += (bbox[3] - bbox[1]) + 4

    # Render body
    if body_lines:
        body_y = int(canvas_h * body_y_pct)
        for line in body_lines:
            x = _center_x(line, font_body)
            draw.text((x + 1, body_y + 1), line, font=font_body, fill=(0, 0, 0, 100))
            draw.text((x, body_y), line, font=font_body, fill=LIGHT_GRAY)
            bbox = _dummy_draw.textbbox((0, 0), line, font=font_body)
            body_y += (bbox[3] - bbox[1]) + 6


def _render_asymmetric_layout(
    canvas: Image.Image,
    draw: ImageDraw.Draw,
    canvas_w: int,
    canvas_h: int,
    headline: str,
    body: Optional[str],
    side: str,  # "left" or "right"
    font_hl: ImageFont.FreeTypeFont,
    font_body: ImageFont.FreeTypeFont,
) -> None:
    """
    Render ASYMMETRIC LAYOUT: Text on one side, space for photo on other.
    Text positioned at ~45% from top, occupies ~40% width of canvas.
    """
    # Colonna testo = 40% del canvas meno padding
    text_max_w = int(canvas_w * 0.40) - PAD

    # Font ridotto per stare nella colonna stretta
    hl_size_asym = min(int(canvas_w * 0.058), 63)
    font_hl = _load_font(FONT_HEADLINE, hl_size_asym)

    # Wrap text — headline maiuscolo, body minuscolo
    hl_lines   = _wrap_text(headline.upper(), font_hl, text_max_w)
    body_lines = _wrap_text(body, font_body, text_max_w) if body else []

    # Calcola altezze
    _dd = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    hl_w, hl_h = _text_block_size(hl_lines, font_hl, line_spacing=4)

    # Posizione di partenza: adattiva — headline corte partono al 35%, lunghe al 20%
    hl_lines_count = len(hl_lines)
    start_pct = max(0.18, 0.38 - (hl_lines_count * 0.04))
    by = int(canvas_h * start_pct)

    # Spazio disponibile per il body dal fondo dell'headline al bordo inferiore (con margine)
    body_start_y = by + hl_h + 20
    max_body_bottom = canvas_h - PAD * 2
    available_for_body = max_body_bottom - body_start_y

    # Tronca body_lines a quelle che ci stanno nello spazio disponibile
    line_h_body = int(_dd.textbbox((0, 0), "A", font=font_body)[3] + 6)
    max_body_lines = max(1, available_for_body // line_h_body)
    if len(body_lines) > max_body_lines:
        # Taglia alla riga intera — mai a metà frase
        body_lines = body_lines[:max_body_lines]
        # Se l'ultima riga non chiude una frase, la rimuove
        last = body_lines[-1].rstrip()
        if last and last[-1] not in ".!?…":
            body_lines = body_lines[:-1]

    body_w, body_h = _text_block_size(body_lines, font_body, line_spacing=6) if body_lines else (0, 0)
    block_h = hl_h + (body_h + 20 if body_lines else 0)

    # Posizione orizzontale e overlay in base al lato
    if side.lower() == "left":
        bx = PAD
        overlay_x, overlay_w = 0, int(canvas_w * 0.50)
    else:  # right
        bx = canvas_w - text_max_w - PAD
        overlay_x, overlay_w = int(canvas_w * 0.50), int(canvas_w * 0.50)

    # Gradient overlay — copre tutta la colonna testo dall'alto al basso
    _draw_gradient_overlay(canvas, overlay_x, 0, overlay_w, canvas_h,
                          start_alpha=30, end_alpha=200)

    # Render headline
    cy = by
    for line in hl_lines:
        draw.text((bx + 2, cy + 2), line, font=font_hl, fill=(0, 0, 0, 120))
        draw.text((bx, cy), line, font=font_hl, fill=WHITE)
        bbox = _dd.textbbox((0, 0), line, font=font_hl)
        cy += (bbox[3] - bbox[1]) + 4

    # Render body — solo le righe che entrano nel canvas
    if body_lines:
        cy += 20
        for line in body_lines:
            if cy + line_h_body > max_body_bottom:
                break
            draw.text((bx + 1, cy + 1), line, font=font_body, fill=(0, 0, 0, 100))
            draw.text((bx, cy), line, font=font_body, fill=LIGHT_GRAY)
            cy += line_h_body


def _fit_photo(photo_path: str, target_w: int, target_h: int) -> Image.Image:
    """
    Load photo and crop/resize to exactly target_w × target_h (cover fill).
    """
    photo = Image.open(photo_path).convert("RGB")
    pw, ph = photo.size
    tw, th = target_w, target_h

    # Scale to cover
    scale = max(tw / pw, th / ph)
    new_w = int(pw * scale)
    new_h = int(ph * scale)
    photo = photo.resize((new_w, new_h), Image.LANCZOS)

    # Center crop
    left = (new_w - tw) // 2
    top  = (new_h - th) // 2
    photo = photo.crop((left, top, left + tw, top + th))
    return photo


# ──────────────────────────────────────────────
# Main compositor
# ──────────────────────────────────────────────

def composite(
    photo_path: str,
    headline: str,
    body: Optional[str] = None,
    layout_variant: str = "bottom-left",
    logo_position: str = "top-center",
    content_format: str = "Post 1:1",
    output_path: Optional[str] = None,
    label: Optional[str] = None,
    subtitle_color: tuple = ORANGE,
    side: str = "left",
    logo_b64: Optional[str] = None,
    primary_color_hex: str = "#C0392B",
) -> Image.Image:
    """
    Composite un post social con foto + overlay testo + logo brand.
    Funziona per qualsiasi cliente: logo e colore primario vengono passati come argomenti.

    Args:
        logo_b64: Logo del cliente in base64 (da Supabase). Se None, nessun logo.
        primary_color_hex: Colore primario del brand (es. '#C0392B' per DaKady).
    """
    canvas_w, canvas_h = FORMAT_SIZES.get(content_format, (1080, 1080))
    primary_rgb = _hex_to_rgb(primary_color_hex)

    # Decodifica logo da base64 (se fornito)
    logo_img = _load_logo_from_b64(logo_b64, primary_color_hex) if logo_b64 else None

    # ── 1. Background photo ──────────────────
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    # ── 2. Fonts ─────────────────────────────
    hl_size    = int(canvas_w * 0.065)   # ~70px su 1080 — Instagram-friendly
    body_size  = int(canvas_w * 0.031)   # ~33px
    label_size = int(canvas_w * 0.036)   # ~39px

    font_hl    = _load_font(FONT_HEADLINE, hl_size)
    font_body  = _load_font(FONT_BODY, body_size)
    font_label = _load_font(FONT_HEADLINE, label_size)

    # ── 3. Layout routing ────────────────────
    variant = layout_variant.lower()

    if variant in ("centered-header", "centered-with-logo"):
        canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")
        draw = ImageDraw.Draw(canvas)
        _render_centered_layout(canvas, draw, canvas_w, canvas_h,
                                headline, body, label, font_hl, font_body, font_label)
        _add_logo_watermark(canvas, logo_position, canvas_w, canvas_h,
                            logo=logo_img, primary_color_rgb=primary_rgb)
        result = canvas.convert("RGB")
        if output_path:
            result.save(output_path, "PNG", optimize=False)
        return result

    elif variant in ("asymmetric-left", "asymmetric-right"):
        canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")
        draw = ImageDraw.Draw(canvas)
        layout_side = "left" if variant == "asymmetric-left" else "right"
        _render_asymmetric_layout(canvas, draw, canvas_w, canvas_h,
                                  headline, body, layout_side, font_hl, font_body)
        _add_logo_watermark(canvas, logo_position, canvas_w, canvas_h,
                            logo=logo_img, primary_color_rgb=primary_rgb)
        result = canvas.convert("RGB")
        if output_path:
            result.save(output_path, "PNG", optimize=False)
        return result

    # Determine text block width based on variant
    if variant in ("bottom-full", "center"):
        text_max_w = canvas_w - PAD * 2     # full width
    else:
        text_max_w = int(canvas_w * 0.72)   # left or right — occupy 72%

    hl_lines   = _wrap_text(headline.upper(), font_hl, text_max_w)
    body_lines = _wrap_text(body, font_body, text_max_w) if body else []

    hl_w, hl_h     = _text_block_size(hl_lines, font_hl, line_spacing=4)
    body_w, body_h = _text_block_size(body_lines, font_body, line_spacing=6) if body_lines else (0, 0)

    ACCENT_H   = 10
    ACCENT_GAP = 18
    BODY_GAP   = 20

    block_h = ACCENT_H + ACCENT_GAP + hl_h + (BODY_GAP + body_h if body_lines else 0)
    block_w = max(hl_w, body_w)

    # ── 4. Position text block ────────────────
    if variant == "bottom-left":
        bx = PAD
        by = canvas_h - block_h - PAD * 2
        overlay_x, overlay_y = 0, by - PAD
        overlay_w, overlay_h = canvas_w, canvas_h - (by - PAD)

    elif variant == "bottom-right":
        bx = canvas_w - block_w - PAD
        by = canvas_h - block_h - PAD * 2
        overlay_x, overlay_y = 0, by - PAD
        overlay_w, overlay_h = canvas_w, canvas_h - (by - PAD)

    elif variant == "bottom-full":
        bx = PAD
        by = canvas_h - block_h - PAD * 2
        overlay_x, overlay_y = 0, by - PAD
        overlay_w, overlay_h = canvas_w, canvas_h - (by - PAD)

    elif variant == "top-left":
        bx = PAD
        by = PAD * 2
        overlay_x, overlay_y = 0, 0
        overlay_w, overlay_h = canvas_w, block_h + PAD * 4

    elif variant == "top-right":
        bx = canvas_w - block_w - PAD
        by = PAD * 2
        overlay_x, overlay_y = 0, 0
        overlay_w, overlay_h = canvas_w, block_h + PAD * 4

    elif variant == "center":
        bx = (canvas_w - block_w) // 2
        by = (canvas_h - block_h) // 2
        overlay_x = 0
        overlay_y = by - PAD
        overlay_w = canvas_w
        overlay_h = block_h + PAD * 2

    else:  # fallback = bottom-left
        bx = PAD
        by = canvas_h - block_h - PAD * 2
        overlay_x, overlay_y = 0, by - PAD
        overlay_w, overlay_h = canvas_w, canvas_h - (by - PAD)

    # ── 5. Dark gradient overlay ──────────────
    if variant.startswith("top"):
        _draw_gradient_overlay_top(canvas, overlay_x, overlay_y,
                                   overlay_w, overlay_h,
                                   start_alpha=210, end_alpha=0)
    else:
        _draw_gradient_overlay(canvas, overlay_x, overlay_y,
                               overlay_w, overlay_h,
                               start_alpha=0, end_alpha=210)

    # ── 6. Draw text ──────────────────────────
    draw = ImageDraw.Draw(canvas)
    dummy = Image.new("RGB", (1, 1))
    dummy_draw = ImageDraw.Draw(dummy)

    cy = by  # current Y cursor

    # Accent bar nel colore primario del brand
    _add_accent_bar(draw, bx, cy, block_w, color=primary_rgb, height=ACCENT_H)
    cy += ACCENT_H + ACCENT_GAP

    # Headline lines
    for line in hl_lines:
        # Subtle text shadow for legibility
        draw.text((bx + 2, cy + 2), line, font=font_hl, fill=(0, 0, 0, 120))
        draw.text((bx, cy), line, font=font_hl, fill=WHITE)
        bbox = dummy_draw.textbbox((0, 0), line, font=font_hl)
        cy += bbox[3] + 4

    # Body lines
    if body_lines:
        cy += BODY_GAP
        for line in body_lines:
            draw.text((bx + 1, cy + 1), line, font=font_body, fill=(0, 0, 0, 100))
            draw.text((bx, cy), line, font=font_body, fill=(230, 230, 230))
            bbox = dummy_draw.textbbox((0, 0), line, font=font_body)
            cy += bbox[3] + 6

    # ── 7. Logo watermark ────────────────────
    _add_logo_watermark(canvas, logo_position, canvas_w, canvas_h,
                        logo=logo_img, primary_color_rgb=primary_rgb)

    # ── 8. Save ───────────────────────────────
    result = canvas.convert("RGB")
    if output_path:
        result.save(output_path, "PNG", optimize=False)

    return result


def generate_variations(
    photo_path: str,
    headline: str,
    body: Optional[str],
    logo_position: str = "top-center",
    content_format: str = "Post 1:1",
    output_dir: Optional[str] = None,
    variants: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Generate multiple layout variations from the same photo + text.

    Returns list of {"variant": str, "path": str, "image": PIL.Image}.
    """
    if variants is None:
        variants = ["bottom-left", "bottom-right", "bottom-full",
                    "top-left", "center"]

    results = []
    for i, variant in enumerate(variants):
        out_path = None
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            out_path = os.path.join(output_dir, f"variant_{i+1}_{variant}.png")

        img = composite(
            photo_path=photo_path,
            headline=headline,
            body=body,
            layout_variant=variant,
            logo_position=logo_position,
            content_format=content_format,
            output_path=out_path,
        )
        results.append({"variant": variant, "path": out_path, "image": img})
        print(f"  ✓ {variant} → {out_path or '(in memory)'}")

    return results
