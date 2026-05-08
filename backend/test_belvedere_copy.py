"""
Test integrato Belvedere — Fase 1B post-fix.

Simula il brand_kit_opus realistico di Belvedere (dal briefing PDF) e
chiama il Copy Agent per ognuno dei 6 angoli + 4 archetipi rappresentativi.

Output: per ogni combo, headline + headline_alt + whisper + caption + reasoning.
Non rende immagini. Usa solo la chiave Anthropic.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Carica .env
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

sys.path.insert(0, str(Path(__file__).parent))

from agents.brief_composer import compose, to_prompt_block  # noqa: E402
from agents.copy_agent import CopyAgent  # noqa: E402


# ── brand_kit_opus simulato di Belvedere ────────────────────────────────────
BELVEDERE_BRAND_KIT = {
    "client_info": {
        "description": (
            "Hotel Belvedere es un hotel boutique de 18 habitaciones ubicado en Ronda (Málaga), "
            "en una casa señorial del siglo XIX restaurada con vistas a la Serranía de Ronda. "
            "Gestionado por la familia Morales desde 2018, el hotel ofrece una experiencia "
            "íntima y tranquila, orientada al turismo nacional de calidad y a parejas que buscan "
            "desconexión sin renunciar al confort."
        ),
    },
    "identity": {
        "name": "Hotel Belvedere",
        "slogan": "Donde Ronda empieza a susurrarte",
        "tone_of_voice": (
            "El hotel habla como un anfitrión tranquilo que conoce cada rincón del territorio. "
            "Cálido, nunca comercial. Evocador, nunca poético en exceso. Cercano, nunca informal. "
            "Frases cortas. Silencios intencionados. Sin exclamaciones. Sin emojis en feed."
        ),
        "example_correct": (
            "Esta mañana la niebla cubría el Tajo. "
            "Había algo en el aire que invitaba a quedarse un día más."
        ),
        "example_incorrect": "¡¡Reserva ahora y disfruta de Ronda al máximo!! 🏨🌄🔥",
        "rules_dont": [
            "No usar filtros de alto contraste o saturación excesiva en las fotos",
            "No publicar contenido promocional agresivo (descuentos, urgencia, FOMO)",
            "No etiquetar a competidores ni hacer comparaciones directas",
            "No usar más de dos hashtags por post de feed",
        ],
    },
    "personas": [
        {
            "name": "La Pareja en Pausa",
            "age_range": "30-50",
            "nationality": "española (Madrid, Barcelona, Sevilla)",
            "profile": (
                "profesionales con ritmo de vida intenso. Viajan 3-4 veces al año, "
                "eligen destinos con identidad. No buscan animación ni piscina olímpica. "
                "Buscan desayuno tranquilo, paseo por el casco histórico, cena con vino local."
            ),
            "channel": "Instagram (descubren el hotel por fotos de ambiente y recomendaciones).",
            "resonating_message": "Aquí el tiempo pasa diferente.",
        },
        {
            "name": "El Viajero Independiente",
            "age_range": "28-42",
            "nationality": "Mix de géneros | También turismo europeo (alemán, francés)",
            "profile": (
                "viaja solo o con amigo. Interesado en cultura, gastronomía local, "
                "rutas de senderismo por la Serranía. Reserva por Booking o directo si "
                "encuentra contenido que le genera confianza."
            ),
            "channel": "Instagram + Google. Lee reseñas completas.",
            "resonating_message": "Un lugar con historia real, no de escaparate.",
        },
    ],
    "pillar_identity": [
        {
            "name": "Territorio",
            "percentage": 30,
            "description": (
                "Ronda, la Serranía, el Tajo, los pueblos blancos, la gastronomía local. "
                "Contenido que posiciona al hotel como puerta de entrada al territorio, "
                "no solo como alojamiento."
            ),
            "formats": ["foto ambiental feed", "carrusel de ruta", "story informativa"],
        },
        {
            "name": "Experiencia íntima",
            "percentage": 30,
            "description": (
                "Detalles del hotel: la terraza al amanecer, el desayuno casero, la habitación "
                "con vistas, el silencio del patio interior. Lo que el huésped no espera encontrar."
            ),
            "formats": ["foto detalle feed", "story ambiental", "before/after sutil"],
        },
        {
            "name": "Huéspedes y testimonios",
            "percentage": 20,
            "description": (
                "Reseñas reales reinterpretadas con voz de marca. UGC de huéspedes con permiso. "
                "Humaniza el hotel sin perder el registro editorial."
            ),
        },
        {
            "name": "Temporada y agenda",
            "percentage": 20,
            "description": (
                "Contenido vinculado a la estacionalidad de Ronda: vendimia de octubre, "
                "Semana Santa, Feria de Pedro Romero en septiembre, niebla de invierno."
            ),
        },
    ],
    "angle_identity": [
        {
            "name": "Detalle silencioso",
            "frequency": "2 veces al mes en feed",
            "description": (
                "Mostrar un micro-detalle del hotel que el huésped no vería a primera vista: "
                "la cerámica del baño, el libro en la mesilla, la luz de la tarde en el pasillo."
            ),
            "headline_style": "fragmento corto, sentence case, evocador",
            "example_headline": "Hay cosas en Belvedere que solo se ven si te quedas quieto.",
            "caption_length": "media 30-60 palabras",
        },
        {
            "name": "Voz del huésped",
            "frequency": "1 vez por semana en stories, 1 cada dos semanas en feed",
            "description": (
                "Reseña real de Google o Booking convertida en pieza editorial. "
                "Cita del huésped como elemento central, foto ambiental del espacio descrito."
            ),
            "headline_style": "cita corta del huésped, sentence case",
            "example_headline": "No vine a ver Ronda. Vine a entender por qué la gente no se va.",
            "caption_length": "media 30-60 palabras",
        },
        {
            "name": "Ronda que no sale en guías",
            "frequency": "2 veces al mes",
            "description": (
                "Recomendaciones locales honestas: el bar de tapas de la familia García, "
                "el mirador que solo conocen los que preguntan en recepción, la ruta al amanecer."
            ),
            "headline_style": "frase con voz personal, sentence case",
            "example_headline": "El mejor café de Ronda no está en Tripadvisor. Ana te dice dónde.",
            "caption_length": "larga 60-100 palabras",
        },
        {
            "name": "La mañana en Belvedere",
            "frequency": "1 vez cada dos semanas",
            "description": (
                "Narrar el ritual del desayuno: la mermelada casera, la vista desde la mesa, "
                "el silencio antes de que empiece el día. Atmosférico, sin precio ni oferta."
            ),
            "headline_style": "frase atmosférica, sentence case, hora opcional",
            "example_headline": "A las 8:30 en Belvedere: café, mermelada de higo y el Tajo para ti solo.",
            "caption_length": "media 30-60 palabras",
        },
        {
            "name": "Antes / Después",
            "frequency": "máximo 1 vez al mes",
            "description": (
                "Contraste emocional: el ritmo de la ciudad del huésped vs. la calma que encuentra. "
                "Alto impacto, para momentos de alta intención de reserva (enero, junio, agosto)."
            ),
            "headline_style": "contraste con dos líneas o dos voces",
            "example_headline": "El lunes: atasco en la M-30. El jueves: esto.",
            "caption_length": "corta 20-40 palabras",
        },
        {
            "name": "Temporada viva",
            "frequency": "1 vez al mes",
            "description": (
                "La Serranía en cada estación: los almendros de febrero, el calor seco de julio, "
                "la niebla de noviembre, la luz dorada de octubre en la vendimia."
            ),
            "headline_style": "frase estacional, sentence case",
            "example_headline": "Octubre en Ronda huele a mosto y a piedra mojada.",
            "caption_length": "media 30-60 palabras",
        },
    ],
    "key_messages": {
        "main": "Belvedere no es solo donde duermes en Ronda. Es donde Ronda finalmente te llega.",
        "per_persona": {
            "La Pareja en Pausa": (
                "Dos días sin agenda. Con vistas. Con desayuno hasta las once. En Belvedere."
            ),
            "El Viajero Independiente": (
                "Ronda tiene capas que solo se ven despacio. Nosotros te damos el tiempo."
            ),
        },
        "hashtags": ["#HotelBelvedere", "#RondaEsencial"],
    },
}


# ── Combinazioni da testare ──────────────────────────────────────────────────
TEST_CASES = [
    # (angle_name, persona_name, archetype, descrizione del test)
    ("Detalle silencioso",     "La Pareja en Pausa",       "frase_susurro",   "Detalle micro · pareja · headline+whisper"),
    ("La mañana en Belvedere", "La Pareja en Pausa",       "frase_narrativa", "Ritual desayuno · narrativa larga"),
    ("Temporada viva",         "El Viajero Independiente", "una_palabra",     "Estación · una palabra evocadora"),
    ("Ronda que no sale en guías", "El Viajero Independiente", "mixed_type",  "Reco local · headline con acento italic"),
]


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("⚠ ANTHROPIC_API_KEY non in env — esco.")
        return 1

    print("═" * 78)
    print("BELVEDERE — TEST COPY AGENT (Fase 1B + brief ricco)")
    print("═" * 78)

    agent = CopyAgent()

    for i, (angle, persona, archetype, label) in enumerate(TEST_CASES, 1):
        print(f"\n\n──── TEST {i} · {label} ────")
        print(f"Angolo:    {angle}")
        print(f"Persona:   {persona}")
        print(f"Archetipo: {archetype}")
        print()

        slot = {
            "pillar": "Experiencia íntima" if "Detalle" in angle or "mañana" in angle.lower() else (
                "Territorio" if "Ronda" in angle else "Temporada y agenda"
            ),
            "angle": angle,
            "persona": persona,
            "scheduled_date": "2026-05-15",
            "format": "Post 1:1",
            "platform": "instagram",
        }
        # Adatto il pillar manualmente per ogni test
        if "Detalle" in angle or "mañana" in angle.lower():
            slot["pillar"] = "Experiencia íntima"
        elif "Ronda" in angle or "Temporada" in angle:
            slot["pillar"] = "Territorio" if "Ronda" in angle else "Temporada y agenda"

        brief = compose(slot, BELVEDERE_BRAND_KIT)

        result = agent.run(brief, archetype=archetype)

        print(f"  HEADLINE:     «{result.get('headline', '')}»")
        if result.get("headline_alt"):
            print(f"  HEADLINE ALT: «{result['headline_alt']}»")
        if result.get("whisper"):
            print(f"  WHISPER:      «{result['whisper']}»")
        print(f"  ELLIPSIS:     {result.get('ellipsis_used')}")
        print()
        print(f"  CAPTION:")
        for line in (result.get("caption", "") or "").splitlines():
            print(f"    {line}")
        print()
        print(f"  HASHTAGS:     {' '.join(result.get('hashtags', []))}")
        print()
        print(f"  RAZONAMIENTO:")
        rsn = result.get("_reasoning", {})
        for k in ("destinatario", "intencion", "gesto", "palabra_clave", "decision"):
            if rsn.get(k):
                print(f"    {k:14s}: {rsn[k]}")
        cl = result.get("_copy_log", {})
        if cl.get("retry_needed"):
            print(f"  ⚠ retry: {cl.get('retry_reason')}")

    print("\n" + "═" * 78)
    print("FIN")
    return 0


if __name__ == "__main__":
    sys.exit(main())
