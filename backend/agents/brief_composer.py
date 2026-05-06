"""
brief_composer.py — A5 Brief Composer (zero LLM).

Assembla un CreativeBrief da uno slot del piano editoriale + brand_kit_opus.
Deterministico: legge pillar_identity, angle_identity, personas, key_messages.
"""

from __future__ import annotations

from typing import Optional, TypedDict


class CreativeBrief(TypedDict):
    # Slot base
    pillar: str
    angle: str
    persona: str
    scheduled_date: str
    format: str
    platform: str

    # Da pillar_identity
    pillar_percentage: int
    pillar_description: str
    pillar_formats: list[str]
    photo_filter: dict
    accent_variant: str
    mood_keywords: list[str]
    layout_preference: list[str]

    # Da angle_identity
    angle_frequency: str
    angle_energy: str
    headline_style: str
    caption_length: str
    angle_example_headline: str

    # Da key_messages + personas
    persona_message: str
    hashtags: list[str]

    # Da seasonality
    season_level: str
    seasonal_mood: str
    seasonal_events: list[dict]
    seasonal_accent: str

    # Contesto aggiuntivo
    tone_of_voice: str
    rules_dont: list[str]


def compose(
    slot: dict,
    brand_kit_opus: dict,
    seasonal_context: Optional[dict] = None,
) -> CreativeBrief:
    """
    Assembla un CreativeBrief completo da slot + brand_kit_opus.

    slot deve contenere: pillar, angle, persona, scheduled_date
    Campi opzionali: format, platform
    """
    pillar_name = slot.get("pillar", "")
    angle_name = slot.get("angle", "")
    persona_name = slot.get("persona", "")

    # ── Pillar Identity ───────────────────────────────────────────────────────
    ds = brand_kit_opus.get("design_system", {})
    pillar_id_list = ds.get("pillar_identity", []) or brand_kit_opus.get("pillar_identity", [])

    pillar_data = {}
    for pi in pillar_id_list:
        if pi.get("name", "").lower() == pillar_name.lower():
            pillar_data = pi
            break

    # Fallback: cerca nei pillar_identity senza design_system
    if not pillar_data:
        for pi in brand_kit_opus.get("pillar_identity", []):
            if pi.get("name", "").lower() == pillar_name.lower():
                pillar_data = pi
                break

    # Fallback ulteriore: cerca nei pillars base
    pillar_desc = pillar_data.get("description", "")
    pillar_pct = pillar_data.get("percentage", 0)
    if not pillar_desc:
        for p in brand_kit_opus.get("pillars", []):
            if p.get("name", "").lower() == pillar_name.lower():
                pillar_desc = p.get("description", "")
                pillar_pct = p.get("percentage", 0)
                break

    photo_filter = pillar_data.get("photo_filter", {})
    accent_variant = pillar_data.get("accent_variant", "")
    mood_keywords = pillar_data.get("mood_keywords", [])
    layout_preference = pillar_data.get("layout_preference", [])
    pillar_formats = pillar_data.get("formats", [])

    # ── Angle Identity ────────────────────────────────────────────────────────
    angle_id_list = ds.get("angle_identity", []) or brand_kit_opus.get("angle_identity", [])

    angle_data = {}
    for ai in angle_id_list:
        if ai.get("name", "").lower() == angle_name.lower():
            angle_data = ai
            break

    angle_frequency = angle_data.get("frequency", "")
    angle_energy = angle_data.get("energy", "")
    headline_style = angle_data.get("headline_style", "")
    caption_length = angle_data.get("caption_length", "media 30-60 palabras")
    angle_example = angle_data.get("example_headline", "")

    # Photo filter: merge pillar filter con angle filter (angle ha priorità)
    if angle_data.get("photo_filter"):
        merged_filter = {**photo_filter, **angle_data["photo_filter"]}
    else:
        merged_filter = photo_filter

    # ── Personas + Key Messages ───────────────────────────────────────────────
    key_messages = brand_kit_opus.get("key_messages", {})
    per_persona = key_messages.get("per_persona", {})

    persona_message = ""
    for pname, msg in per_persona.items():
        if persona_name.lower() in pname.lower() or pname.lower() in persona_name.lower():
            persona_message = msg
            break

    hashtags = key_messages.get("hashtags", []) or brand_kit_opus.get("hashtags", [])

    # ── Tone + Rules ──────────────────────────────────────────────────────────
    identity = brand_kit_opus.get("identity", {})
    tone_of_voice = (
        brand_kit_opus.get("tone_of_voice", "")
        or identity.get("tone_of_voice", "")
    )
    rules_dont = (
        identity.get("rules_dont", [])
        or brand_kit_opus.get("rules_dont", [])
        or ds.get("rules_dont", [])
    )

    # ── Seasonal Context ──────────────────────────────────────────────────────
    season_level = ""
    seasonal_mood = ""
    seasonal_events: list[dict] = []
    seasonal_accent = accent_variant

    if seasonal_context:
        season_level = seasonal_context.get("season_level", "")
        seasonal_mood = seasonal_context.get("mood", "")
        seasonal_events = seasonal_context.get("events", [])
        if seasonal_context.get("accent_shift"):
            seasonal_accent = seasonal_context["accent_shift"]

    return CreativeBrief(
        pillar=pillar_name,
        angle=angle_name,
        persona=persona_name,
        scheduled_date=slot.get("scheduled_date", ""),
        format=slot.get("format", "Post 1:1"),
        platform=slot.get("platform", "instagram"),
        pillar_percentage=pillar_pct,
        pillar_description=pillar_desc,
        pillar_formats=pillar_formats,
        photo_filter=merged_filter,
        accent_variant=seasonal_accent,
        mood_keywords=mood_keywords,
        layout_preference=layout_preference,
        angle_frequency=angle_frequency,
        angle_energy=angle_energy,
        headline_style=headline_style,
        caption_length=caption_length,
        angle_example_headline=angle_example,
        persona_message=persona_message,
        hashtags=hashtags,
        season_level=season_level,
        seasonal_mood=seasonal_mood,
        seasonal_events=seasonal_events,
        seasonal_accent=seasonal_accent,
        tone_of_voice=tone_of_voice,
        rules_dont=rules_dont,
    )


def to_prompt_block(brief: CreativeBrief) -> str:
    """
    Converte il CreativeBrief in un blocco testo leggibile per CopyAgent e ArtDirector.
    """
    filter_str = " | ".join(
        f"{k}: {v}" for k, v in brief.get("photo_filter", {}).items() if v
    )
    rules = "\n".join(f"  ✗ {r}" for r in brief.get("rules_dont", [])[:5])
    events_str = ", ".join(e.get("note", "")[:60] for e in brief.get("seasonal_events", []))

    season_line = f"TEMPORADA: {brief['season_level'].upper()}" if brief.get("season_level") else "TEMPORADA: N/D"
    mood_line = f"Mood estacional: {brief['seasonal_mood']}" if brief.get("seasonal_mood") else ""
    events_line = f"Eventos: {events_str}" if events_str else ""

    return (
        "=== CREATIVE BRIEF ===\n"
        f"Pilar:     {brief['pillar']} ({brief['pillar_percentage']}%) — {brief['pillar_description'][:120]}\n"
        f"Ángulo:    {brief['angle']} [{brief['angle_energy']}]\n"
        f"Persona:   {brief['persona']}\n"
        f"Fecha:     {brief['scheduled_date']} | Formato: {brief['format']} | Canal: {brief['platform']}\n"
        "\n"
        f"HEADLINE STYLE: {brief['headline_style']}\n"
        f"Ejemplo:   {brief['angle_example_headline']}\n"
        f"Caption:   {brief['caption_length']}\n"
        "\n"
        f"Mensaje para {brief['persona']}: {brief['persona_message']}\n"
        f"Hashtags:  {' '.join(brief['hashtags'])}\n"
        "\n"
        "VISUAL:\n"
        f"Filtro foto:  {filter_str or 'neutro'}\n"
        f"Mood:         {', '.join(brief['mood_keywords'][:3])}\n"
        f"Layout:       {', '.join(brief['layout_preference'][:3]) or 'libre'}\n"
        f"Acento:       {brief['accent_variant']}\n"
        "\n"
        f"{season_line}\n"
        + (f"{mood_line}\n" if mood_line else "")
        + (f"{events_line}\n" if events_line else "")
        + "\n"
        f"TONO DE VOZ: {brief['tone_of_voice'][:200]}\n"
        "\n"
        "REGLAS (no hacer):\n"
        f"{rules}\n"
        "=== FIN BRIEF ==="
    )
