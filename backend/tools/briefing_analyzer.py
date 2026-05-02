"""
briefing_analyzer.py — Analisi completa del briefing cliente con Claude Opus.

Opus legge il briefing integrale e produce UN UNICO output strutturato che
popola tutte le tabelle client_brand, client_profile e client_projects
in un solo passaggio.

Viene chiamato in background ogni volta che viene salvato un briefing.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from typing import Optional

import anthropic

from tools.supabase_client import get_client


_ANALYZER_SYSTEM = """Eres el analista estratégico de Studio Bravo, una agencia de marketing.

Tu tarea: leer un briefing completo de cliente y extraer TODA la información estratégica en un JSON estructurado.
Este JSON será la fuente de verdad para todos los agentes AI que trabajarán con este cliente.

Sé profundo, creativo y estratégico. Usa siempre el idioma del briefing.

Responde SOLO con el JSON válido, sin texto antes ni después, sin markdown fences.

ESTRUCTURA DEL JSON:

{
  "brand": {
    "briefing_distilled": "Ficha compacta de 1.500-1.800 caracteres con: sector, ubicación, descripción, posicionamiento, eslogan, activos únicos, personas objetivo (max 3), objetivos del año, competidor principal, voz de marca, reglas de contenido. Esta ficha la usan los agentes AI semanalmente.",
    "tone_of_voice": "2-3 párrafos describiendo la voz de marca: qué transmite, cómo suena, ejemplos de tono correcto e incorrecto. Máx 400 caracteres.",
    "pillars": [
      {
        "name": "Nombre del pilar",
        "description": "Qué temas cubre y por qué importa",
        "percentage": 30,
        "examples": ["Ejemplo de post 1", "Ejemplo de post 2"]
      }
    ],
    "content_types": [
      {
        "name": "Nombre del tipo de contenido",
        "when_to_use": "Cuándo y por qué usar este formato",
        "tone": "Tono específico para este tipo",
        "example_headline": "EJEMPLO DE TITULAR EN MAYÚSCULAS"
      }
    ]
  },
  "profile": {
    "team_bravo": [
      {"name": "Nombre", "role": "Rol en el proyecto", "detail": "Responsabilidades concretas"}
    ],
    "key_contacts": [
      {"name": "Nombre", "role": "Cargo en la empresa cliente", "description": "Quién es y qué decide"}
    ],
    "history": "Narrativa del histórico del cliente y del trabajo realizado. Máx 400 palabras.",
    "objectives": [
      "Objetivo concreto y medible 1",
      "Objetivo concreto y medible 2"
    ],
    "strategy": "Texto de la estrategia editorial y de comunicación. Máx 400 palabras.",
    "editorial_pillars": [
      {"name": "Nombre", "description": "Descripción", "percentage": 30}
    ],
    "scope": [
      "Qué hace Studio Bravo para este cliente — punto 1"
    ],
    "out_of_scope": [
      "Qué NO hace Studio Bravo — punto 1"
    ],
    "partners": [
      {"name": "Nombre partner", "category": "Categoría", "description": "Relación con el cliente"}
    ]
  },
  "projects": [
    {
      "title": "Título corto (máx 6 palabras)",
      "category": "CONTENIDO|PUBLICIDAD|ALIANZAS|SEO_LOCAL|CONVERSION|CAMPANA",
      "priority": "alta|media|baja",
      "description": "Descripción concreta en 2-3 líneas. Qué hacer y por qué.",
      "deliverable": "Qué se entrega concretamente (1 línea)",
      "month_target": "Inmediato|Mes 5|Mes 6|Mes 7|Mes 8|Mes 9|Mes 10|Mes 11|Mes 12",
      "why": "Referencia directa al briefing que justifica este proyecto (1 línea)",
      "responsible_agent": "market_researcher|strategist|content_designer|designer|metrics_analyst|audio_transcriber — el agente principal que ejecuta este proyecto",
      "co_agents": ["agente_secundario_si_aplica"],
      "mini_brief": "3-4 líneas concretas para el agente: qué debe producir, qué datos del briefing son clave, qué tono/formato usar, qué resultado se espera. Este campo lo usará Claude para generar el plan de trabajo detallado."
    }
  ],
  "design_system": {
    "visual_direction": "warm-soft",
    "visual_direction_label": "Etiqueta legible para mostrar al usuario",
    "visual_direction_rationale": "Por qué esta dirección encaja con el brand (1-2 frases)",
    "colors": {
      "background": "#XXXXXX",
      "surface":    "#XXXXXX",
      "foreground": "#XXXXXX",
      "accent":     "#XXXXXX",
      "muted":      "#XXXXXX",
      "border":     "#XXXXXX"
    },
    "typography": {
      "display": { "family": "Nombre fuente", "size_range": "48-64px", "weight": 700, "tracking": "-0.02em", "use": "Titulares principales" },
      "heading": { "family": "Nombre fuente", "size_range": "24-32px", "weight": 600, "use": "Subtítulos y headers de sección" },
      "body":    { "family": "Nombre fuente", "size_range": "14-16px", "weight": 400, "line_height": 1.6, "use": "Cuerpo de texto y captions" },
      "mono":    { "family": "ui-monospace", "use": "SOLO para: números, fechas, datos técnicos, índices. NUNCA en titulares." }
    },
    "rules": {
      "do":   ["Regla positiva 1 concreta", "Regla positiva 2"],
      "dont": ["Regla negativa 1 concreta", "Regla negativa 2"]
    },
    "posture": ["Orientación de layout 1", "Orientación de layout 2"],
    "pillar_identity": [
      {
        "name": "Nombre del pilar (debe coincidir con brand.pillars[].name)",
        "percentage": 30,
        "accent_variant": "#XXXXXX — color de acento específico de este pilar",
        "photo_filter": {
          "temperature": "warm +N | cool +N | neutro",
          "saturation": "+N | -N | neutro",
          "contrast": "alto | medio | bajo",
          "vignette": false,
          "special": "instrucción extra si aplica"
        },
        "shot_style": ["tipo de plano 1", "tipo de plano 2"],
        "mood_keywords": ["keyword1", "keyword2", "keyword3"],
        "caption_style": "ritmo y longitud de caption para este pilar",
        "layout_preference": ["bottom-full", "center", "asymmetric-left"]
      }
    ],
    "angle_identity": [
      {
        "name": "Nombre del ángulo narrativo",
        "archetype": "contemplativo | testimonial | insider | ritual | contraste | estacional | tecnico | provocador",
        "frequency": "frecuencia de publicación",
        "photo_filter": {
          "temperature": "warm|cool|neutro +valor",
          "saturation": "+N|-N",
          "contrast": "alto|medio|bajo",
          "vignette": false,
          "dof": "shallow|deep|normal",
          "special": "instrucción extra"
        },
        "shot_style": ["tipo 1", "tipo 2"],
        "energy": "3 palabras que definen la energía del ángulo",
        "headline_style": "cómo suena el titular: dato, pregunta, susurro, declaración...",
        "caption_length": "corta X-Y palabras | media X-Y | larga X-Y",
        "layout_preference": ["variant-1", "variant-2"],
        "example_headline": "EJEMPLO REAL DE HEADLINE EN MAYÚSCULAS"
      }
    ],
    "format_rules": {
      "carousel": {
        "max_slides": 10,
        "title_max_chars": 40,
        "body_max_chars": 120,
        "layout_notes": "Reglas de layout específicas para carrusel"
      },
      "single_post": {
        "aspect_ratio": "1:1 | 4:5",
        "text_overlay_zone": "Dónde va el texto sobre la imagen",
        "layout_notes": "Reglas de layout para post individual"
      },
      "story": {
        "aspect_ratio": "9:16",
        "safe_zones": "Margen superior e inferior para UI de Instagram",
        "layout_notes": "Reglas de layout para story"
      },
      "reel_cover": {
        "aspect_ratio": "9:16",
        "layout_notes": "Reglas de layout para portada de reel"
      }
    },
    "seasonal_palette": {
      "Q1": { "accent_shift": "Variación de acento para invierno/primavera", "mood": "Mood estacional" },
      "Q2": { "accent_shift": "Variación de acento para primavera/verano", "mood": "Mood estacional" },
      "Q3": { "accent_shift": "Variación de acento para verano/otoño", "mood": "Mood estacional" },
      "Q4": { "accent_shift": "Variación de acento para otoño/invierno", "mood": "Mood estacional" }
    }
  }
}

INSTRUCCIONES PARA design_system:

== CAPA 1: BASE (colors, typography, rules, posture) ==
Elige UNA de estas 5 direcciones visuales según el carácter del brand, y adapta la paleta a los colores reales del cliente:

1. editorial-monocle → Marcas premium, cultura, hospitalidad de lujo. Serif + mucho whitespace + off-white + un acento cálido. Ref: Monocle, FT Weekend, NYT Magazine.
2. modern-minimal → Tech, B2B, SaaS, servicios digitales. System fonts + near-greyscale + un acento saturado. Ref: Linear, Vercel, Notion.
3. warm-soft → Hospitalidad, wellness, gastronomía, comercio local. Crema + serif suave + acento terracota/vinotinto. Ref: Stripe pre-2020, Headspace, Mercury.
4. tech-utility → Agricultura técnica, industria, datos, ingeniería. Dark mode o fondo neutro + mono + acento funcional verde/azul. Ref: GitHub, Raycast, terminales.
5. brutalist-experimental → Moda, cultura urbana, marcas jóvenes. Alto contraste + tipografía audaz + color de impacto. Ref: WIRED, i-D.

Regla: los hex de "colors" deben derivar de los colores reales del cliente (briefing, logo, materiales). La dirección define la ESTRUCTURA de roles, no los colores exactos.

== CAPA 2: PILLAR IDENTITY ==
Para CADA pilar del brand, crea una identidad visual diferenciada:
- accent_variant: un hex derivado de la paleta base pero con matiz propio del pilar. CADA pilar DEBE tener un accent_variant DIFERENTE.
- photo_filter: objeto con temperature, saturation, contrast, vignette, special — para que el agente de imagen sepa cómo tratar las fotos
- shot_style: array de 2-3 tipos de plano predominantes
- mood_keywords: 3 palabras que describen el mood visual del pilar
- caption_style: cómo se escribe para este pilar (ritmo, longitud)
- layout_preference: variantes de layout preferidas

Esto permite que los posts de cada pilar tengan coherencia de marca pero se distingan visualmente entre sí.

== CAPA 3: ANGLE IDENTITY ==
Para cada ángulo narrativo detectado en el briefing (normalmente 4-6), define:
- archetype: contemplativo, testimonial, insider, ritual, contraste, estacional, tecnico, provocador
- frequency: cuántas veces al mes se publica este ángulo
- photo_filter: objeto detallado con temperature, saturation, contrast, vignette, dof, special
- shot_style: array de tipos de plano
- energy: 3 palabras que definen la energía del ángulo
- headline_style: cómo suenan los titulares (interrogativos, imperativos, numéricos, susurro, etc.)
- caption_length: longitud típica en palabras
- layout_preference: variantes de layout preferidas
- example_headline: un ejemplo CONCRETO de titular para este ángulo, en MAYÚSCULAS

== FORMAT RULES ==
Define las reglas técnicas para cada formato de contenido. Si no hay información en el briefing, usa valores estándar de la industria.

== SEASONAL PALETTE ==
Sugiere variaciones sutiles de acento y mood para cada trimestre, basándote en el sector del cliente. Si es un sector sin estacionalidad marcada, sugiere variaciones temáticas.

REGLAS PARA ASIGNACIÓN DE AGENTES EN PROYECTOS:
Studio Bravo tiene exactamente 6 agentes AI especializados. Asigna el campo "responsible_agent" a cada proyecto según esta lógica:
- market_researcher → investigación de mercado, análisis de competencia, extracción de reseñas, keywords, tendencias, auditorías
- strategist → estrategia editorial, calendario de contenidos, planificación trimestral, definición de pilares y ángulos
- content_designer → redacción de captions, copy, newsletters, textos de bio, guiones narrativos, hashtags
- designer → plantillas visuales, diseño de posts, filtros fotográficos, identidad visual, formatos gráficos
- metrics_analyst → KPIs, reportes de resultados, análisis de métricas, comparativas, dashboards
- audio_transcriber → transcripción de audio/vídeo, procesamiento de material de campo, entrevistas grabadas

Si un proyecto necesita colaboración entre dos agentes, pon el principal en "responsible_agent" y el secundario en "co_agents".
El campo "mini_brief" es CRÍTICO: debe ser autocontenido para que el agente pueda empezar a trabajar sin leer el briefing completo.

REGLAS GENERALES:
- Genera entre 12 y 18 proyectos, ordenados por impacto
- Usa nombres reales del briefing (marcas, personas, plataformas)
- Los pilares deben sumar 100% en porcentaje
- El briefing_distilled debe ser autocontenido: un agente que solo lee ese campo puede trabajar con el cliente
- Si falta información para un campo, omite el campo (no pongas null ni string vacío)
- pillar_identity DEBE tener una entrada por cada pilar listado en brand.pillars
- angle_identity debe tener entre 4 y 6 ángulos narrativos"""


def analyze(briefing_text: str, client_name: str = "") -> dict:
    """
    Chiama Claude Opus per analizzare il briefing completo.
    Restituisce il JSON strutturato con brand, profile e projects.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY non configurata")

    claude = anthropic.Anthropic(api_key=api_key)

    user_msg = (
        f"BRIEFING COMPLETO DEL CLIENTE{' (' + client_name + ')' if client_name else ''}:\n\n"
        f"{briefing_text}"
    )

    response = claude.messages.create(
        model="claude-opus-4-7",
        max_tokens=12000,
        system=_ANALYZER_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()

    # Rimuovi eventuali markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    # Estrai solo il blocco JSON (da { a }) nel caso Opus aggiunga testo prima/dopo
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start != -1 and end > start:
        raw = raw[start:end]

    # Prima prova il parsing diretto
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Fallback: json_repair — gestisce trailing comma, newline non escaped, virgolette miste, ecc.
    try:
        from json_repair import repair_json
        repaired = repair_json(raw, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return repaired
    except Exception:
        pass

    # Ultimo tentativo: pulizia manuale trailing comma + ri-parse
    cleaned = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Opus ha restituito JSON non valido: {e}. Primi 300 chars: {raw[:300]}")


def save_to_supabase(client_id: str, data: dict) -> bool:
    """
    Salva i risultati dell'analisi di Opus in client_brand, client_profile e client_projects.
    Lancia eccezione in caso di errore invece di restituire False silenziosamente.
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non configurato nel backend (SUPABASE_URL / SUPABASE_SECRET_KEY mancanti)")

    brand  = data.get("brand", {})
    profile = data.get("profile", {})
    projects = data.get("projects", [])

    try:
        # ── 1. client_brand ──────────────────────────────────────────────────
        res = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_id).limit(1).execute()
        existing_opus = {}
        if res.data:
            existing_opus = res.data[0].get("brand_kit_opus") or {}

        # Sovrascrive brand_kit_opus con i dati freschi di Opus (non merge parziale)
        new_opus = {}
        if brand.get("briefing_distilled"):
            new_opus["briefing_distilled"] = brand["briefing_distilled"]
        if brand.get("pillars"):
            new_opus["pillars"] = brand["pillars"]
        if data.get("design_system"):
            ds = data["design_system"]
            new_opus["design_system"] = ds
            # Salva i sub-campi anche a livello top di opus per accesso rapido
            if ds.get("pillar_identity"):
                new_opus["pillar_identity"] = ds["pillar_identity"]
            if ds.get("angle_identity"):
                new_opus["angle_identity"] = ds["angle_identity"]
            if ds.get("format_rules"):
                new_opus["format_rules"] = ds["format_rules"]
            if ds.get("seasonal_palette"):
                new_opus["seasonal_palette"] = ds["seasonal_palette"]

        update_brand: dict = {"brand_kit_opus": new_opus, "updated_at": "now()"}
        if brand.get("tone_of_voice"):
            update_brand["tone_of_voice"] = brand["tone_of_voice"]
        if brand.get("pillars"):
            update_brand["pillars"] = brand["pillars"]
        if brand.get("content_types"):
            update_brand["content_types"] = brand["content_types"]

        if res.data:
            sb.table("client_brand").update(update_brand).eq("client_id", client_id).execute()
        else:
            update_brand["client_id"] = client_id
            sb.table("client_brand").insert(update_brand).execute()

        print(f"✅ briefing_analyzer: client_brand aggiornato per {client_id}")

        # ── 2. client_profile ────────────────────────────────────────────────
        if profile:
            profile_row = {"client_id": client_id, "updated_at": "now()", **{
                k: v for k, v in profile.items() if v
            }}
            sb.table("client_profile").upsert(profile_row, on_conflict="client_id").execute()
            print(f"✅ briefing_analyzer: client_profile aggiornato per {client_id}")

        # ── 3. client_projects ───────────────────────────────────────────────
        if projects:
            # Cancella solo i progetti proposti precedenti (preserva approvati/rifiutati)
            sb.table("client_projects").delete().eq("client_id", client_id).eq("status", "propuesto").execute()

            rows = []
            for p in projects:
                if not p.get("title"):
                    continue
                row: dict = {
                    "id": str(uuid.uuid4()),
                    "client_id": client_id,
                    "title": p.get("title", ""),
                    "category": p.get("category", "CONTENIDO"),
                    "priority": p.get("priority", "media"),
                    "description": p.get("description", ""),
                    "deliverable": p.get("deliverable", ""),
                    "month_target": p.get("month_target", ""),
                    "why": p.get("why", ""),
                    "status": "propuesto",
                    "source": "opus_briefing_analysis",
                }
                if p.get("responsible_agent"):
                    row["responsible_agent"] = p["responsible_agent"]
                if p.get("co_agents"):
                    row["co_agents"] = p["co_agents"]
                if p.get("mini_brief"):
                    row["mini_brief"] = p["mini_brief"]
                rows.append(row)
            if rows:
                sb.table("client_projects").insert(rows).execute()
            print(f"✅ briefing_analyzer: {len(rows)} proyectos salvati per {client_id}")

        return True

    except Exception as e:
        # Propaga l'errore reale invece di nasconderlo
        raise RuntimeError(f"Errore salvataggio Supabase per {client_id}: {e}") from e


def run_for_client(client_id: str, briefing_text: str, client_name: str = "") -> bool:
    """
    Entry point principale: analizza e salva per un singolo cliente.
    Lancia eccezioni invece di restituire False — l'endpoint le cattura e le mostra.
    """
    if not briefing_text or len(briefing_text.strip()) < 100:
        raise ValueError(f"Briefing troppo corto ({len(briefing_text.strip())} chars) per {client_id}")

    print(f"🧠 briefing_analyzer: Opus analizza il briefing di {client_name or client_id}...")

    data = analyze(briefing_text, client_name)
    save_to_supabase(client_id, data)
    print(f"🎉 briefing_analyzer: analisi completata per {client_name or client_id}")
    return True
