"""
seasonality.py — A2 Seasonality Engine (zero LLM).

Lookup: mese → SeasonalContext dal brand kit.
Legge seasonality (mesi alta/media/baja + events) e seasonal_palette (accent_shift + mood).
"""

from __future__ import annotations

from datetime import date
from typing import TypedDict, Optional


class SeasonalContext(TypedDict):
    month: str
    month_num: int
    season_level: str          # alta | media | baja
    accent_shift: str          # hex color override per la stagione
    mood: str                  # descrizione mood stagionale
    events: list[dict]         # [{period, note}] eventi del mese
    content_priority: str      # alta → impacto, media → regular, baja → inspiración


_MONTH_NAMES_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

_MONTH_TO_SEASON_KEY = {
    1: "invierno", 2: "invierno", 3: "primavera", 4: "primavera",
    5: "primavera", 6: "verano", 7: "verano", 8: "verano",
    9: "otono", 10: "otono", 11: "otono", 12: "invierno",
}

_PRIORITY_MAP = {
    "alta": "Máximo impacto — contenido de conversión y visibilidad",
    "media": "Contenido regular — mantener ritmo editorial",
    "baja": "Inspiración y comunidad — contenido evergreen y planificación",
}


def get_seasonal_context(
    brand_kit_opus: dict,
    month_num: Optional[int] = None,
) -> SeasonalContext:
    """
    Restituisce il contesto stagionale per un mese dato (default: mese corrente).
    Legge da brand_kit_opus.seasonality e brand_kit_opus.seasonal_palette.
    """
    if month_num is None:
        month_num = date.today().month

    month_name = _MONTH_NAMES_ES[month_num]

    seasonality = brand_kit_opus.get("seasonality", {})
    season_level = "media"

    # Formato v2: {alta: ["Octubre", ...], media: [...], baja: [...]}
    for level in ("alta", "media", "baja"):
        if month_name in seasonality.get(level, []):
            season_level = level
            break
    else:
        # Formato v1 (Opus): seasonal_calendar = [{month, season, ...}]
        for entry in brand_kit_opus.get("seasonal_calendar", []):
            if entry.get("month", "").lower() == month_name.lower():
                raw = entry.get("season", "media")
                season_level = raw if raw in ("alta", "media", "baja") else "media"
                break

    seasonal_palette = brand_kit_opus.get("seasonal_palette", {})
    ds_palette = brand_kit_opus.get("design_system", {}).get("seasonal_palette", {})
    palette = seasonal_palette or ds_palette

    season_key = _MONTH_TO_SEASON_KEY.get(month_num, "primavera")
    season_data = palette.get(season_key, {})
    accent_shift = season_data.get("accent_shift", "")
    mood = season_data.get("mood", "")

    events = [
        e for e in seasonality.get("events", [])
        if e.get("period", "").lower() == month_name.lower()
    ]

    # Fallback v1: seasonal_calendar ha event + content_opportunity per mese
    if not events:
        for entry in brand_kit_opus.get("seasonal_calendar", []):
            if entry.get("month", "").lower() == month_name.lower():
                ev = entry.get("event", "")
                if ev:
                    events.append({"period": month_name, "note": f"{ev} — {entry.get('content_opportunity', '')}"})

    return SeasonalContext(
        month=month_name,
        month_num=month_num,
        season_level=season_level,
        accent_shift=accent_shift,
        mood=mood,
        events=events,
        content_priority=_PRIORITY_MAP.get(season_level, ""),
    )


def get_yearly_overview(brand_kit_opus: dict) -> list[SeasonalContext]:
    """Panoramica dei 12 mesi — utile per il Planner."""
    return [get_seasonal_context(brand_kit_opus, m) for m in range(1, 13)]
