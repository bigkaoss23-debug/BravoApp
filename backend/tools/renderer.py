"""
renderer.py — A11 Format Renderer v2.

Wrapper sopra agents/designer.composite() che aggiunge:
  - Applicazione filtri foto (temperature, saturation, contrast, brightness)
    prima del compositing
  - Filtri letti dal photo_filter del brand kit (pillar × angle)

In Step 7 il contenuto di agents/designer.py verrà migrato qui.
Per ora questo file aggiunge i filtri e delega il compositing a designer.
"""

from __future__ import annotations

import tempfile
import os
from typing import Optional
from PIL import Image, ImageEnhance, ImageFilter


# =============================================================================
# Filtri foto
# =============================================================================

def _parse_enhance_value(raw) -> float:
    """
    Converte i valori dell'Art Director in fattori per ImageEnhance.
    Accetta: numeri, stringhe con +/- ("+15" → 1.15), parole ("medio" → 1.0).
    Ritorna un fattore dove 1.0 = invariato.
    """
    if raw is None:
        return 1.0
    if isinstance(raw, (int, float)):
        if -1 < raw < 1 and raw != 0:
            return 1.0 + raw
        if raw > 10 or raw < -10:
            return 1.0 + raw / 100.0
        return float(raw)

    s = str(raw).strip().lower()
    word_map = {
        "bajo": 0.85, "baja": 0.85, "low": 0.85, "suave": 0.9, "soft": 0.9,
        "medio": 1.0, "media": 1.0, "medium": 1.0, "normal": 1.0,
        "alto": 1.15, "alta": 1.15, "high": 1.15, "fuerte": 1.2, "strong": 1.2,
    }
    if s in word_map:
        return word_map[s]

    import re
    m = re.search(r'([+-]?\d+(?:\.\d+)?)', s)
    if m:
        num = float(m.group(1))
        if abs(num) > 10:
            return 1.0 + num / 100.0
        if abs(num) > 1:
            return 1.0 + num / 100.0
        return 1.0 + num
    return 1.0


def _parse_temperature(raw) -> tuple[str, float]:
    """
    Converte "warm +12" → ("warm", 1.12), "cool" → ("cool", 1.0).
    """
    if not raw:
        return ("neutral", 1.0)
    s = str(raw).strip().lower()
    direction = "neutral"
    if "warm" in s:
        direction = "warm"
    elif "cool" in s:
        direction = "cool"

    import re
    m = re.search(r'([+-]?\d+(?:\.\d+)?)', s)
    intensity = 1.0
    if m:
        num = float(m.group(1))
        intensity = 1.0 + abs(num) / 100.0
    return (direction, intensity)


def apply_photo_filters(img: Image.Image, filters: dict) -> Image.Image:
    """
    Applica i filtri del brand kit a una PIL Image.

    Accetta sia valori numerici (1.15) che descrittivi dell'Art Director
    ("warm +12", "+15", "medio").
    """
    if not filters:
        return img

    result = img.convert("RGB")

    # ── Temperature ──────────────────────────────────────────────────────────
    direction, intensity = _parse_temperature(filters.get("temperature"))
    if direction == "warm":
        factor = 0.08 * intensity
        r, g, b = result.split()
        r = r.point(lambda i: min(255, int(i * (1 + factor))))
        b = b.point(lambda i: int(i * (1 - factor)))
        result = Image.merge("RGB", (r, g, b))
    elif direction == "cool":
        factor = 0.08 * intensity
        r, g, b = result.split()
        r = r.point(lambda i: int(i * (1 - factor)))
        b = b.point(lambda i: min(255, int(i * (1 + factor))))
        result = Image.merge("RGB", (r, g, b))

    # ── Saturation ───────────────────────────────────────────────────────────
    sat = _parse_enhance_value(filters.get("saturation"))
    if sat != 1.0:
        result = ImageEnhance.Color(result).enhance(sat)

    # ── Contrast ─────────────────────────────────────────────────────────────
    contr = _parse_enhance_value(filters.get("contrast"))
    if contr != 1.0:
        result = ImageEnhance.Contrast(result).enhance(contr)

    # ── Brightness ───────────────────────────────────────────────────────────
    bright = _parse_enhance_value(filters.get("brightness"))
    if bright != 1.0:
        result = ImageEnhance.Brightness(result).enhance(bright)

    # ── Blur (leggero effetto soft) ───────────────────────────────────────────
    blur_raw = filters.get("blur", 0)
    blur = _parse_enhance_value(blur_raw) - 1.0 if isinstance(blur_raw, str) else float(blur_raw or 0)
    if blur > 0:
        result = result.filter(ImageFilter.GaussianBlur(radius=blur))

    return result


# =============================================================================
# Compositing con filtri
# =============================================================================

def composite_v2(
    photo_path: str,
    headline: str,
    photo_filters: Optional[dict] = None,
    body: Optional[str] = None,
    layout_variant: str = "bottom-left",
    logo_position: str = "br",
    content_format: str = "Post 1:1",
    label: Optional[str] = None,
    side: str = "left",
    logo_b64: Optional[str] = None,
    overlay_start_pct: float = 0.50,
    **render_params,
) -> Image.Image:
    """
    Versione v2 del compositor: applica photo_filters prima del compositing.

    photo_filters: dict con temperature, saturation, contrast, brightness, blur
    render_params: tutti i parametri di designer.composite (colori, font, etc.)
    """
    from agents.designer import composite

    if photo_filters:
        # Applica filtri a una copia temporanea della foto
        img = Image.open(photo_path).convert("RGB")
        filtered = apply_photo_filters(img, photo_filters)

        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        try:
            filtered.save(tmp.name, "JPEG", quality=92)
            result = composite(
                photo_path=tmp.name,
                headline=headline,
                body=body,
                layout_variant=layout_variant,
                logo_position=logo_position,
                content_format=content_format,
                label=label,
                side=side,
                logo_b64=logo_b64,
                overlay_start_pct=overlay_start_pct,
                **render_params,
            )
        finally:
            os.unlink(tmp.name)
    else:
        result = composite(
            photo_path=photo_path,
            headline=headline,
            body=body,
            layout_variant=layout_variant,
            logo_position=logo_position,
            content_format=content_format,
            label=label,
            side=side,
            logo_b64=logo_b64,
            overlay_start_pct=overlay_start_pct,
            **render_params,
        )

    return result
