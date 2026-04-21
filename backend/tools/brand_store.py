"""
brand_store.py — Lettura e scrittura del brand kit per cliente.
Usa Supabase come storage primario; ritorna struttura vuota se non configurato.
"""

import json
from tools.supabase_client import get_client


def _resolve_client_uuid(client_id: str) -> str:
    """
    Converte un client_key breve ('dakady') nel UUID del cliente.
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
                "ig_refs_b64":   d.get("ig_refs_b64", []) or [],
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
    Funziona per qualsiasi cliente — nessun riferimento hardcoded a DaKady.
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

    # Uppercase obbligatorio se il brand kit lo richiede
    force_uppercase = opus_typo.get("transform", "") == "uppercase"
    body_instruction = "EN MAYÚSCULAS — máx 6 palabras por línea." if force_uppercase else "en minúsculas. SIEMPRE termina con punto final."

    # Blocco tipografia esatta
    opus_typography_block = ""
    if opus_typo and opus_typo.get("styles"):
        styles = opus_typo["styles"]
        hl  = styles.get("headline", {})
        sub = styles.get("subheadline", {})
        bod = styles.get("body", {})
        tag = styles.get("tag", {})
        opus_typography_block = f"""
=== TIPOGRAFÍA EXACTA DEL BRAND KIT ===
Font: {opus_typo.get('font_family', '')} — transform: {opus_typo.get('transform','').upper()}
H1 (headline):    peso {hl.get('weight','?')}, line-height {hl.get('line_height','?')}, Story={hl.get('sizes',{}).get('story_9x16_px','?')}px / Square={hl.get('sizes',{}).get('square_1x1_px','?')}px / Landscape={hl.get('sizes',{}).get('landscape_16x9_px','?')}px
H2 (subheadline): peso {sub.get('weight','?')}, line-height {sub.get('line_height','?')}, Story={sub.get('sizes',{}).get('story_9x16_px','?')}px / Square={sub.get('sizes',{}).get('square_1x1_px','?')}px
Body:             peso {bod.get('weight','?')}, line-height {bod.get('line_height','?')}, Story={bod.get('sizes',{}).get('story_9x16_px','?')}px / Square={bod.get('sizes',{}).get('square_1x1_px','?')}px
Tag:              peso {tag.get('weight','?')}, color {tag.get('color','')}, posición: {tag.get('position','')}"""

    # Blocco gerarchia colori H1/H2
    opus_hierarchy_block = ""
    if opus_hierarchy:
        dark  = opus_hierarchy.get("on_dark_bg", {})
        light = opus_hierarchy.get("on_light_bg", {})
        rule  = opus_hierarchy.get("rule", "")
        examples = opus_hierarchy.get("examples", [])
        ex_lines = "\n".join(
            f"  H1='{e.get('h1','')}' ({e.get('h1_color','')}) + H2='{e.get('h2','')}' ({e.get('h2_color','')}) — bg: {e.get('bg','')}"
            for e in examples
        )
        opus_hierarchy_block = f"""
=== JERARQUÍA DE COLORES (REGLA ABSOLUTA) ===
{rule}
Sobre fondo OSCURO:  H1={dark.get('h1','')}  H2={dark.get('h2','')}  body={dark.get('body','')}  tag={dark.get('tag','')}
Sobre fondo CLARO:   H1={light.get('h1','')}  H2={light.get('h2','')}  body={light.get('body','')}  tag={light.get('tag','')}
Ejemplos reales:
{ex_lines}"""

    # Blocco regole composizione
    opus_rules_block = ""
    if opus_comp:
        do_list   = "\n".join(f"  ✓ {r}" for r in opus_comp.get("do", []))
        dont_list = "\n".join(f"  ✗ {r}" for r in opus_comp.get("dont", []))
        opus_rules_block = f"""
=== REGLAS DE COMPOSICIÓN DEL BRAND KIT ===
SIEMPRE:
{do_list}
NUNCA:
{dont_list}"""

    # Blocco guida ragionamento agente
    opus_guide_block = ""
    if opus_guide:
        opus_guide_block = f"""
=== GUÍA DE DECISIÓN PARA EL AGENTE ===
Fondo:    {opus_guide.get('how_to_choose_background', '')}
Template: {opus_guide.get('how_to_choose_template', '')}
Colores:  {opus_guide.get('how_to_alternate_colors', '')}
Tamaño:   {opus_guide.get('font_size_logic', '')}
Padding:  {opus_guide.get('padding_rule', '')}"""

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
                f"  [{t['id']}] {t['name']} — formato={t.get('format','')} sfondo={t.get('background','')}\n"
                f"    Struttura: {layout_str}\n"
                f"    Esempio: {t.get('example','')}"
            )
        opus_templates_block = "=== TEMPLATES DEL BRAND KIT (usa SOLO questi per questo cliente) ===\n" + "\n".join(t_lines)

    # ── blocchi standard ────────────────────────────────────────────────────
    primary_color = colors[0]["hex"] if colors else "#333333"

    pillar_lines = "\n".join(
        f"{i+1}. {p['nombre']} ({p.get('pct', 0)}%) — {p.get('descripcion', '')}"
        for i, p in enumerate(pillars)
    ) or "Sin pilares definidos."

    color_lines = ", ".join(f"{c['name']} {c['hex']} ({c.get('uso','')})" for c in colors) or "Sin paleta definida."
    font_lines  = ", ".join(f"{f['name']} ({f.get('tipo','')} — {f.get('uso','')})" for f in fonts) or "Sin fuentes definidas."

    custom_layout_rows = "\n".join(
        f"| {l['name']} | {l.get('descripcion', '')} |" for l in layouts
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

    # Tone stringa semplice (fallback se opus_tone_block è vuoto)
    tone_str = tone if isinstance(tone, str) else (tone.get("persona", "") if isinstance(tone, dict) else "Profesional y cercano al cliente.")

    return f"""Eres el Content Designer AI para {name}.
Tu misión es producir contenido completo y publicable para Instagram, Facebook y LinkedIn.

=== IDENTIDAD DEL CLIENTE ===
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

=== BRAND IDENTITY VISUAL ===
Color primario: {primary_color}
Paleta completa: {color_lines}
Tipografía: {font_lines}
{opus_typography_block}
{opus_hierarchy_block}
{opus_tone_block}
{opus_rules_block}
{opus_guide_block}

=== NOTAS DE MARCA (seguir siempre) ===
{notes or "Sin notas adicionales."}

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

REGOLA VARIETÀ: se generi più contenuti, usa layout_variant DIVERSI per ognuno. Non ripetere mai lo stesso layout due volte consecutive.

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


def save_brand_kit(client_id: str, colors: list, fonts: list, templates: list) -> bool:
    """
    Salva (upsert) il brand kit del cliente su Supabase.
    Ritorna True se salvato, False se errore.
    """
    db = get_client()
    if not db:
        return False
    try:
        db.table("client_brand").upsert({
            "client_id": client_id,
            "colors":    colors,
            "fonts":     fonts,
            "templates": templates,
        }, on_conflict="client_id").execute()
        return True
    except Exception as e:
        print(f"⚠️  brand_store.save_brand_kit error: {e}")
        return False


def build_brand_context(brand_kit: dict) -> str:
    """
    Costruisce il blocco di testo da iniettare nel prompt di Claude
    con le info complete del brand kit del cliente.
    Ritorna stringa vuota se il kit è vuoto.
    """
    parts = []

    if brand_kit.get("colors"):
        color_list = ", ".join(
            f"{c['name']} ({c['hex']}) — {c.get('uso','')}" for c in brand_kit["colors"]
        )
        parts.append(f"COLORI BRAND: {color_list}")

    if brand_kit.get("fonts"):
        font_list = ", ".join(
            f"{f['name']} ({f.get('tipo','')})" for f in brand_kit["fonts"]
        )
        parts.append(f"FONT BRAND: {font_list}")

    if brand_kit.get("tone_of_voice"):
        parts.append(f"TONO DI VOCE: {brand_kit['tone_of_voice']}")

    if brand_kit.get("pillars"):
        pillar_list = ", ".join(
            f"{p['nombre']} {p.get('pct','')}%" for p in brand_kit["pillars"]
        )
        parts.append(f"PILLAR EDITORIALI: {pillar_list}")

    if brand_kit.get("layouts"):
        layout_list = ", ".join(
            f"{l['name']} ({l.get('descripcion','')})" for l in brand_kit["layouts"]
        )
        parts.append(f"LAYOUT PREFERITI: {layout_list}")

    templates = brand_kit.get("templates", [])
    if templates:
        parts.append(
            "TEMPLATE STORY APPROVATI — Ruota tra questi:\n" +
            "\n".join(
                f"  [{i+1}] {t.get('name','?')} — {t.get('descripcion', t.get('analysis',''))}"
                for i, t in enumerate(templates)
            )
        )
        parts.append(
            "REGOLA VARIETÀ: ogni post DEVE usare un layout_variant diverso dagli altri."
        )

    if brand_kit.get("notes"):
        parts.append(f"NOTE BRAND (segui sempre): {brand_kit['notes']}")

    refs = brand_kit.get("ig_refs_b64") or []
    if refs:
        parts.append(
            f"POST INSTAGRAM DI RIFERIMENTO: il cliente ha caricato {len(refs)} post reali "
            "del proprio feed come esempio di stile visuale. Rispetta sempre i pattern "
            "(colori, font, posizione del logo, gerarchia, uso degli spazi) coerenti con quei post."
        )

    if not parts:
        return ""

    return "\n\n=== BRAND KIT CLIENTE ===\n" + "\n".join(parts) + "\n=== FINE BRAND KIT ==="
