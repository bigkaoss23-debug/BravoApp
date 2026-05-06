"""
Analizza la foto per quadrante e suggerisce i layout più adatti.
Zero token — pura analisi PIL su thumbnail 200px.

v2: aggiunge dominant_color, time_of_day, suggested_angle.
"""
import colorsys
import random
from PIL import Image
from typing import List, Optional, TypedDict

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

# Soglia: una zona è "viabile" per il testo se la luminosità è < questo valore
# (dopo che il gradiente scuro verrà applicato sopra)
_VIABILITY_THRESHOLD = 140


def _avg_brightness(img: Image.Image, x0: int, y0: int, x1: int, y1: int) -> float:
    """Luminosità media (0=nero, 255=bianco) in un rettangolo."""
    region = img.crop((x0, y0, x1, y1))
    pixels = list(region.getdata())
    if not pixels:
        return 128.0
    return sum(0.299 * r + 0.587 * g + 0.114 * b for r, g, b in pixels) / len(pixels)


class PhotoAnalysis(TypedDict):
    ranked_layouts: List[str]          # tutti i layout ordinati dal più adatto
    best_layout: str                   # layout consigliato principale
    second_layout: Optional[str]       # secondo layout (zona diversa), se esiste
    overlay_start_pct: float           # dove inizia il gradiente scuro (0.0-1.0)
    viable_zones: int                  # quante zone distinte sono buone per il testo
    zone_brightness: dict              # mappa zona → luminosità (debug)
    dominant_color: str                # hex del colore dominante non-neutro
    time_of_day: str                   # stima: dawn/morning/midday/afternoon/sunset/night/indoor
    suggested_angle: str               # angolo narrativo suggerito dalla scena


def _dominant_color(img: Image.Image) -> str:
    """
    Restituisce il colore dominante non-neutro come hex.
    Esclude bianchi, neri e grigi (saturazione <0.12).
    """
    small = img.resize((80, 80))
    pixels = list(small.getdata())
    color_count: dict = {}
    for r, g, b in pixels:
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s < 0.12 or v < 0.08 or v > 0.95:
            continue
        # Quantizza hue a bucket di 15°
        bucket = int(h * 24) * 15
        color_count[bucket] = color_count.get(bucket, 0) + 1
    if not color_count:
        return "#888888"
    dominant_hue = max(color_count, key=color_count.get)
    h_norm = dominant_hue / 360
    r, g, b = colorsys.hsv_to_rgb(h_norm, 0.6, 0.75)
    return "#{:02X}{:02X}{:02X}".format(int(r * 255), int(g * 255), int(b * 255))


def _time_of_day(img: Image.Image, avg_brightness: float) -> str:
    """
    Stima il momento della giornata basandosi su luminosità e temperatura colore.
    """
    small = img.resize((80, 80))
    pixels = list(small.getdata())
    if not pixels:
        return "indoor"

    avg_r = sum(p[0] for p in pixels) / len(pixels)
    avg_g = sum(p[1] for p in pixels) / len(pixels)
    avg_b = sum(p[2] for p in pixels) / len(pixels)
    warmth = avg_r - avg_b  # positivo = caldo, negativo = freddo

    if avg_brightness < 40:
        return "night"
    if avg_brightness < 90:
        if warmth > 20:
            return "sunset" if warmth > 40 else "dawn"
        return "night"
    if avg_brightness > 180:
        if warmth > 30:
            return "dawn" if avg_brightness < 210 else "morning"
        if warmth < -20:
            return "midday"
        return "morning"
    if warmth > 35:
        return "sunset"
    if warmth > 15:
        return "afternoon"
    if warmth < -25:
        return "midday"
    return "indoor"


def _suggest_angle(time_of_day: str, dominant_color: str, avg_brightness: float) -> str:
    """
    Suggerisce un angolo narrativo basato sulle caratteristiche visive della foto.
    """
    warm_colors = {"#FF", "#FE", "#FD", "#FC", "#FB", "#F8", "#E8", "#D4", "#C8"}
    hex_prefix = dominant_color[:3].upper()
    is_warm = hex_prefix in warm_colors or dominant_color[1:3].upper() in {"FF", "FE", "FD", "F5", "EB"}

    if time_of_day in ("sunset", "dawn"):
        return "Detalle Silencioso"
    if time_of_day == "night":
        return "Detalle Silencioso"
    if time_of_day in ("morning", "midday") and avg_brightness > 160:
        return "Voz del Huésped"
    if is_warm and avg_brightness > 140:
        return "Destino Emocional"
    return "Experiencia Íntima"


def analyze_photo(photo_path: str) -> List[str]:
    """
    Compatibilità con il codice esistente.
    Restituisce la lista ranked dei layout.
    """
    return analyze_photo_full(photo_path)["ranked_layouts"]


def analyze_photo_full(photo_path: str) -> PhotoAnalysis:
    """
    Analisi completa della foto:
    1. Calcola luminosità per 8 zone → ranked_layouts
    2. Scansione a bande orizzontali → trova dove inizia la zona scura (overlay_start_pct)
    3. Identifica se ci sono 2 zone viabili distinte (top e bottom) → viable_zones
    """
    img = Image.open(photo_path).convert("RGB").resize((200, 200))
    W, H = 200, 200
    hw, hh = W // 2, H // 2

    # ── 1. Luminosità per zona ────────────────────────────────────────────────
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

    ranked_layouts = sorted(
        ALL_LAYOUTS,
        key=lambda l: zone_brightness.get(_LAYOUT_ZONE[l], 128)
    )

    # ── 2. Scansione a bande orizzontali → overlay_start_pct ─────────────────
    # Divide la foto in 20 strisce orizzontali, calcola luminosità di ciascuna.
    # Cerca dall'alto verso il basso la prima striscia che scende sotto soglia.
    # Questo è il punto naturale in cui il gradiente deve iniziare.
    n_bands = 20
    band_h = H // n_bands
    band_brightness = []
    for i in range(n_bands):
        b = _avg_brightness(img, 0, i * band_h, W, (i + 1) * band_h)
        band_brightness.append(b)

    # Trova dall'alto il primo punto in cui la luminosità scende durevolmente
    # (usa una finestra mobile di 3 bande per evitare outlier)
    overlay_start_pct = 0.55  # default sicuro
    for i in range(n_bands - 2):
        window_avg = sum(band_brightness[i:i+3]) / 3
        if window_avg < _VIABILITY_THRESHOLD:
            overlay_start_pct = round(i / n_bands, 2)
            break

    # Non partire mai prima del 30% (lascia respirare la foto)
    overlay_start_pct = max(0.30, min(overlay_start_pct, 0.72))

    # ── 3. Zone viabili distinte ──────────────────────────────────────────────
    # "Top viabile": la zona superiore (top_left o top_right) è abbastanza scura
    # "Bottom viabile": la zona inferiore (bottom) è abbastanza scura
    top_bright    = min(zone_brightness["top_left"], zone_brightness["top_right"])
    bottom_bright = zone_brightness["bottom"]

    top_viable    = top_bright    < _VIABILITY_THRESHOLD
    bottom_viable = bottom_bright < _VIABILITY_THRESHOLD

    # Se nessuna zona è naturalmente scura, il gradiente le renderà comunque usabili
    if not top_viable and not bottom_viable:
        bottom_viable = True  # bottom con gradiente è sempre il fallback

    viable_zones = (1 if top_viable else 0) + (1 if bottom_viable else 0)

    # Best layout = il primo della lista ranked
    best_layout = ranked_layouts[0]

    # Second layout = il primo layout che usa una zona diversa da best
    best_zone = _LAYOUT_ZONE[best_layout]
    best_is_bottom = "bottom" in best_zone
    second_layout = None
    for l in ranked_layouts[1:]:
        zone = _LAYOUT_ZONE[l]
        l_is_bottom = "bottom" in zone
        if l_is_bottom != best_is_bottom:
            second_layout = l
            break

    # Se ci sono 2 zone viabili ma non abbiamo trovato un secondo layout opposto, usa top-left
    if viable_zones >= 2 and second_layout is None:
        second_layout = "top-left" if best_is_bottom else "bottom-full"

    # ── 4. Colore dominante, time-of-day, angolo suggerito ────────────────────
    avg_bright_global = sum(zone_brightness.values()) / len(zone_brightness)
    dom_color = _dominant_color(img)
    tod = _time_of_day(img, avg_bright_global)
    angle_hint = _suggest_angle(tod, dom_color, avg_bright_global)

    return PhotoAnalysis(
        ranked_layouts=ranked_layouts,
        best_layout=best_layout,
        second_layout=second_layout if viable_zones >= 2 else None,
        overlay_start_pct=overlay_start_pct,
        viable_zones=viable_zones,
        zone_brightness=zone_brightness,
        dominant_color=dom_color,
        time_of_day=tod,
        suggested_angle=angle_hint,
    )


def pick_layout(photo_path: str, used_layouts: Optional[List[str]] = None, top_n: int = 4) -> str:
    """
    Sceglie un layout adatto alla foto evitando quelli usati di recente.
    """
    ranked = analyze_photo(photo_path)
    candidates = ranked[:top_n]

    if used_layouts:
        fresh = [l for l in candidates if l not in used_layouts]
        if fresh:
            candidates = fresh

    return random.choice(candidates)
