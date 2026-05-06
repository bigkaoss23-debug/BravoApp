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

def apply_photo_filters(img: Image.Image, filters: dict) -> Image.Image:
    """
    Applica i filtri del brand kit a una PIL Image.

    filters dict può contenere:
      temperature: "warm" | "cool" | "neutral"   (default: neutral)
      saturation:  float   (1.0 = invariato, 1.2 = +20%, 0.8 = -20%)
      contrast:    float   (1.0 = invariato)
      brightness:  float   (1.0 = invariato)
      blur:        float   (0 = nessuno, 1 = leggero)
    """
    if not filters:
        return img

    result = img.convert("RGB")

    # ── Temperature ──────────────────────────────────────────────────────────
    temp = (filters.get("temperature") or "neutral").lower()
    if temp == "warm":
        r, g, b = result.split()
        r = r.point(lambda i: min(255, int(i * 1.08)))
        b = b.point(lambda i: int(i * 0.92))
        result = Image.merge("RGB", (r, g, b))
    elif temp == "cool":
        r, g, b = result.split()
        r = r.point(lambda i: int(i * 0.92))
        b = b.point(lambda i: min(255, int(i * 1.08)))
        result = Image.merge("RGB", (r, g, b))

    # ── Saturation ───────────────────────────────────────────────────────────
    sat = filters.get("saturation")
    if sat and sat != 1.0:
        result = ImageEnhance.Color(result).enhance(float(sat))

    # ── Contrast ─────────────────────────────────────────────────────────────
    contr = filters.get("contrast")
    if contr and contr != 1.0:
        result = ImageEnhance.Contrast(result).enhance(float(contr))

    # ── Brightness ───────────────────────────────────────────────────────────
    bright = filters.get("brightness")
    if bright and bright != 1.0:
        result = ImageEnhance.Brightness(result).enhance(float(bright))

    # ── Blur (leggero effetto soft) ───────────────────────────────────────────
    blur = filters.get("blur", 0)
    if blur and blur > 0:
        result = result.filter(ImageFilter.GaussianBlur(radius=float(blur)))

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
