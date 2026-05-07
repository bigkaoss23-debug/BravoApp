"""
editorial_renderer.py — Rendering editoriale per i 4 archetipi.

Linguaggio visivo: Cormorant + Jost · oro/crema/bordeaux · respiro.
NON usa overlay aggressivi, NON usa ombre 4-layer, NON forza uppercase.

Riusa le utility pure di agents/designer.py (hex→rgb, fit_photo, load_logo, ecc).

Archetipi disponibili:
    una_palabra      — una sola parola dominante · Cormorant italic
    frase_susurro    — headline + whisper italic sotto
    etiqueta_titulo  — etichetta Jost oro + headline Cormorant
    ritmo_tres       — 3 parole verticali · alternanza color/style

Entrypoint principale: composite_editorial(...)
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional, List

from PIL import Image, ImageDraw, ImageFont

# Riusa le utility solide di designer.py
from agents.designer import (
    _hex_to_rgb,
    _load_logo_from_b64,
    _has_transparency,
    _load_font,
    _wrap_text,
    _text_block_size,
    _fit_photo,
    FORMAT_SIZES,
    PAD,
)


# ═══════════════════════════════════════════════════════════════════════════
# Path font Belvedere (Variable Fonts da Google Fonts)
# ═══════════════════════════════════════════════════════════════════════════

ASSETS = Path(__file__).parent.parent / "assets"

FONT_CORMORANT          = str(ASSETS / "CormorantGaramond-VF.ttf")
FONT_CORMORANT_ITALIC   = str(ASSETS / "CormorantGaramond-Italic-VF.ttf")
FONT_JOST               = str(ASSETS / "Jost-VF.ttf")
FONT_JOST_ITALIC        = str(ASSETS / "Jost-Italic-VF.ttf")


# ═══════════════════════════════════════════════════════════════════════════
# Costanti editorial
# ═══════════════════════════════════════════════════════════════════════════

# Colori brand Belvedere (default; possono essere sovrascritti)
BELVEDERE = {
    "cream":    "#F5F0E8",
    "warm":     "#C29547",  # oro
    "accent":   "#8B1A1A",  # bordeaux
    "muted":    "#8C8278",
    "fg":       "#1C1714",
    "green":    "#5C7A5C",
    "blue_mist":"#7A8FA6",
}

# Padding editoriale: più generoso del classico per dare respiro
PAD_EDITORIAL = 64


# ═══════════════════════════════════════════════════════════════════════════
# Helper editoriali
# ═══════════════════════════════════════════════════════════════════════════

def _normalize_ellipsis(text: str) -> str:
    """
    Converte i tre punti consecutivi `...` nel carattere ellipsis Unicode `…` (U+2026).
    Anche `....` (4 punti, errore comune) → `…`.
    Lascia invariato il punto singolo finale (è una scelta editoriale separata).
    """
    if not text:
        return text
    # Sostituisce sequenze di 3+ punti con ellipsis (anche se separati da spazi)
    text = re.sub(r'\.{3,}', '…', text)
    text = re.sub(r'\.\s*\.\s*\.+', '…', text)
    return text


def _apply_case(text: str, mode: str = "preserve") -> str:
    """
    mode:
      - "preserve" → lascia il testo come è (default editoriale)
      - "upper"    → tutto maiuscolo
      - "sentence" → prima lettera maiuscola, resto minuscolo
    """
    if not text:
        return text
    if mode == "upper":
        return text.upper()
    if mode == "sentence":
        # Sentence case base: capitalize prima lettera, lascia il resto
        return text[0].upper() + text[1:].lower()
    return text  # preserve


def _load_variable_font(path: str, size: int, weight: int = 400) -> ImageFont.FreeTypeFont:
    """
    Carica un variable font e imposta il peso desiderato.
    weight: 100-900 (Pillow 8.2+ supporta variable fonts).
    Se non supportato, fallback su default.
    """
    try:
        font = ImageFont.truetype(path, size)
        try:
            font.set_variation_by_axes([weight])
        except (AttributeError, OSError):
            # Variable axis non disponibile — usa il peso default del file
            pass
        return font
    except Exception:
        return ImageFont.load_default()


def _size_for_width(
    text: str,
    font_path: str,
    target_width_px: int,
    weight: int = 400,
    min_size: int = 24,
    max_size: int = 600,
) -> int:
    """
    Trova la dimensione del font che fa risultare `text` largo ~target_width_px.
    Approccio lineare: misura a una dimensione di test e scala proporzionalmente.
    """
    test_size = 100
    font = _load_variable_font(font_path, test_size, weight=weight)
    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    bbox = dummy.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    if w == 0:
        return test_size
    scaled = int(test_size * target_width_px / w)
    return max(min_size, min(max_size, scaled))


def _draw_text_clean(
    draw: ImageDraw.Draw,
    xy: tuple,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    shadow: bool = True,
    shadow_color: tuple = (0, 0, 0),
    shadow_alpha: int = 90,
    shadow_blur: bool = False,
    canvas: Optional[Image.Image] = None,
) -> None:
    """
    Disegna testo con un'unica ombra leggera (NON le 4 ombre del designer classico).
    L'ombra serve solo per leggibilità su qualsiasi sfondo, non per dramma.

    Se shadow=False, dipinge solo il testo senza ombra (per sfondi scuri sicuri).
    """
    x, y = xy

    if shadow:
        # Una singola ombra sottile, offset 1px, per leggibilità minima
        sr, sg, sb = shadow_color
        draw.text((x + 1, y + 1), text, font=font, fill=(sr, sg, sb, shadow_alpha))

    draw.text((x, y), text, font=font, fill=fill)


def _add_minimal_logo(
    img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    text: str = "BELVEDERE",
    position: str = "bottom-center",
    color_hex: str = "#F5F0E8",
    font_path: str = FONT_JOST,
    size: int = 14,
    letter_spacing_em: float = 0.45,
) -> None:
    """
    Logo minimale tipografico (NON il backing rosso del designer classico).
    Solo testo spaziato in Jost, basso contrasto, presenza discreta.
    """
    draw = ImageDraw.Draw(img)
    font = _load_variable_font(font_path, size, weight=300)
    color = _hex_to_rgb(color_hex)

    # Letter-spacing manuale (Pillow non lo supporta nativamente)
    letter_space_px = int(size * letter_spacing_em)
    chars = list(text)

    # Calcola larghezza totale del testo spaziato
    total_w = 0
    char_widths = []
    for c in chars:
        bbox = draw.textbbox((0, 0), c, font=font)
        cw = bbox[2] - bbox[0]
        char_widths.append(cw)
        total_w += cw + letter_space_px
    total_w -= letter_space_px  # toglie l'ultimo space

    # Calcola posizione del blocco
    margin = 28
    if position == "bottom-center":
        x_start = (canvas_w - total_w) // 2
        y = canvas_h - size - margin
    elif position == "bottom-left":
        x_start = margin
        y = canvas_h - size - margin
    elif position == "bottom-right":
        x_start = canvas_w - total_w - margin
        y = canvas_h - size - margin
    else:
        x_start = (canvas_w - total_w) // 2
        y = canvas_h - size - margin

    # Disegna ogni carattere con spaziatura
    x = x_start
    for c, cw in zip(chars, char_widths):
        _draw_text_clean(draw, (x, y), c, font, color, shadow=True, shadow_alpha=130)
        x += cw + letter_space_px


# ═══════════════════════════════════════════════════════════════════════════
# Archetipo A · UNA PALABRA
# ═══════════════════════════════════════════════════════════════════════════

def render_una_palabra(
    photo_path: str,
    word: str,
    *,
    canvas_format: str = "Story 9:16",
    color_hex: str = BELVEDERE["warm"],          # default: oro
    italic: bool = True,
    weight: int = 400,
    size_px: Optional[int] = None,                # se None, calcolato da width_pct
    width_pct: float = 0.60,                      # parola deve occupare ~60% canvas width — IMPATTO
    position: str = "upper-center",               # upper-center | upper-left | upper-right | mid-left | center
    shadow: bool = True,
    logo_text: str = "BELVEDERE",
    logo_position: str = "bottom-center",
    logo_color_hex: str = BELVEDERE["cream"],
) -> Image.Image:
    """
    Archetipo A: una sola parola dominante in Cormorant.
    Massimo silenzio · zero overlay · una sola riga.
    Dimensionata per LARGHEZZA (presenza), non altezza.
    """
    canvas_w, canvas_h = FORMAT_SIZES.get(canvas_format, (1080, 1920))
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    font_path = FONT_CORMORANT_ITALIC if italic else FONT_CORMORANT

    # Sizing: se non specificato esplicitamente, calcola da width_pct (impatto editoriale)
    word_for_sizing = _normalize_ellipsis(word)
    if size_px is None:
        target_w = int(canvas_w * width_pct)
        size_px = _size_for_width(word_for_sizing, font_path, target_w, weight=weight)

    font = _load_variable_font(font_path, size_px, weight=weight)

    word = _normalize_ellipsis(word)
    color = _hex_to_rgb(color_hex)

    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), word, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Posizionamento
    if position == "upper-center":
        x = (canvas_w - text_w) // 2
        y = int(canvas_h * 0.22)
    elif position == "upper-left":
        x = PAD_EDITORIAL
        y = int(canvas_h * 0.18)
    elif position == "upper-right":
        x = canvas_w - text_w - PAD_EDITORIAL
        y = int(canvas_h * 0.18)
    elif position == "mid-left":
        x = PAD_EDITORIAL
        y = int(canvas_h * 0.42)
    elif position == "mid-right":
        x = canvas_w - text_w - PAD_EDITORIAL
        y = int(canvas_h * 0.42)
    else:  # center
        x = (canvas_w - text_w) // 2
        y = (canvas_h - text_h) // 2

    _draw_text_clean(draw, (x, y), word, font, color, shadow=shadow, shadow_alpha=110)

    _add_minimal_logo(canvas, canvas_w, canvas_h, text=logo_text,
                      position=logo_position, color_hex=logo_color_hex)

    return canvas.convert("RGB")


# ═══════════════════════════════════════════════════════════════════════════
# Archetipo B · FRASE + SUSURRO
# ═══════════════════════════════════════════════════════════════════════════

def render_frase_susurro(
    photo_path: str,
    headline: str,
    whisper: str,
    *,
    canvas_format: str = "Story 9:16",
    headline_color_hex: str = BELVEDERE["cream"],
    whisper_color_hex: str = BELVEDERE["warm"],
    headline_size_px: Optional[int] = None,
    whisper_size_px: Optional[int] = None,
    position: str = "upper-left",                 # upper-left | upper-right | mid-left | mid-right
    shadow: bool = True,
    logo_text: str = "BELVEDERE",
    logo_position: str = "bottom-left",
    logo_color_hex: str = BELVEDERE["cream"],
) -> Image.Image:
    """
    Archetipo B: headline + whisper italic sotto.
    Headline in Cormorant regular, whisper in Cormorant italic più piccolo.
    """
    canvas_w, canvas_h = FORMAT_SIZES.get(canvas_format, (1080, 1920))
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    # Auto-size
    if headline_size_px is None:
        headline_size_px = int(canvas_h * 0.050)        # presenza maggiore
    if whisper_size_px is None:
        whisper_size_px = max(20, int(headline_size_px * 0.45))   # whisper più leggibile

    font_hl      = _load_variable_font(FONT_CORMORANT, headline_size_px, weight=400)
    font_whisper = _load_variable_font(FONT_CORMORANT_ITALIC, whisper_size_px, weight=300)

    headline = _normalize_ellipsis(headline)
    whisper  = _normalize_ellipsis(whisper)

    hl_color = _hex_to_rgb(headline_color_hex)
    wh_color = _hex_to_rgb(whisper_color_hex)

    # Larghezza max blocco testo: ~50% canvas
    text_max_w = int(canvas_w * 0.50)

    hl_lines = _wrap_text(headline, font_hl, text_max_w)
    wh_lines = _wrap_text(whisper, font_whisper, text_max_w)

    hl_w, hl_h = _text_block_size(hl_lines, font_hl, line_spacing=4)
    wh_w, wh_h = _text_block_size(wh_lines, font_whisper, line_spacing=2)

    GAP = int(headline_size_px * 0.45)

    # Posizionamento blocco
    if position == "upper-left":
        bx = PAD_EDITORIAL
        by = int(canvas_h * 0.10)
    elif position == "upper-right":
        bx = canvas_w - max(hl_w, wh_w) - PAD_EDITORIAL
        by = int(canvas_h * 0.10)
    elif position == "mid-left":
        bx = PAD_EDITORIAL
        by = int(canvas_h * 0.36)
    else:  # mid-right
        bx = canvas_w - max(hl_w, wh_w) - PAD_EDITORIAL
        by = int(canvas_h * 0.36)

    draw = ImageDraw.Draw(canvas)

    # Render headline
    cy = by
    line_advance_hl = int(headline_size_px * 0.95)
    for line in hl_lines:
        if position.endswith("right"):
            line_bbox = draw.textbbox((0, 0), line, font=font_hl)
            line_w = line_bbox[2] - line_bbox[0]
            x = canvas_w - line_w - PAD_EDITORIAL
        else:
            x = bx
        _draw_text_clean(draw, (x, cy), line, font_hl, hl_color,
                         shadow=shadow, shadow_alpha=100)
        cy += line_advance_hl

    # Render whisper sotto
    cy += GAP
    line_advance_wh = int(whisper_size_px * 1.30)
    for line in wh_lines:
        if position.endswith("right"):
            line_bbox = draw.textbbox((0, 0), line, font=font_whisper)
            line_w = line_bbox[2] - line_bbox[0]
            x = canvas_w - line_w - PAD_EDITORIAL
        else:
            x = bx
        _draw_text_clean(draw, (x, cy), line, font_whisper, wh_color,
                         shadow=shadow, shadow_alpha=120)
        cy += line_advance_wh

    _add_minimal_logo(canvas, canvas_w, canvas_h, text=logo_text,
                      position=logo_position, color_hex=logo_color_hex)

    return canvas.convert("RGB")


# ═══════════════════════════════════════════════════════════════════════════
# Archetipo C · ETIQUETA + TÍTULO
# ═══════════════════════════════════════════════════════════════════════════

def render_etiqueta_titulo(
    photo_path: str,
    label: str,
    headline: str,
    *,
    canvas_format: str = "Story 9:16",
    label_color_hex: str = BELVEDERE["warm"],     # oro
    headline_color_hex: str = BELVEDERE["cream"],
    label_size_px: Optional[int] = None,
    headline_size_px: Optional[int] = None,
    label_letter_spacing_em: float = 0.40,
    position: str = "bottom-left",                # bottom-left | bottom-right | mid-left | mid-right
    shadow: bool = True,
    logo_text: str = "BELVEDERE",
    logo_position: str = "bottom-right",
    logo_color_hex: str = BELVEDERE["cream"],
) -> Image.Image:
    """
    Archetipo C: etichetta Jost spaziata in oro + headline Cormorant in crema sotto.
    Mood "magazine": una categoria/luogo + una frase corta.
    """
    canvas_w, canvas_h = FORMAT_SIZES.get(canvas_format, (1080, 1920))
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    # Auto-size
    if headline_size_px is None:
        headline_size_px = int(canvas_h * 0.038)
    if label_size_px is None:
        label_size_px = max(11, int(headline_size_px * 0.30))

    font_label    = _load_variable_font(FONT_JOST, label_size_px, weight=500)
    font_headline = _load_variable_font(FONT_CORMORANT, headline_size_px, weight=400)

    label    = _normalize_ellipsis(label).upper()  # etichette sì in maiuscolo (è la convenzione tipografica)
    headline = _normalize_ellipsis(headline)

    label_color = _hex_to_rgb(label_color_hex)
    hl_color    = _hex_to_rgb(headline_color_hex)

    text_max_w = int(canvas_w * 0.65)
    hl_lines = _wrap_text(headline, font_headline, text_max_w)
    hl_w, hl_h = _text_block_size(hl_lines, font_headline, line_spacing=4)

    # Calcolo larghezza label spaziata (letter-spacing manuale)
    draw_dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    label_chars = list(label)
    space_px = int(label_size_px * label_letter_spacing_em)
    label_widths = []
    label_total_w = 0
    for c in label_chars:
        bbox = draw_dummy.textbbox((0, 0), c, font=font_label)
        cw = bbox[2] - bbox[0]
        label_widths.append(cw)
        label_total_w += cw + space_px
    label_total_w -= space_px

    GAP_LABEL_HL = int(label_size_px * 1.3)

    # Posizionamento blocco — bottom-left/right sta nel lower-third, lascia spazio al logo
    block_h = label_size_px + GAP_LABEL_HL + hl_h
    if position == "bottom-left":
        bx = PAD_EDITORIAL
        by = int(canvas_h * 0.68)        # lower-third sano · ben sopra il logo
    elif position == "bottom-right":
        bx = canvas_w - max(label_total_w, hl_w) - PAD_EDITORIAL
        by = int(canvas_h * 0.68)
    elif position == "mid-left":
        bx = PAD_EDITORIAL
        by = int(canvas_h * 0.40)
    else:  # mid-right
        bx = canvas_w - max(label_total_w, hl_w) - PAD_EDITORIAL
        by = int(canvas_h * 0.40)

    draw = ImageDraw.Draw(canvas)

    # Render label spaziata
    x = bx
    for c, cw in zip(label_chars, label_widths):
        _draw_text_clean(draw, (x, by), c, font_label, label_color,
                         shadow=shadow, shadow_alpha=130)
        x += cw + space_px

    # Render headline
    cy = by + label_size_px + GAP_LABEL_HL
    line_advance = int(headline_size_px * 1.0)
    for line in hl_lines:
        if position.endswith("right"):
            line_bbox = draw.textbbox((0, 0), line, font=font_headline)
            line_w = line_bbox[2] - line_bbox[0]
            x = canvas_w - line_w - PAD_EDITORIAL
        else:
            x = bx
        _draw_text_clean(draw, (x, cy), line, font_headline, hl_color,
                         shadow=shadow, shadow_alpha=100)
        cy += line_advance

    _add_minimal_logo(canvas, canvas_w, canvas_h, text=logo_text,
                      position=logo_position, color_hex=logo_color_hex)

    return canvas.convert("RGB")


# ═══════════════════════════════════════════════════════════════════════════
# Archetipo D · RITMO DE TRES
# ═══════════════════════════════════════════════════════════════════════════

def render_ritmo_tres(
    photo_path: str,
    words: List[str],                              # esattamente 3 parole
    *,
    canvas_format: str = "Story 9:16",
    pattern: str = "gold-cream-gold",              # alternanza colore
    italic_pattern: str = "regular-italic-regular",# alternanza style
    size_px: Optional[int] = None,
    position: str = "right",                       # left | right | center
    line_spacing_factor: float = 1.55,
    shadow: bool = True,
    logo_text: str = "BELVEDERE",
    logo_position: str = "bottom-left",
    logo_color_hex: str = BELVEDERE["cream"],
) -> Image.Image:
    """
    Archetipo D: 3 parole verticali con alternanza color/style.
    Voce poetica · ritmo di 3 · separazione visuale fa il lavoro del punto.

    pattern: combinazione di "gold" "cream" "accent" separate da "-"
    italic_pattern: combinazione di "regular" "italic" separate da "-"
    """
    if len(words) != 3:
        raise ValueError(f"Ritmo de tres richiede esattamente 3 parole, ricevute {len(words)}")

    canvas_w, canvas_h = FORMAT_SIZES.get(canvas_format, (1080, 1920))
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    if size_px is None:
        size_px = int(canvas_h * 0.038)

    # Parsing pattern colori
    color_map = {
        "gold":   BELVEDERE["warm"],
        "cream":  BELVEDERE["cream"],
        "accent": BELVEDERE["accent"],
    }
    color_names = pattern.split("-")
    if len(color_names) != 3:
        color_names = ["gold", "cream", "gold"]
    colors = [_hex_to_rgb(color_map.get(n, BELVEDERE["cream"])) for n in color_names]

    # Parsing pattern italic
    italic_names = italic_pattern.split("-")
    if len(italic_names) != 3:
        italic_names = ["regular", "italic", "regular"]
    italics = [n == "italic" for n in italic_names]

    # Carico font diversi per ogni parola
    fonts = []
    for is_italic in italics:
        fp = FONT_CORMORANT_ITALIC if is_italic else FONT_CORMORANT
        weight = 300 if is_italic else 400
        fonts.append(_load_variable_font(fp, size_px, weight=weight))

    # Normalizzo ellipsis su ogni parola
    words = [_normalize_ellipsis(w) for w in words]

    # Calcolo dimensioni
    draw = ImageDraw.Draw(canvas)
    line_h = int(size_px * line_spacing_factor)

    # Posizione del blocco verticale
    block_top = int(canvas_h * 0.22)

    for i, (word, font, color) in enumerate(zip(words, fonts, colors)):
        bbox = draw.textbbox((0, 0), word, font=font)
        word_w = bbox[2] - bbox[0]

        if position == "right":
            x = canvas_w - word_w - PAD_EDITORIAL
        elif position == "left":
            x = PAD_EDITORIAL
        else:  # center
            x = (canvas_w - word_w) // 2

        y = block_top + i * line_h
        _draw_text_clean(draw, (x, y), word, font, color,
                         shadow=shadow, shadow_alpha=100)

    _add_minimal_logo(canvas, canvas_w, canvas_h, text=logo_text,
                      position=logo_position, color_hex=logo_color_hex)

    return canvas.convert("RGB")


# ═══════════════════════════════════════════════════════════════════════════
# Archetipo E · FRASE NARRATIVA
# ═══════════════════════════════════════════════════════════════════════════

def render_frase_narrativa(
    photo_path: str,
    sentence: str,
    *,
    canvas_format: str = "Story 9:16",
    color_hex: str = BELVEDERE["cream"],
    italic: bool = False,
    weight: int = 400,
    size_px: Optional[int] = None,                 # se None, auto
    size_pct_height: float = 0.045,                # default: 4.5% canvas height
    width_pct: float = 0.72,                       # blocco testo occupa ~72% canvas width
    position: str = "upper-left",                  # upper-left | upper-right | mid-left | mid-right | lower-left | lower-right
    line_spacing_factor: float = 1.05,
    shadow: bool = True,
    logo_text: str = "BELVEDERE",
    logo_position: str = "bottom-left",
    logo_color_hex: str = BELVEDERE["cream"],
) -> Image.Image:
    """
    Archetipo E: una sola frase di lunghezza media (5-12 parole), nessun whisper, nessuna label.
    Editorial completo · respira · dialoga con la foto.

    Esempi:
        "Hay una hora en que el Tajo todavía calla."
        "El café llega antes que la luz al fondo del valle."
        "Aquí la mañana se mide en niebla."

    Differenza con frase_susurro: una voce sola, niente sottotesto. Più narrativo, meno tipografico.
    """
    canvas_w, canvas_h = FORMAT_SIZES.get(canvas_format, (1080, 1920))
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    sentence = _normalize_ellipsis(sentence)
    color = _hex_to_rgb(color_hex)

    font_path = FONT_CORMORANT_ITALIC if italic else FONT_CORMORANT

    # Auto-size: 4.5% canvas height (peso medio · respira)
    if size_px is None:
        size_px = int(canvas_h * size_pct_height)

    font = _load_variable_font(font_path, size_px, weight=weight)

    # Wrapping: blocco di larghezza target
    text_max_w = int(canvas_w * width_pct)
    lines = _wrap_text(sentence, font, text_max_w)

    # Misura blocco
    block_w, block_h = _text_block_size(lines, font, line_spacing=4)

    # Posizionamento
    align_right = position.endswith("right")
    if position.startswith("upper"):
        by = int(canvas_h * 0.10)
    elif position.startswith("mid"):
        by = int(canvas_h * 0.40)
    else:  # lower
        by = int(canvas_h * 0.62)

    if align_right:
        bx = canvas_w - block_w - PAD_EDITORIAL
    else:
        bx = PAD_EDITORIAL

    draw = ImageDraw.Draw(canvas)
    line_advance = int(size_px * line_spacing_factor)

    cy = by
    for line in lines:
        if align_right:
            line_bbox = draw.textbbox((0, 0), line, font=font)
            line_w = line_bbox[2] - line_bbox[0]
            x = canvas_w - line_w - PAD_EDITORIAL
        else:
            x = bx
        _draw_text_clean(draw, (x, cy), line, font, color,
                         shadow=shadow, shadow_alpha=110)
        cy += line_advance

    _add_minimal_logo(canvas, canvas_w, canvas_h, text=logo_text,
                      position=logo_position, color_hex=logo_color_hex)

    return canvas.convert("RGB")


# ═══════════════════════════════════════════════════════════════════════════
# Archetipo F · MIXED TYPE + CTA  (stile "hotel deluxe / magazine cover")
# ═══════════════════════════════════════════════════════════════════════════

def _parse_mixed_line(line: str) -> list:
    """
    Parsa una riga con marker {italic}. Ritorna lista di (text, style).
    "Hello {world} foo" → [("Hello ", "regular"), ("world", "italic"), (" foo", "regular")]
    """
    segments = []
    parts = re.split(r'(\{[^}]*\})', line)
    for part in parts:
        if not part:
            continue
        if part.startswith('{') and part.endswith('}'):
            segments.append((part[1:-1], "italic"))
        else:
            segments.append((part, "regular"))
    return segments


def render_mixed_type(
    photo_path: str,
    headline: str,                                  # supporta \n per line break · {...} per italic accent
    *,
    subline: Optional[str] = None,                  # CTA morbida sotto, sentence case
    canvas_format: str = "Story 9:16",
    regular_color_hex: str = BELVEDERE["cream"],
    italic_color_hex: str = BELVEDERE["warm"],      # oro brand sull'italic
    subline_color_hex: str = BELVEDERE["cream"],
    headline_size_px: Optional[int] = None,
    headline_size_pct: float = 0.055,               # 5.5% canvas height — presenza
    subline_size_px: Optional[int] = None,
    subline_size_pct: float = 0.018,                # 1.8% canvas height — discreto
    line_spacing_factor: float = 1.0,
    headline_subline_gap_px: Optional[int] = None,
    position: str = "lower-left",                   # upper/mid/lower + left/center/right
    italic_weight: int = 400,
    regular_weight: int = 400,
    shadow: bool = True,
    logo_text: str = "BELVEDERE",
    logo_position: str = "bottom-center",
    logo_color_hex: str = BELVEDERE["cream"],
) -> Image.Image:
    """
    Archetipo F: stile "hotel deluxe" — headline con mix regular+italic colorato + subline CTA.

    Esempi di headline:
        "Un espacio\\n{para vos}"
        "{La tradición}\\nse sirve en la mesa"
        "Espacios {exclusivos}\\npara tus eventos"
        "Una mesa {junto al Tajo}"

    La porzione tra {} viene renderizzata in italic con `italic_color_hex` (default oro).
    Il `\\n` forza una nuova riga.
    """
    canvas_w, canvas_h = FORMAT_SIZES.get(canvas_format, (1080, 1920))
    canvas = _fit_photo(photo_path, canvas_w, canvas_h).convert("RGBA")

    if headline_size_px is None:
        headline_size_px = int(canvas_h * headline_size_pct)
    if subline_size_px is None:
        subline_size_px = int(canvas_h * subline_size_pct)
    if headline_subline_gap_px is None:
        headline_subline_gap_px = int(headline_size_px * 0.55)

    font_regular = _load_variable_font(FONT_CORMORANT, headline_size_px, weight=regular_weight)
    font_italic  = _load_variable_font(FONT_CORMORANT_ITALIC, headline_size_px, weight=italic_weight)
    font_subline = _load_variable_font(FONT_JOST, subline_size_px, weight=300)

    color_regular = _hex_to_rgb(regular_color_hex)
    color_italic  = _hex_to_rgb(italic_color_hex)
    color_subline = _hex_to_rgb(subline_color_hex)

    fonts = {"regular": font_regular, "italic": font_italic}
    colors = {"regular": color_regular, "italic": color_italic}

    # ── Parsing headline → liste di righe, ognuna con segmenti (text, style) ────
    raw_lines = headline.split("\n")
    parsed_lines = [_parse_mixed_line(line) for line in raw_lines]

    # ── Misura larghezza e altezza di ciascuna riga ───────────────────────────
    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    line_metrics = []  # list of (width, height, segments)
    for segs in parsed_lines:
        total_w = 0
        max_h = 0
        for text, style in segs:
            bbox = dummy.textbbox((0, 0), text, font=fonts[style])
            total_w += bbox[2] - bbox[0]
            max_h = max(max_h, bbox[3] - bbox[1])
        line_metrics.append((total_w, max_h, segs))

    # ── Calcolo blocco totale ────────────────────────────────────────────────
    block_w = max(w for w, _, _ in line_metrics) if line_metrics else 0
    line_advance = int(headline_size_px * line_spacing_factor)
    block_h = line_advance * len(line_metrics)
    if subline:
        sub_bbox = dummy.textbbox((0, 0), subline, font=font_subline)
        sub_w = sub_bbox[2] - sub_bbox[0]
        sub_h = sub_bbox[3] - sub_bbox[1]
        block_h += headline_subline_gap_px + sub_h
        block_w = max(block_w, sub_w)
    else:
        sub_w = sub_h = 0

    # ── Posizionamento ────────────────────────────────────────────────────────
    align_right  = position.endswith("right")
    align_center = position.endswith("center")

    if position.startswith("upper"):
        by = int(canvas_h * 0.10)
    elif position.startswith("mid"):
        by = int(canvas_h * 0.40)
    else:  # lower
        by = int(canvas_h * 0.62)

    draw = ImageDraw.Draw(canvas)

    # ── Render headline (riga per riga, segmento per segmento) ────────────────
    cy = by
    for line_w, line_h, segs in line_metrics:
        # Posizione X di partenza per la riga
        if align_right:
            line_start_x = canvas_w - line_w - PAD_EDITORIAL
        elif align_center:
            line_start_x = (canvas_w - line_w) // 2
        else:
            line_start_x = PAD_EDITORIAL

        x = line_start_x
        for text, style in segs:
            font = fonts[style]
            color = colors[style]
            _draw_text_clean(draw, (x, cy), text, font, color,
                             shadow=shadow, shadow_alpha=110)
            bbox = dummy.textbbox((0, 0), text, font=font)
            x += bbox[2] - bbox[0]
        cy += line_advance

    # ── Render subline ────────────────────────────────────────────────────────
    if subline:
        cy += headline_subline_gap_px - line_advance + line_advance  # già allineato dopo l'ultimo line_advance
        # Riposizionamento Y corretto: ultima riga è già stata avanzata, gap è tra blocco e subline
        cy = by + (line_advance * len(line_metrics)) + headline_subline_gap_px - line_advance
        # Più semplice: ricomputo cy basato su block_h originale
        cy = by + (line_advance * len(line_metrics)) + headline_subline_gap_px

        if align_right:
            sx = canvas_w - sub_w - PAD_EDITORIAL
        elif align_center:
            sx = (canvas_w - sub_w) // 2
        else:
            sx = PAD_EDITORIAL

        _draw_text_clean(draw, (sx, cy), subline, font_subline, color_subline,
                         shadow=shadow, shadow_alpha=130)

    _add_minimal_logo(canvas, canvas_w, canvas_h, text=logo_text,
                      position=logo_position, color_hex=logo_color_hex)

    return canvas.convert("RGB")


# ═══════════════════════════════════════════════════════════════════════════
# Dispatcher principale
# ═══════════════════════════════════════════════════════════════════════════

ARCHETYPES = {
    "una_palabra":     render_una_palabra,
    "frase_susurro":   render_frase_susurro,
    "etiqueta_titulo": render_etiqueta_titulo,
    "ritmo_tres":      render_ritmo_tres,
    "frase_narrativa": render_frase_narrativa,
    "mixed_type":      render_mixed_type,
}


def composite_editorial(
    photo_path: str,
    archetype: str,
    *,
    output_path: Optional[str] = None,
    **params,
) -> Image.Image:
    """
    Entrypoint principale. Routa al renderer dell'archetipo corretto.

    Esempi:
        composite_editorial(photo, "una_palabra", word="Calma…", color_hex="#C29547")
        composite_editorial(photo, "frase_susurro",
                            headline="El primer café",
                            whisper="antes de que despierte el valle")
        composite_editorial(photo, "etiqueta_titulo",
                            label="Ronda · 7:15",
                            headline="Antes del valle")
        composite_editorial(photo, "ritmo_tres",
                            words=["Niebla", "Café", "Silencio…"])
    """
    if archetype not in ARCHETYPES:
        raise ValueError(
            f"Archetipo '{archetype}' non riconosciuto. "
            f"Disponibili: {list(ARCHETYPES.keys())}"
        )

    render_fn = ARCHETYPES[archetype]
    result = render_fn(photo_path, **params)

    if output_path:
        result.save(output_path, "PNG", optimize=False)

    return result
