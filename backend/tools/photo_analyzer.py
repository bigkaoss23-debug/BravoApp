"""
Analizza la foto per quadrante e suggerisce i layout più adatti.
Zero token — pura analisi PIL su thumbnail 200px.
"""
import random
from PIL import Image
from typing import List, Optional

# Mappa layout → zona dove viene renderizzato il testo
_LAYOUT_ZONE = {
    "bottom-left":       "bottom_left",
    "bottom-right":      "bottom_right",
    "bottom-full":       "bottom",
    "top-left":          "top_left",
    "top-right":         "top_right",
    "center":            "center",
    "centered-header":   "center",
    "centered-with-logo":"center",
    "asymmetric-left":   "left",
    "asymmetric-right":  "right",
}

ALL_LAYOUTS = list(_LAYOUT_ZONE.keys())


def _avg_brightness(img: Image.Image, x0: int, y0: int, x1: int, y1: int) -> float:
    """Luminosità media (0=nero, 255=bianco) in un rettangolo."""
    region = img.crop((x0, y0, x1, y1))
    pixels = list(region.getdata())
    if not pixels:
        return 128.0
    return sum(0.299 * r + 0.587 * g + 0.114 * b for r, g, b in pixels) / len(pixels)


def analyze_photo(photo_path: str) -> List[str]:
    """
    Restituisce tutti i layout ordinati dal più adatto al meno adatto
    per questa foto specifica.

    Logica: testo bianco → zone più scure sono più leggibili.
    Analisi su thumbnail 200px (velocissima, nessun token).
    """
    img = Image.open(photo_path).convert("RGB").resize((200, 200))
    W, H = 200, 200
    hw, hh = W // 2, H // 2

    zone_brightness = {
        "bottom_left":  _avg_brightness(img, 0,   hh,  hw,  H),
        "bottom_right": _avg_brightness(img, hw,  hh,  W,   H),
        "bottom":       _avg_brightness(img, 0,   hh,  W,   H),
        "top_left":     _avg_brightness(img, 0,   0,   hw,  hh),
        "top_right":    _avg_brightness(img, hw,  0,   W,   hh),
        "center":       _avg_brightness(img, W//4, H//4, 3*W//4, 3*H//4),
        "left":         _avg_brightness(img, 0,   0,   hw,  H),
        "right":        _avg_brightness(img, hw,  0,   W,   H),
    }

    # Ordina: zona più scura = testo più leggibile = layout preferito
    ranked = sorted(
        ALL_LAYOUTS,
        key=lambda l: zone_brightness.get(_LAYOUT_ZONE[l], 128)
    )
    return ranked


def pick_layout(photo_path: str, used_layouts: Optional[List[str]] = None, top_n: int = 4) -> str:
    """
    Sceglie un layout adatto alla foto evitando quelli usati di recente.
    - Analizza la foto
    - Prende i top_n layout più adatti
    - Esclude quelli già usati (varietà)
    - Sceglie in modo casuale tra i candidati rimasti
    """
    ranked = analyze_photo(photo_path)
    candidates = ranked[:top_n]

    # Rimuovi i layout già usati di recente per garantire varietà
    if used_layouts:
        fresh = [l for l in candidates if l not in used_layouts]
        if fresh:
            candidates = fresh

    return random.choice(candidates)
