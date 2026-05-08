"""
brief_composer.py — A5 Brief Composer (zero LLM).

Assembla un CreativeBrief da uno slot del piano editoriale + brand_kit_opus.
Deterministico: legge pillar_identity, angle_identity, personas, key_messages.
"""

from __future__ import annotations

from datetime import date as _date
from typing import Optional, TypedDict


# ── Variante stagionale ───────────────────────────────────────────────────────
# Range plausibili dell'ora del mattino in base al mese (alba in Spagna del Sud).
_MORNING_TIME_RANGES = {
    1:  (8, 30, 9, 30),   # gennaio
    2:  (8, 0,  9, 15),
    3:  (7, 30, 9, 0),
    4:  (7, 15, 8, 45),
    5:  (7, 0,  8, 30),   # maggio
    6:  (6, 45, 8, 15),
    7:  (7, 0,  8, 30),
    8:  (7, 15, 8, 45),
    9:  (7, 30, 9, 0),
    10: (7, 45, 9, 15),
    11: (8, 15, 9, 30),
    12: (8, 30, 9, 30),
}

_SEASON_DESCRIPTORS = {
    1:  ("invierno", "luz baja, neblina, piedra fría"),
    2:  ("invierno tardío", "almendros que empiezan a florecer, viento limpio"),
    3:  ("primavera incipiente", "verde nuevo, mañanas frescas, días largos"),
    4:  ("primavera", "almendros en flor, hierba alta, sierra verde"),
    5:  ("primavera plena", "almendros recientes, sierra verde, luz suave"),
    6:  ("inicio de verano", "luz larga, calor seco, atardeceres sin final"),
    7:  ("verano", "calor pesado, sombras profundas, noches templadas"),
    8:  ("verano tardío", "tierra dorada, viento del Tajo, higos maduros"),
    9:  ("vendimia", "uva madura, polvo del campo, primer frescor de noche"),
    10: ("otoño", "mosto, piedra mojada, niebla matinal sobre la sierra"),
    11: ("otoño tardío", "olivar gris, hojas secas, chimenea encendida"),
    12: ("invierno", "luz corta, frío seco, almendros desnudos"),
}


def _parse_date(s: str) -> Optional[_date]:
    if not s:
        return None
    try:
        return _date.fromisoformat(s[:10])
    except Exception:
        return None


def _time_hint_for_date(scheduled_date: str) -> str:
    """
    Restituisce un orario plausibile per la data data, variando deterministicamente
    in base al giorno del mese — così post diversi nello stesso mese hanno ore diverse.
    """
    d = _parse_date(scheduled_date)
    if d is None:
        return ""
    h_start, m_start, h_end, m_end = _MORNING_TIME_RANGES.get(d.month, (7, 30, 8, 30))
    start_min = h_start * 60 + m_start
    end_min = h_end * 60 + m_end
    span = max(end_min - start_min, 30)
    # offset deterministico sul giorno del mese, a passi di ~5 min
    offset = (d.day * 13) % span  # 13 = primo per dare buona dispersione
    total = start_min + offset
    h, m = divmod(total, 60)
    # arrotonda al multiplo di 5 più vicino per rendere "naturale"
    m = (m // 5) * 5
    return f"{h:02d}:{m:02d}"


def _seasonal_descriptor_for_date(scheduled_date: str) -> tuple[str, str]:
    """Ritorna (label_stagione, descrittore_sensoriale) per la data data."""
    d = _parse_date(scheduled_date)
    if d is None:
        return ("", "")
    return _SEASON_DESCRIPTORS.get(d.month, ("", ""))


class CreativeBrief(TypedDict):
    # Slot base
    pillar: str
    angle: str
    persona: str
    scheduled_date: str
    format: str
    platform: str

    # Da pillar_identity (descripción completa, sin truncar)
    pillar_percentage: int
    pillar_description: str
    pillar_formats: list[str]
    photo_filter: dict
    accent_variant: str
    mood_keywords: list[str]
    layout_preference: list[str]

    # Da angle_identity (descripción completa — la escena concreta)
    angle_description: str    # LA SUSTANCIA: «Mostrar un micro-detalle...»
    angle_frequency: str
    angle_energy: str
    headline_style: str
    caption_length: str
    angle_example_headline: str

    # Da identity (la voz de la marca, ejemplos concretos)
    tone_of_voice: str        # texto completo, sin truncar
    tone_voice_example: str   # «Esta mañana la niebla cubría el Tajo...»
    rules_dont: list[str]

    # Da personas (perfil + mensaje que resuena con esa persona)
    persona_profile: str      # «profesionales con ritmo de vida intenso...»
    persona_resonating_message: str  # «Aquí el tiempo pasa diferente.»
    persona_message: str      # da key_messages — mensaje editorial específico

    # Hashtags + cliente
    hashtags: list[str]
    client_description: str   # descripción del cliente para contexto general

    # Da seasonality
    season_level: str
    seasonal_mood: str
    seasonal_events: list[dict]
    seasonal_accent: str

    # Variante stagionale per data (deterministica, evita ripetizioni)
    season_label: str
    season_descriptor: str
    time_hint: str


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

    angle_description = angle_data.get("description", "")
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

    # Persona profile + resonating message dalla Sezione 04 del briefing
    personas_list = brand_kit_opus.get("personas", []) or []
    persona_profile = ""
    persona_resonating = ""
    for pdata in personas_list:
        pname = (pdata.get("name", "") or "").lower()
        if pname and (persona_name.lower() in pname or pname in persona_name.lower()):
            persona_profile = pdata.get("profile", "")
            persona_resonating = pdata.get("resonating_message", "")
            break

    hashtags = key_messages.get("hashtags", []) or brand_kit_opus.get("hashtags", [])

    # ── Identity: tono + ejemplo concreto + reglas ────────────────────────────
    identity = brand_kit_opus.get("identity", {})
    tone_of_voice = (
        identity.get("tone_of_voice", "")
        or brand_kit_opus.get("tone_of_voice", "")
    )
    tone_voice_example = identity.get("example_correct", "")
    rules_dont = (
        identity.get("rules_dont", [])
        or brand_kit_opus.get("rules_dont", [])
        or ds.get("rules_dont", [])
    )

    # ── Cliente (Sezione 01 del briefing) ─────────────────────────────────────
    client_info = brand_kit_opus.get("client_info", {}) or {}
    client_description = client_info.get("description", "")

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

    # ── Variante stagionale (deterministica per data) ─────────────────────────
    sched_date = slot.get("scheduled_date", "")
    season_label, season_descriptor = _seasonal_descriptor_for_date(sched_date)

    # time_hint solo per angle che richiedono un orario nel headline_style
    time_hint = ""
    style_lower = headline_style.lower()
    if any(kw in style_lower for kw in ["x:xx", "hora", "orario", "horario"]):
        time_hint = _time_hint_for_date(sched_date)

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
        angle_description=angle_description,
        angle_frequency=angle_frequency,
        angle_energy=angle_energy,
        headline_style=headline_style,
        caption_length=caption_length,
        angle_example_headline=angle_example,
        tone_of_voice=tone_of_voice,
        tone_voice_example=tone_voice_example,
        rules_dont=rules_dont,
        persona_profile=persona_profile,
        persona_resonating_message=persona_resonating,
        persona_message=persona_message,
        hashtags=hashtags,
        client_description=client_description,
        season_level=season_level,
        seasonal_mood=seasonal_mood,
        seasonal_events=seasonal_events,
        seasonal_accent=seasonal_accent,
        season_label=season_label,
        season_descriptor=season_descriptor,
        time_hint=time_hint,
    )


def to_prompt_block(brief: CreativeBrief) -> str:
    """
    Converte il CreativeBrief in un blocco testo leggibile per CopyAgent e ArtDirector.

    Espone l'intera sostanza del briefing (descrizioni complete, esempi di tono,
    profilo persona) — il Copy Agent legge il briefing vero, non una versione
    impoverita. La voce della marca arriva dal briefing, non dal system prompt.
    """
    filter_str = " | ".join(
        f"{k}: {v}" for k, v in brief.get("photo_filter", {}).items() if v
    )
    rules = "\n".join(f"  ✗ {r}" for r in brief.get("rules_dont", []))
    events_str = ", ".join(e.get("note", "")[:60] for e in brief.get("seasonal_events", []))

    season_line = f"TEMPORADA: {brief['season_level'].upper()}" if brief.get("season_level") else ""
    mood_line = f"Mood estacional: {brief['seasonal_mood']}" if brief.get("seasonal_mood") else ""
    events_line = f"Eventos: {events_str}" if events_str else ""

    # Variante stagionale per data (deterministica)
    variant_lines = []
    if brief.get("season_label"):
        variant_lines.append(f"Momento del año: {brief['season_label']} — {brief['season_descriptor']}")
    if brief.get("time_hint"):
        variant_lines.append(
            f"Hora sugerida para ESTE post: {brief['time_hint']} "
            "(úsala literal si el headline_style pide hora; otros posts del mismo "
            "ángulo usarán horas distintas, no repitas otras horas)"
        )
    variant_block = ("\nVARIANTE PARA ESTE POST:\n" + "\n".join(variant_lines) + "\n") if variant_lines else ""

    # ── Blocchi narrativi (la sostanza del briefing) ─────────────────────────
    cliente_block = ""
    if brief.get("client_description"):
        cliente_block = f"\nCLIENTE:\n{brief['client_description']}\n"

    voz_block = ""
    if brief.get("tone_of_voice"):
        voz_block = f"\nVOZ DE LA MARCA:\n{brief['tone_of_voice']}\n"
    if brief.get("tone_voice_example"):
        voz_block += (
            f"\nEJEMPLO CONCRETO DE VOZ (referencia de tono — imita el espíritu, no copies palabras):\n"
            f"  «{brief['tone_voice_example']}»\n"
        )

    # Pilastro: descrizione completa, niente troncamento
    pilar_block = (
        f"\nPILAR: {brief['pillar']} ({brief['pillar_percentage']}%)\n"
        f"  {brief['pillar_description']}\n"
        if brief.get("pillar_description") else
        f"\nPILAR: {brief['pillar']} ({brief['pillar_percentage']}%)\n"
    )

    # Angolo: la SCENA CONCRETA — il cuore del brief
    angle_lines = [f"\nÁNGULO: {brief['angle']}"]
    if brief.get("angle_energy"):
        angle_lines[0] += f" [{brief['angle_energy']}]"
    if brief.get("angle_description"):
        angle_lines.append(f"  Escena/intención: {brief['angle_description']}")
    if brief.get("headline_style"):
        angle_lines.append(f"  Estilo de headline: {brief['headline_style']}")
    if brief.get("angle_example_headline"):
        angle_lines.append(
            f"  Ejemplo del cliente (referencia de IDEA, no de formato — "
            f"hoy escribimos en sentence case):\n    «{brief['angle_example_headline']}»"
        )
    if brief.get("caption_length"):
        angle_lines.append(f"  Caption: {brief['caption_length']}")
    angle_block = "\n".join(angle_lines) + "\n"

    # Persona: profilo + messaggio che risuona
    persona_lines = [f"\nPERSONA OBJETIVO: {brief['persona']}"]
    if brief.get("persona_profile"):
        persona_lines.append(f"  Perfil: {brief['persona_profile']}")
    if brief.get("persona_resonating_message"):
        persona_lines.append(
            f"  Mensaje que resuena en esta persona: «{brief['persona_resonating_message']}»"
        )
    if brief.get("persona_message"):
        persona_lines.append(f"  Mensaje editorial dirigido: {brief['persona_message']}")
    persona_block = "\n".join(persona_lines) + "\n"

    # ── Visuale ───────────────────────────────────────────────────────────────
    visual_block = (
        "\nVISUAL:\n"
        f"  Filtro foto: {filter_str or 'neutro'}\n"
        f"  Mood:        {', '.join(brief.get('mood_keywords', [])[:3])}\n"
        f"  Layout:      {', '.join(brief.get('layout_preference', [])[:3]) or 'libre'}\n"
        f"  Acento:      {brief.get('accent_variant', '')}\n"
    )

    # ── Stagionalità ──────────────────────────────────────────────────────────
    season_block = ""
    if season_line:
        season_block += f"\n{season_line}\n"
    if mood_line:
        season_block += f"{mood_line}\n"
    if events_line:
        season_block += f"{events_line}\n"
    season_block += variant_block

    # ── Reglas no hacer ──────────────────────────────────────────────────────
    rules_block = ""
    if rules:
        rules_block = f"\nREGLAS DE LA MARCA (no hacer):\n{rules}\n"

    # ── Hashtags ──────────────────────────────────────────────────────────────
    hashtags_block = (
        f"\nHashtags oficiales (máx 2): {' '.join(brief.get('hashtags', []))}\n"
        if brief.get("hashtags") else ""
    )

    # ── Slot meta ─────────────────────────────────────────────────────────────
    meta_block = (
        f"Fecha: {brief['scheduled_date']} | "
        f"Formato: {brief['format']} | "
        f"Canal: {brief['platform']}\n"
    )

    return (
        "=== CREATIVE BRIEF ===\n"
        + meta_block
        + cliente_block
        + voz_block
        + pilar_block
        + angle_block
        + persona_block
        + visual_block
        + season_block
        + rules_block
        + hashtags_block
        + "=== FIN BRIEF ==="
    )
