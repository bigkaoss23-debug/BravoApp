"""
Designer Agent — Pillow-based compositor for social media posts.

Receives: photo path + headline + body text + layout_variant + logo_position
Outputs:  composited PNG with:
          - Photo background
          - Gradient dark overlay (scoped to text area)
          - Headline + body text in brand font and colors
          - Brand logo watermark

Layout variants (CLASSIC):
  bottom-left   — text block anchored bottom-left
  bottom-right  — text block anchored bottom-right
  bottom-full   — text centered, full width at bottom
  top-left      — text block anchored top-left
  top-right     — text block anchored top-right
  center        — text centered, vertically mid

Layout variants (EXTENDED):
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
# Paths (font assets)
# ──────────────────────────────────────────────
ASSETS = Path(__file__).parent.parent / "assets"

# Font di fallback quando il brand kit non specifica un font
FONT_FALLBACK_HEADLINE = str(ASSETS / "BebasNeue-Regular.ttf")
FONT_FALLBACK_BODY     = str(ASSETS / "LibreFranklin.ttf")

# Cache loghi decodificati da base64: client_id → PIL Image
_LOGO_CACHE: dict = {}


def _hex_to_rgb(hex_color: str) -> tuple:
    """Converte '#C4A06A' in (196, 160, 106)."""
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _has_transparency(img: Image.Image, threshold: float = 0.08) -> bool:
    """True se l'immagine ha già pixel trasparenti (>threshold % del campione)."""
    w, h = img.size
    step_x = max(1, w // 30)
    step_y = max(1, h // 30)
    total = transparent = 0
    pixels = img.load()
    for y in range(0, h, step_y):
        for x in range(0, w, step_x):
            total += 1
            if pixels[x, y][3] < 128:
                transparent += 1
    return total > 0 and (transparent / total) > threshold


def _load_logo_from_b64(logo_b64: str, primary_color_hex: str = "#1C1C1C") -> Optional[Image.Image]:
    """
    Decodifica un logo da base64.
    - Se il logo ha già trasparenza (PNG con alpha), lo usa direttamente.
    - Se ha sfondo opaco, tenta il key-out del colore primario.
    Non taglia mai il logo automaticamente.
    """
    cache_key = logo_b64[:64]
    if cache_key in _LOGO_CACHE:
        return _LOGO_CACHE[cache_key]

    try:
        if "," in logo_b64:
            logo_b64 = logo_b64.split(",", 1)[1]
        raw = base64.b64decode(logo_b64)
        logo = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        return None

    # Solo se NON ha già trasparenza, tenta key-out del colore di sfondo
    if not _has_transparency(logo):
        try:
            pr, pg, pb = _hex_to_rgb(primary_color_hex)
            pixels = logo.load()
            w, h = logo.size
            for y in range(h):
                for x in range(w):
                    r, g, b, a = pixels[x, y]
                    if abs(r - pr) < 55 and abs(g - pg) < 55 and abs(b - pb) < 55:
                        pixels[x, y] = (r, g, b, 0)
        except Exception:
            pass

    _LOGO_CACHE[cache_key] = logo
    return logo

# ──────────────────────────────────────────────
# Colori neutri di fallback (usati solo se il brand kit non passa colori)
# ──────────────────────────────────────────────
WHITE      = (255, 255, 255)
LIGHT_GRAY = (230, 230, 230)
BLACK      = (26, 26, 26)
NEUTRAL_DARK = (28, 28, 28)

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
                    color: tuple = (28, 28, 28), height: int = 8) -> None:
    """Draw a bold horizontal accent bar."""
    draw.rectangle([x, y, x + width, y + height], fill=color)


def _add_logo_watermark(img: Image.Image, logo_position: str,
                        canvas_w: int, canvas_h: int,
                        logo: Optional[Image.Image] = None,
                        primary_color_rgb: tuple = (192, 57, 43),
                        wm_size: int = 120) -> None:
    """
    Incolla il logo sull'immagine.
    - Se il logo ha trasparenza: incolla direttamente con un sottile drop-shadow scuro.
    - Se il logo non ha trasparenza: usa un backing colorato col colore primario.
    """
    if logo is None:
        return

    margin = PAD // 2

    # Scala mantenendo proporzioni — altezza fissa 80px
    logo_h = 80
    ratio  = logo_h / logo.size[1]
    logo_w = int(logo.size[0] * ratio)
    logo   = logo.resize((logo_w, logo_h), Image.LANCZOS)

    positions = {
        "top-center":    ((canvas_w - logo_w) // 2, margin),
        "top-left":      (margin, margin),
        "top-right":     (canvas_w - logo_w - margin, margin),
        "bottom-left":   (margin, canvas_h - logo_h - margin),
        "bottom-right":  (canvas_w - logo_w - margin, canvas_h - logo_h - margin),
        "bottom-center": ((canvas_w - logo_w) // 2, canvas_h - logo_h - margin),
    }
    lx, ly = positions.get(logo_position, positions["top-right"])

    if _has_transparency(logo, threshold=0.05):
        # Logo trasparente: solo drop-shadow leggero per visibilità su qualsiasi sfondo
        pad = 10
        shadow = Image.new("RGBA", (logo_w + pad * 2, logo_h + pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [0, 0, logo_w + pad * 2 - 1, logo_h + pad * 2 - 1],
            radius=8, fill=(0, 0, 0, 70),
        )
        img.paste(shadow, (lx - pad, ly - pad), shadow)
    else:
        # Logo senza trasparenza: backing con colore primario del brand
        pad_x, pad_y = 18, 10
        backing = Image.new("RGBA", (logo_w + pad_x * 2, logo_h + pad_y * 2), (0, 0, 0, 0))
        br, bg, bb = primary_color_rgb
        ImageDraw.Draw(backing).rounded_rectangle(
            [0, 0, logo_w + pad_x * 2 - 1, logo_h + pad_y * 2 - 1],
            radius=12, fill=(br, bg, bb, 210),
        )
        img.paste(backing, (lx - pad_x, ly - pad_y), backing)

    img.paste(logo, (lx, ly), logo)


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
    headline_color: tuple = WHITE,
    body_color: tuple = LIGHT_GRAY,
    force_uppercase: bool = False,
    headline_color_h2: Optional[tuple] = None,
) -> None:
    """
    Render CENTERED LAYOUT: Label (optional) → Headline → Body → Footer
    All elements are horizontally centered. Vertical positioning creates hierarchy.
    """
    text_max_w = canvas_w - PAD * 2

    hl_lines    = _wrap_text(headline.upper(), font_hl, text_max_w)
    body_lines  = _wrap_text(body.upper() if (body and force_uppercase) else (body or ""), font_body, text_max_w) if body else []
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
            draw.text((x, label_y), line, font=font_label, fill=(255, 127, 80))
            bbox = _dummy_draw.textbbox((0, 0), line, font=font_label)
            label_y += (bbox[3] - bbox[1]) + 4

    # Render headline (due-toni: prima riga = headline_color, successive = headline_color_h2)
    hl_y = int(canvas_h * hl_y_pct) - (hl_h // 2)
    _hl_advance = int(font_hl.size * 0.92)
    for i, line in enumerate(hl_lines):
        color = headline_color if (i == 0 or not headline_color_h2) else headline_color_h2
        x = _center_x(line, font_hl)
        draw.text((x + 2, hl_y + 2), line, font=font_hl, fill=(0, 0, 0, 120))
        draw.text((x, hl_y), line, font=font_hl, fill=color)
        hl_y += _hl_advance

    # Render body
    if body_lines:
        body_y = int(canvas_h * body_y_pct)
        for line in body_lines:
            x = _center_x(line, font_body)
            draw.text((x + 1, body_y + 1), line, font=font_body, fill=(0, 0, 0, 100))
            draw.text((x, body_y), line, font=font_body, fill=body_color)
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
    headline_color: tuple = WHITE,
    body_color: tuple = LIGHT_GRAY,
    headline_color_h2: Optional[tuple] = None,
) -> None:
    """
    Render ASYMMETRIC LAYOUT: Text on one side, space for photo on other.
    Text positioned at ~45% from top, occupies ~40% width of canvas.
    """
    # Colonna testo = 40% del canvas meno padding
    text_max_w = int(canvas_w * 0.40) - PAD

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

    # Render headline (due-toni: prima riga = headline_color, successive = headline_color_h2)
    cy = by
    _hl_advance = int(font_hl.size * 0.92)
    for i, line in enumerate(hl_lines):
        color = headline_color if (i == 0 or not headline_color_h2) else headline_color_h2
        draw.text((bx + 2, cy + 2), line, font=font_hl, fill=(0, 0, 0, 120))
        draw.text((bx, cy), line, font=font_hl, fill=color)
        cy += _hl_advance

    # Render body — solo le righe che entrano nel canvas
    if body_lines:
        cy += 20
        for line in body_lines:
            if cy + line_h_body > max_body_bottom:
                break
            draw.text((bx + 1, cy + 1), line, font=font_body, fill=(0, 0, 0, 100))
            draw.text((bx, cy), line, font=font_body, fill=body_color)
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
    subtitle_color: tuple = (255, 255, 255),
    side: str = "left",
    logo_b64: Optional[str] = None,
    primary_color_hex: str = "#1C1C1C",
    headline_color_hex: str = "#FFFFFF",
    body_color_hex: str = "#E6E6E6",
    font_headline_path: Optional[str] = None,
    font_body_path: Optional[str] = None,
    force_uppercase: bool = False,
    headline_size: Optional[int] = None,
    body_size_override: Optional[int] = None,
    headline_color_h2_hex: Optional[str] = None,
    bg_overlay_hex: Optional[str] = None,
    bg_overlay_alpha: float = 0.72,
) -> Image.Image:
    """
    Composite un post social con foto + overlay testo + logo brand.
    Tutti i colori e font vengono dal brand kit del cliente — zero valori hardcoded.
    """
    canvas_w, canvas_h = FORMAT_SIZES.get(content_format, (1080, 1080))
    primary_rgb       = _hex_to_rgb(primary_color_hex)
    headline_color    = _hex_to_rgb(headline_color_hex)
    body_color        = _hex_to_rgb(body_color_hex)
    headline_color_h2 = _hex_to_rgb(headline_color_h2_hex) if headline_color_h2_hex else None

    logo_img = _load_logo_from_b64(logo_b64, primary_color_hex) if logo_b64 else None

    # ── 1. Background photo ──────────────────
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    # Overlay navy uniforme su tutta la foto (brand kit: #1C2A3A @ 0.72)
    if bg_overlay_hex:
        ov_rgb = _hex_to_rgb(bg_overlay_hex)
        ov_alpha = int(bg_overlay_alpha * 255)
        overlay = Image.new("RGBA", (canvas_w, canvas_h), (*ov_rgb, ov_alpha))
        canvas = Image.alpha_composite(canvas, overlay)

    # ── 2. Fonts e dimensioni dal brand kit ───────
    # Usa dimensioni esatte dal brand kit se passate, altrimenti percentuale canvas
    hl_size    = headline_size or int(canvas_w * 0.075)
    b_size     = body_size_override or int(canvas_w * 0.028)
    label_size = int(hl_size * 0.45)

    font_hl    = _load_font(font_headline_path or FONT_FALLBACK_HEADLINE, hl_size)
    font_body  = _load_font(font_body_path or FONT_FALLBACK_BODY, b_size)
    font_label = _load_font(font_headline_path or FONT_FALLBACK_HEADLINE, label_size)

    # ── 3. Layout routing ────────────────────
    variant = layout_variant.lower()

    if variant in ("centered-header", "centered-with-logo"):
        canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")
        draw = ImageDraw.Draw(canvas)
        _render_centered_layout(canvas, draw, canvas_w, canvas_h,
                                headline, body, label, font_hl, font_body, font_label,
                                headline_color=headline_color, body_color=body_color,
                                force_uppercase=force_uppercase,
                                headline_color_h2=headline_color_h2)
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
                                  headline, body, layout_side, font_hl, font_body,
                                  headline_color=headline_color, body_color=body_color,
                                  headline_color_h2=headline_color_h2)
        _add_logo_watermark(canvas, logo_position, canvas_w, canvas_h,
                            logo=logo_img, primary_color_rgb=primary_rgb)
        result = canvas.convert("RGB")
        if output_path:
            result.save(output_path, "PNG", optimize=False)
        return result

    # ── Layout classici (bottom/top/center) ───────────────────────────────────
    if variant in ("bottom-full", "center"):
        text_max_w = canvas_w - PAD * 2
    else:
        text_max_w = int(canvas_w * 0.72)

    hl_text    = headline.upper()
    body_text  = (body.upper() if force_uppercase else body) if body else None
    label_text = label.upper() if label else None

    hl_lines    = _wrap_text(hl_text, font_hl, text_max_w)
    body_lines  = _wrap_text(body_text, font_body, text_max_w) if body_text else []
    label_lines = _wrap_text(label_text, font_label, text_max_w) if label_text else []

    hl_w, hl_h         = _text_block_size(hl_lines, font_hl, line_spacing=4)
    body_w, body_h     = _text_block_size(body_lines, font_body, line_spacing=6) if body_lines else (0, 0)
    label_w, label_h   = _text_block_size(label_lines, font_label, line_spacing=4) if label_lines else (0, 0)

    LABEL_GAP = 16
    BODY_GAP  = 20
    block_h   = (label_h + LABEL_GAP if label_lines else 0) + hl_h + (BODY_GAP + body_h if body_lines else 0)
    block_w   = max(hl_w, body_w, label_w)

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
    dummy_draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    cy = by

    # Label sopra il titolo (piccolo, colore H2/oro)
    if label_lines:
        label_color = headline_color_h2 if headline_color_h2 else body_color
        for line in label_lines:
            draw.text((bx + 1, cy + 1), line, font=font_label, fill=(0, 0, 0, 100))
            draw.text((bx, cy), line, font=font_label, fill=label_color)
            bbox = dummy_draw.textbbox((0, 0), line, font=font_label)
            cy += (bbox[3] - bbox[1]) + 4
        cy += LABEL_GAP

    _hl_advance = int(font_hl.size * 0.92)

    for i, line in enumerate(hl_lines):
        color = headline_color if (i == 0 or not headline_color_h2) else headline_color_h2
        draw.text((bx + 2, cy + 2), line, font=font_hl, fill=(0, 0, 0, 140))
        draw.text((bx, cy), line, font=font_hl, fill=color)
        cy += _hl_advance

    if body_lines:
        cy += BODY_GAP
        for line in body_lines:
            draw.text((bx + 1, cy + 1), line, font=font_body, fill=(0, 0, 0, 120))
            draw.text((bx, cy), line, font=font_body, fill=body_color)
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
