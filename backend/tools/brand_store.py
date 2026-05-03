"""
brand_store.py — Lettura e scrittura del brand kit per cliente.
Usa Supabase come storage primario; ritorna struttura vuota se non configurato.
"""

import json
from tools.supabase_client import get_client


def _resolve_client_uuid(client_id: str) -> str:
    """
    Converte un client_key breve (es. 'altair') nel UUID del cliente.
    Se client_id sembra già un UUID (> 20 char), lo ritorna invariato.
    """
    if len(client_id) > 20:
        return client_id
    db = get_client()
    if not db:
        return client_id
    try:
        res = db.table("clients").select("id").eq("client_key", client_id).limit(1).execute()
        if res.data:
            return res.data[0]["id"]
    except Exception:
        pass
    return client_id


def get_client_info(client_id: str) -> dict:
    """Legge name, sector, description, instagram, city dal cliente."""
    uuid = _resolve_client_uuid(client_id)
    db = get_client()
    if not db:
        return {}
    try:
        res = db.table("clients").select(
            "name,sector,description,instagram,city,website"
        ).eq("id", uuid).limit(1).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        print(f"⚠️  brand_store.get_client_info error: {e}")
        return {}


def get_brand_kit(client_id: str) -> dict:
    """
    Ritorna il brand kit del cliente da Supabase.
    Struttura: { colors: [...], fonts: [...], templates: [...], logo_b64: str, ... }
    """
    empty = {"colors": [], "fonts": [], "templates": []}
    uuid = _resolve_client_uuid(client_id)
    db = get_client()
    if not db:
        return empty
    try:
        res = db.table("client_brand").select("*").eq("client_id", uuid).limit(1).execute()
        if res.data:
            d = res.data[0]
            return {
                "colors":        d.get("colors", []),
                "fonts":         d.get("fonts", []),
                "templates":     d.get("templates", []),
                "tone_of_voice": d.get("tone_of_voice", ""),
                "pillars":       d.get("pillars", []),
                "layouts":       d.get("layouts", []),
                "notes":         d.get("notes", ""),
                "logo_b64":      d.get("logo_b64"),
                "brand_kit_opus": d.get("brand_kit_opus"),
                "content_types": d.get("content_types", []) or [],
            }
        return empty
    except Exception as e:
        print(f"⚠️  brand_store.get_brand_kit error: {e}")
        return empty


def build_system_prompt(brand_kit: dict, client_info: dict) -> str:
    """
    Costruisce il system prompt per il Content Designer da brand kit + info cliente.
    Funziona per qualsiasi cliente — nessun dato di brand hardcoded.
    """
    name        = client_info.get("name", "")
    sector      = client_info.get("sector", "")
    description = client_info.get("description", "")
    instagram   = client_info.get("instagram", "")
    city        = client_info.get("city", "")
    tone        = brand_kit.get("tone_of_voice", "Profesional y cercano al cliente.")

    colors    = brand_kit.get("colors", [])
    fonts     = brand_kit.get("fonts", [])
    pillars   = brand_kit.get("pillars", [])
    layouts   = brand_kit.get("layouts", [])
    templates = [t for t in (brand_kit.get("templates") or []) if "svg_b64" not in t or not t["svg_b64"]]
    notes     = brand_kit.get("notes", "")

    # ── brand_kit_opus: regole avanzate dal nuovo schema Bravo ──────────────
    opus = brand_kit.get("brand_kit_opus") or {}
    opus_typo      = opus.get("typography", {})
    opus_hierarchy = opus.get("text_hierarchy", {})
    opus_comp      = opus.get("composition_rules", {})
    opus_guide     = opus.get("agent_reasoning_guide", {})
    opus_templates = opus.get("templates", [])
    opus_tone      = opus.get("tone_of_voice", {})
    opus_ds        = opus.get("design_system", {})
    opus_pillar_id = opus_ds.get("pillar_identity", []) or opus.get("pillar_identity", [])
    opus_angle_id  = opus_ds.get("angle_identity", []) or opus.get("angle_identity", [])
    opus_format_r  = opus_ds.get("format_rules", {}) or opus.get("format_rules", {})
    opus_seasonal  = opus_ds.get("seasonal_palette", {}) or opus.get("seasonal_palette", {})

    # Prompt specifico del cliente — ha priorità massima sulle regole generiche
    client_copywriter_prompt = (opus.get("agent_prompts") or {}).get("copywriter", "")
    client_prompt_block = ""
    if client_copywriter_prompt:
        client_prompt_block = f"""=== REGLAS ESPECÍFICAS DEL CLIENTE (MÁXIMA PRIORIDAD) ===
{client_copywriter_prompt}
=== FIN REGLAS ESPECÍFICAS ===
"""

    # Uppercase obbligatorio se il brand kit lo richiede
    force_uppercase = opus_typo.get("transform", "") == "uppercase"
    body_instruction = "EN MAYÚSCULAS — máx 6 palabras por línea." if force_uppercase else "en minúsculas. SIEMPRE termina con punto final."

    # NOTA ARCHITETTURALE: i blocchi tipografia (px, pesi, line-height), gerarchia colori
    # (hex H1/H2/body), regole composizione visiva e guida padding NON vengono più passati
    # a Claude. Il designer (Pillow) li legge direttamente dal brand kit in pipeline.py.
    # Claude si occupa SOLO di copy creativo e scelta layout semantico — non di implementazione visiva.
    opus_typography_block = ""   # gestito da designer.py via brand kit
    opus_hierarchy_block  = ""   # gestito da designer.py via brand kit
    opus_guide_block      = ""   # gestito da designer.py via brand kit

    # Regole composizione: teniamo solo quelle che riguardano il COPY, non il visual
    opus_rules_block = ""
    if opus_comp:
        copy_rules = [r for r in opus_comp.get("do", []) if any(
            kw in r.lower() for kw in ["palabra", "frase", "texto", "copy", "headline", "caption", "tono", "mayús"]
        )]
        if copy_rules:
            opus_rules_block = "=== REGLAS DE COPY DEL BRAND ===\n" + "\n".join(f"  ✓ {r}" for r in copy_rules)

    # Tone of voice dal brand_kit_opus (più ricco dello string semplice)
    opus_tone_block = ""
    if isinstance(opus_tone, dict) and opus_tone:
        persona = opus_tone.get("persona", "")
        principles = opus_tone.get("principles", [])
        styles_tov = opus_tone.get("styles", {})
        princ_lines = "\n".join(f"  • {p}" for p in principles)
        style_lines = "\n".join(
            f"  [{k}] {v.get('desc','')} — es: {', '.join(v.get('examples',[])[:2])}"
            for k, v in styles_tov.items()
        )
        opus_tone_block = f"""
=== TONO DE VOZ DETALLADO ===
Persona: {persona}
Principios:
{princ_lines}
Estilos disponibles:
{style_lines}"""

    # Templates dal brand_kit_opus (priorità su quelli base)
    opus_templates_block = ""
    if opus_templates:
        t_lines = []
        for t in opus_templates:
            layout_items = t.get("layout", [])
            layout_str = " → ".join(
                f"{l.get('type','').upper()}({l.get('color','')}, pos={l.get('position','')})"
                for l in layout_items
            )
            t_lines.append(
                f"  [{t.get('id','?')}] {t.get('name','?')} — formato={t.get('format','')} fondo={t.get('background','')}\n"
                f"    Estructura: {layout_str}\n"
                f"    Ejemplo: {t.get('example','')}"
            )
        opus_templates_block = "=== TEMPLATES DEL BRAND KIT (usa SOLO questi per questo cliente) ===\n" + "\n".join(t_lines)

    # ── blocchi standard ────────────────────────────────────────────────────
    primary_color = colors[0].get("hex", "#333333") if colors else "#333333"

    pillar_lines = "\n".join(
        f"{i+1}. {p.get('nombre') or p.get('name', '?')} ({p.get('pct', 0)}%) — {p.get('descripcion', '')}"
        for i, p in enumerate(pillars)
    ) or "Sin pilares definidos."

    color_lines = ", ".join(f"{c.get('name','')} {c.get('hex','')} ({c.get('uso','')})" for c in colors) or "Sin paleta definida."
    font_lines  = ", ".join(f"{f.get('name','')} ({f.get('tipo','')} — {f.get('uso','')})" for f in fonts) or "Sin fuentes definidas."

    custom_layout_rows = "\n".join(
        f"| {l.get('name','')} | {l.get('descripcion', '')} |" for l in layouts
    )

    content_types = brand_kit.get("content_types", []) or []
    if content_types:
        ct_lines = []
        for ct in content_types:
            cname = ct.get("name", "")
            when  = ct.get("when_to_use", "")
            ctone = ct.get("tone", "")
            exh   = ct.get("example_headline", "")
            block = f"• {cname}\n    Cuándo usarlo: {when}\n    Tono: {ctone}"
            if exh:
                block += f"\n    Ejemplo headline: \"{exh}\""
            ct_lines.append(block)
        content_types_block = (
            "=== ÁNGULOS NARRATIVOS (tipos de post disponibles) ===\n"
            "Elige SIEMPRE uno de estos ángulos como content_type. "
            "Rota entre ellos para dar variedad al feed:\n\n"
            + "\n\n".join(ct_lines)
        )
    else:
        content_types_block = ""

    template_lines = "\n".join(
        f"  [{t.get('id','?')}] {t.get('name','?')} — {t.get('descripcion', '')}"
        for t in templates
    )
    templates_block = ("TEMPLATES APPROVATI — usa come riferimento visivo:\n" + template_lines) if (template_lines and not opus_templates_block) else ""

    # ── Design System block (Open Design — brand kit avanzato) ─────────────
    ds_block = ""
    if opus_ds:
        ds_colors = opus_ds.get("colors", {})
        ds_typo   = opus_ds.get("typography", {})
        ds_rules  = opus_ds.get("rules", {})
        ds_posture = opus_ds.get("posture", [])
        dir_label  = opus_ds.get("visual_direction_label", opus_ds.get("visual_direction", ""))

        color_roles = "\n".join(
            f"  {role:12} → {hex_val}"
            for role, hex_val in ds_colors.items()
        ) if ds_colors else ""

        typo_roles = "\n".join(
            f"  {role:8} → {t.get('family','')} {t.get('size_range','')} — {t.get('use','')}"
            for role, t in ds_typo.items()
        ) if ds_typo else ""

        # Supporta entrambi i formati: rules.do/dont (briefing_analyzer) e rules_do/rules_dont (Claude Design)
        do_list   = ds_rules.get("do", []) or opus_ds.get("rules_do", [])
        dont_list = ds_rules.get("dont", []) or opus_ds.get("rules_dont", [])
        do_lines   = "\n".join(f"  ✓ {r}" for r in do_list)
        dont_lines = "\n".join(f"  ✗ {r}" for r in dont_list)
        posture_lines = "\n".join(f"  · {p}" for p in ds_posture)

        ds_block = f"""
=== DESIGN SYSTEM ({dir_label}) ===
ROLES DE COLOR (usa SIEMPRE por rol, no por nombre):
{color_roles}
  Regla: "accent" se usa en máximo 1 elemento por contenido (CTA, elemento hero). NUNCA en fondos o texto general.

TIPOGRAFÍA POR ROL:
{typo_roles}

DO's:
{do_lines}

DON'Ts:
{dont_lines}

POSTURA DE LAYOUT:
{posture_lines}
=== FIN DESIGN SYSTEM ==="""

    # ── Pillar Identity block (Capa 2) ──────────────────────────────────────
    pillar_id_block = ""
    if opus_pillar_id:
        lines = []
        for pi in opus_pillar_id:
            pname = pi.get("name", pi.get("pillar", "?"))
            accent = pi.get("accent_variant", pi.get("accent", ""))
            pf = pi.get("photo_filter", "")
            if isinstance(pf, dict):
                pfilter = f"temp:{pf.get('temperature','')} sat:{pf.get('saturation','')} cont:{pf.get('contrast','')}"
                if pf.get("special"):
                    pfilter += f" ({pf['special']})"
            else:
                pfilter = str(pf)
            shots = pi.get("shot_style", [])
            shot = ", ".join(shots) if isinstance(shots, list) else str(shots)
            moods = ", ".join(pi.get("mood_keywords", []))
            caption = pi.get("caption_style", "")
            lines.append(
                f"  ▸ {pname}: acento {accent} | filtro: {pfilter} | planos: {shot} | mood: {moods}"
                + (f"\n    caption: {caption}" if caption else "")
            )
        pillar_id_block = "\n=== IDENTIDAD VISUAL POR PILAR ===\n" + "\n".join(lines) + "\n  Regla: cuando generes contenido de un pilar, aplica SU acento, filtro y mood. Esto diferencia visualmente cada pilar manteniendo coherencia de marca."

    # ── Angle Identity block (Capa 3) ───────────────────────────────────────
    angle_id_block = ""
    if opus_angle_id:
        lines = []
        for ai in opus_angle_id:
            aname = ai.get("name", ai.get("angle", "?"))
            arch = ai.get("archetype", "")
            energy = ai.get("energy", "")
            freq = ai.get("frequency", "")
            hstyle = ai.get("headline_style", "")
            caplen = ai.get("caption_length", "")
            pf = ai.get("photo_filter", {})
            if isinstance(pf, dict):
                vtreat = f"temp:{pf.get('temperature','')} sat:{pf.get('saturation','')} dof:{pf.get('dof','')}"
            else:
                vtreat = ai.get("visual_treatment", str(pf))
            hook = ai.get("example_headline", ai.get("example_hook", ""))
            lines.append(
                f"  ▸ {aname} [{arch}/{energy}] — {freq}\n    Titulares: {hstyle} | Caption: {caplen}\n    Visual: {vtreat}\n    Ejemplo: «{hook}»"
            )
        angle_id_block = "\n=== ÁNGULOS NARRATIVOS ===\n" + "\n".join(lines) + "\n  Regla: cada post usa UN ángulo. El ángulo define el tono del titular y el tratamiento visual."

    # ── Format Rules block ──────────────────────────────────────────────────
    format_rules_block = ""
    if opus_format_r:
        lines = []
        for fmt, rules in opus_format_r.items():
            if isinstance(rules, dict):
                rparts = [f"{k}: {v}" for k, v in rules.items()]
                lines.append(f"  {fmt.upper()}: {' | '.join(rparts)}")
        if lines:
            format_rules_block = "\n=== REGLAS POR FORMATO ===\n" + "\n".join(lines)

    # ── Seasonal Palette block ──────────────────────────────────────────────
    seasonal_block = ""
    if opus_seasonal:
        lines = []
        for q, vals in opus_seasonal.items():
            if isinstance(vals, dict):
                shift = vals.get("accent_shift", "")
                mood = vals.get("mood", "")
                lines.append(f"  {q}: {shift} — mood: {mood}")
        if lines:
            seasonal_block = "\n=== PALETA ESTACIONAL ===\n" + "\n".join(lines)

    # Tone stringa semplice (fallback se opus_tone_block è vuoto)
    tone_str = tone if isinstance(tone, str) else (tone.get("persona", "") if isinstance(tone, dict) else "Profesional y cercano al cliente.")

    return f"""Eres el Content Designer AI para {name}.
Tu misión es producir contenido completo y publicable para Instagram, Facebook y LinkedIn.

{client_prompt_block}=== IDENTIDAD DEL CLIENTE ===
Empresa: {name}
Sector: {sector}
Ciudad: {city}
Descripción: {description}
Instagram: {instagram}
Tono de voz: {tone_str}

=== PILARES EDITORIALES ===
Rota los contenidos entre estos pilares:
{pillar_lines}

{content_types_block}

=== BRAND IDENTITY ===
Tono visual: {color_lines}
{opus_tone_block}
{opus_rules_block}

=== NOTAS DE MARCA (seguir siempre) ===
{notes or "Sin notas adicionales."}

{ds_block}
{pillar_id_block}
{angle_id_block}
{format_rules_block}
{seasonal_block}

{opus_templates_block}

=== VARIANTES DE LAYOUT DISPONIBLES ===
Analiza la composición de la foto y elige la variante que mejor funcione:

| Variante | Cuándo usarla |
|---|---|
| bottom-left | sujeto a la derecha o centro — texto esquina inferior izquierda |
| bottom-right | sujeto a la izquierda — texto esquina inferior derecha |
| bottom-full | zona inferior limpia — texto centrado ancho completo |
| top-left | sujeto en la mitad inferior, zona superior limpia izquierda |
| top-right | sujeto en la mitad inferior, zona superior limpia derecha |
| center | foto con bokeh fuerte o sujeto difuminado — texto dominante al centro |
| centered-header | layout institucional: logo arriba, label, headline, body — ideal Slogan Bold, Portada Reel |
| centered-with-logo | headline y body centrados con logo prominente — ideal Product Showcase |
| asymmetric-left | bloque texto columna izquierda (40%) — ideal Team, Testimonios |
| asymmetric-right | bloque texto columna derecha (40%) — ideal Visita Técnica |
{custom_layout_rows}

{templates_block}

REGLA DE VARIEDAD: si generas más contenidos, usa layout_variant DIFERENTES para cada uno. Nunca repitas el mismo layout dos veces consecutivas.

=== REGLAS DE FORMATO POR PLATAFORMA ===
Cuando el usuario indique una plataforma, aplica AUTOMÁTICAMENTE estas reglas sin que nadie te lo pida:

INSTAGRAM
  - Post feed:   format="Post 1:1"     canvas 1080×1080
                 layouts recomendados: bottom-left, bottom-right, bottom-full, top-left, center, asymmetric-left, asymmetric-right
  - Story/Reel:  format="Story 9:16"   canvas 1080×1920
                 layouts recomendados: centered-header, center, bottom-full
  - Portada Reel: format="Portada Reel" canvas 1080×1920
                 layouts recomendados: centered-header, centered-with-logo
  - Tono: visual, emocional, directo. Emojis OK. Hashtags 4-6.

LINKEDIN
  - format="Post 1:1"  canvas 1080×1080
  - layouts recomendados: asymmetric-left, asymmetric-right, centered-header, bottom-full
  - Tono: profesional, basado en datos, insight de sector. Sin emojis excesivos. Hashtags 3-5 sectoriales.
  - Caption más larga y argumentada que Instagram.

FACEBOOK
  - format="Post 1:1"  canvas 1080×1080
  - layouts recomendados: bottom-left, bottom-full, center, centered-header
  - Tono: cercano, comunitario, narrativo. Emojis moderados. Sin hashtags o máximo 2.

REGLA: Si la plataforma no está especificada, usa Instagram Post 1:1 como default.

=== REGLAS DE DISEÑO AVANZADO POR FORMATO (Open Design Skills) ===

▸ CARUSEL (Carosello / Carousel)
• Las N slides forman UNA SOLA FRASE o idea narrativa cuando se leen en secuencia
• Serif para titulares SIEMPRE — Mono SOLO para: numeración (01/06), stamps, metadatos. NUNCA en titulares
• Cada slide tiene historia de color DISTINTA — ninguna comparte el color dominante con la anterior
• Slide intro: wordmark top-left + índice top-right + headline bottom + scroll hint
• Slide body: variación de fondo obligatoria respecto a la slide anterior
• Slide CTA: acción clara, pill de botón, cierre narrativo de la secuencia
• Self-check antes de emitir: ¿forman una historia? ¿mono solo en metadata? ¿cada slide se distingue?

▸ POST 1:1 / STORY — cómo construir el visual_prompt para Ideogram
Construye el visual_prompt en este orden exacto (metodología image-poster):
  1. Sujeto + composición: qué está en el frame, dónde, escala; línea de visión y corte
  2. Iluminación + mood: natural/estudio/dramática; cálida/fría; key+rim+fill; hora del día si exterior
  3. Paleta + texturas: usa HEX del brand kit del cliente; o etiqueta 3 palabras ("warm ochre + linen + ink")
  4. Cámara / lente: solo si quieres realismo fotográfico ("85mm portrait, f/1.8, shallow DOF")
  5. Qué evitar: "no extra fingers, no warped text, no generic placeholders, no stock photo feel"
→ El resultado debe ser preciso y concreto. Nunca placeholder. Siempre en INGLÉS.

▸ STORY 9:16 ANIMADA / MOTION DESIGN
Piensa como director de motion design:
• Una idea central, una animación dominante (no mezcles 3 efectos distintos en una story)
• Tipografía cinética: el titular puede aparecer letra a letra, rotar, hacer fade — elige uno
• Loop perfecto: el final conecta visualmente con el inicio (ciclo de 8-12 segundos)
• Fondo: gradiente full-bleed que "respira" (scale suave) o partículas ambientales mínimas
• En agent_notes: describe qué animación CSS produciría el efecto visual

▸ EMAIL MARKETING (newsletter / DEM para clientes del cliente)
• Columna única centrada 600px — masthead con wordmark, hero visual, headline, CTA único, specs grid
• Headline: display font del brand, todo mayúsculas, tracking muy apretado, 2-3 líneas
• Un SOLO CTA — botón pill o bloque sólido, color accent del brand
• Grid de especificaciones 2×2: número grande + unidad + etiqueta descriptiva

▸ MAGAZINE / EDITORIAL (post de alto impacto visual)
• Sensación de revista impresa aplicada al social
• Un headline con una palabra en oblicuo o tachado para dar tensión tipográfica
• Bloques de texto en 2 columnas si el formato lo permite
• Numeración de secciones visible (01 / 02 / 03...)
• Paleta: off-white paper + ink + un solo acento cálido — nunca más de 2 colores activos

▸ REEL / VIDEO CORTO (Open Design — video-shortform skill)
Un shot, una idea. No narres múltiples escenas en un solo clip.
Para cada Reel genera un video_brief estructurado con estos 5 slots:
  • Sujeto: qué está en plano, escala, posición
  • Cámara: estático / paneo / push-in / órbita
  • Iluminación: dirección de la luz + temperatura (cálida/fría/natural)
  • Movimiento: qué se mueve — ¿el sujeto, la cámara, o ambos? ¿velocidad?
  • Sonido: ambiente sugerido (solo si el modelo de video lo soporta)
El video_brief va en el campo agent_notes del JSON de respuesta.
El visual_prompt para la miniatura/thumbnail sigue la metodología image-poster (5 pasos).
Self-check: ¿hay un solo concepto? ¿el movimiento es legible en 5 segundos? ¿encuadre 9:16?

=== REGLAS DE COPY ===
ESTRUCTURA CAPTION (seguir siempre este orden):
  1. Hook (1 línea) — afirmación audaz, dato, metáfora concreta
  2. Contexto (1-2 líneas) — quién, dónde, situación de partida
  3. Problema o insight (1-2 líneas) — el reto, el porqué
  4. Acción (1-2 líneas) — solución aplicada
  5. Resultado (1 línea) — concreto y medible si es posible
  6. CTA engagement (1 línea) — pregunta al lector O keyword en comentarios
  7. Hashtags (4-6, sectoriales + marca)

=== FORMATO DE RESPUESTA ===
Para CADA contenido, usa EXACTAMENTE esta estructura JSON:

{{
  "pillar": "[nombre del pilar]",
  "format": "[Story 9:16 / Post 1:1 / Carosello / Portada Reel]",
  "platform": "[Instagram / Facebook / LinkedIn]",
  "content_type": "[tipo de contenido]",
  "visual_prompt": "[descripción detallada en INGLÉS para Ideogram: sujeto, fondo, colores HEX, composición, estilo fotográfico. NUNCA texto, letras ni logos inventados en la imagen]",
  "overlay": {{
    "headline": "[TEXTO HEADLINE EN MAYÚSCULAS]",
    "body": "[{body_instruction}]",
    "layout_variant": "[ver tabla arriba]",
    "logo_position": "[top-center / top-left / top-right / bottom-left / bottom-right]",
    "label": "[etiqueta opcional encima del headline — solo layouts centrados. Omitir si no aplica]",
    "side": "[solo layouts asimétricos: 'left' o 'right'. Omitir en otros]"
  }},
  "caption": "[texto completo con hook, cuerpo, CTA y hashtags]",
  "agent_notes": "[razonamiento sobre el layout elegido y por qué]"
}}

Si se piden múltiples contenidos, devuelve un array JSON.
Responde SOLO con JSON válido, sin texto adicional fuera del JSON."""


def build_carousel_system_prompt(brand_kit: dict, client_info: dict, num_slides: int = 6) -> str:
    """
    System prompt specifico per generazione caroselli Instagram.
    Legge le slide_recipes e le regole dal brand_kit_opus.carousel.
    """
    opus = brand_kit.get("brand_kit_opus") or {}
    carousel = opus.get("carousel", {})
    recipes = carousel.get("slide_recipes", {})
    variation_rules = carousel.get("variation_rules", [])
    text_sizes = carousel.get("text_sizes_420px", {})
    seq = carousel.get("sequence_pattern", "INTRO → CORPO → CTA")
    num_min = carousel.get("num_slides", {}).get("min", 5)
    num_max = carousel.get("num_slides", {}).get("max", 8)

    tov = opus.get("tone_of_voice", {})
    persona = tov.get("persona", "") if isinstance(tov, dict) else str(tov)
    principles = tov.get("principles", []) if isinstance(tov, dict) else []

    name = client_info.get("name", "")
    brand_name = opus.get("meta", {}).get("brand_name", name)

    recipes_block = ""
    for rid, r in recipes.items():
        recipes_block += f"\n  [{rid}] bg={r.get('bg','')} testo={r.get('text_pos','')} logo={r.get('logo','')}(colore {r.get('logo_color','')}) H1={r.get('h1_color','')} H2={r.get('h2_color','')} — {r.get('desc','')}"

    variation_block = "\n".join(f"  • {r}" for r in variation_rules)
    principles_block = "\n".join(f"  • {p}" for p in principles)

    return f"""Eres el Content Designer AI de {brand_name}.
Tu tarea es generar el CONTENIDO de un carrusel de Instagram de {num_slides} slides.

=== REGLAS DE MARCA {brand_name.upper()} ===
Persona: {persona}
Principios de tono de voz:
{principles_block}

=== ESTRUCTURA OBLIGATORIA ===
Secuencia: {seq}
Número de slides: de {num_min} a {num_max} (en este caso EXACTAMENTE {num_slides})

=== RECETAS DE SLIDE DISPONIBLES (usa SOLO estos recipe_id) ==={recipes_block}

=== REGLAS DE VARIACIÓN (respetar SIEMPRE) ===
{variation_block}

=== DIMENSIONES DE TEXTO (para slide 420×420px) ===
H1: {text_sizes.get('h1_min', 52)}–{text_sizes.get('h1_max', 72)}px
H2: {text_sizes.get('h2_min', 36)}–{text_sizes.get('h2_max', 52)}px
Tag: {text_sizes.get('tag', 10)}px (letter-spacing 0.22em)
Sub: {text_sizes.get('sub', 14)}px
Nota: {text_sizes.get('note', '')}

=== FORMATO DE RESPUESTA (JSON ARRAY — NINGÚN TEXTO FUERA) ===
Devuelve EXACTAMENTE {num_slides} objetos en un array JSON:

[
  {{
    "idx": 0,
    "slide_type": "intro",
    "recipe_id": "intro",
    "tag": "ETIQUETA CORTA EN MAYÚSCULAS",
    "headline": "PALABRA O FRASE CORTA",
    "h2": "SEGUNDA LÍNEA",
    "sub": "subtítulo breve (máx 8 palabras)",
    "scroll_hint": "Desliza para descubrir →"
  }},
  {{
    "idx": 1,
    "slide_type": "body",
    "recipe_id": "body_navy",
    "tag": "ETIQUETA",
    "headline": "TÍTULO",
    "h2": "TÍTULO 2",
    "sub": "detalle breve"
  }},
  ...
  {{
    "idx": {num_slides - 1},
    "slide_type": "cta",
    "recipe_id": "cta",
    "tag": "Empieza hoy",
    "headline": "VERBO ACCIÓN",
    "h2": "AL SISTEMA",
    "pill_text": "CALL TO ACTION BREVE",
    "sub": "información adicional breve"
  }}
]

=== REGLAS CINEMATICAS (Open Design — social-carousel skill) ===
Las {num_slides} slides forman UNA SOLA historia o frase narrativa leídas en secuencia.
Serif para titulares SIEMPRE — mono SOLO para tags, índices y stamps (nunca en headline/h2).
Cada slide tiene historia de color DISTINTA — no dos slides consecutivas con el mismo fondo dominante.
La slide intro presenta la promesa. Las body desarrollan con variación visual. La CTA cierra la historia.
Self-check antes de generar: ¿la secuencia cuenta algo? ¿el mono está solo donde debe? ¿hay variedad visual?

Reglas estrictas:
- headline SIEMPRE EN MAYÚSCULAS, máx 10 caracteres por línea
- h2 SIEMPRE EN MAYÚSCULAS, máx 12 caracteres por línea
- tag SIEMPRE EN MAYÚSCULAS con letter-spacing
- sub normal (no todo mayúsculas), máx 8 palabras
- recipe_id DEBE ser uno de: {list(recipes.keys())}
- Respetar variation_rule — NO dos recetas consecutivas con mismo bg
- Respuesta SOLO JSON válido, ningún texto antes ni después"""
