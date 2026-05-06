"""
persona_router.py — A3 Persona Router (zero LLM).

Assegna persona A o B per ogni slot del piano editoriale.
Logica: affinità angolo→persona + bilanciamento ~50/50 mensile.
"""

from __future__ import annotations

from typing import Optional


def _build_affinity_map(brand_kit_opus: dict) -> dict[str, str]:
    """
    Costruisce mappa angolo → persona preferita dai key_messages.
    Se un messaggio per_persona menziona concetti affini a un angolo, lo associa.
    """
    key_messages = brand_kit_opus.get("key_messages", {})
    per_persona = key_messages.get("per_persona", {})
    personas = brand_kit_opus.get("personas", [])

    if len(personas) < 2:
        return {}

    persona_a = personas[0].get("name", "Persona A")
    persona_b = personas[1].get("name", "Persona B")

    angles = brand_kit_opus.get("angle_identity", [])
    ds_angles = brand_kit_opus.get("design_system", {}).get("angle_identity", [])
    all_angles = angles or ds_angles

    affinity: dict[str, str] = {}
    for angle in all_angles:
        aname = angle.get("name", "")
        aname_low = aname.lower()

        if any(kw in aname_low for kw in ["huésped", "voz", "testimon", "reseña"]):
            affinity[aname] = persona_b
        elif any(kw in aname_low for kw in ["pausa", "mañana", "ritual", "íntim", "detalle"]):
            affinity[aname] = persona_a
        elif any(kw in aname_low for kw in ["guía", "ruta", "territorio", "local"]):
            affinity[aname] = persona_b
        elif any(kw in aname_low for kw in ["trampa", "antes", "después", "contraste"]):
            affinity[aname] = persona_a

    return affinity


def route_persona(
    angle_name: str,
    brand_kit_opus: dict,
    assigned_so_far: Optional[list[str]] = None,
) -> str:
    """
    Assegna la persona per uno slot dato l'angolo narrativo.

    1. Se c'è affinità naturale angolo→persona, la usa
    2. Se il bilanciamento è sbilanciato, forza la persona meno usata
    3. Default: persona A
    """
    personas = brand_kit_opus.get("personas", [])
    if len(personas) < 2:
        return personas[0].get("name", "Persona A") if personas else "Persona A"

    persona_a = personas[0].get("name", "Persona A")
    persona_b = personas[1].get("name", "Persona B")

    affinity = _build_affinity_map(brand_kit_opus)
    natural_pick = affinity.get(angle_name)

    if assigned_so_far is None:
        return natural_pick or persona_a

    count_a = sum(1 for p in assigned_so_far if p == persona_a)
    count_b = sum(1 for p in assigned_so_far if p == persona_b)
    total = count_a + count_b

    if total > 0:
        ratio_a = count_a / total
        if ratio_a > 0.65:
            return persona_b
        if ratio_a < 0.35:
            return persona_a

    return natural_pick or persona_a


def route_plan(
    slots: list[dict],
    brand_kit_opus: dict,
) -> list[dict]:
    """
    Assegna persona a tutti gli slot di un piano mensile.
    Ogni slot deve avere almeno 'angle' come chiave.
    Restituisce gli slot con 'persona' aggiunta.
    """
    assigned: list[str] = []
    result = []

    for slot in slots:
        angle = slot.get("angle", "")
        persona = route_persona(angle, brand_kit_opus, assigned)
        assigned.append(persona)
        result.append({**slot, "persona": persona})

    return result
