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
                f"  [{t.get('id','?')}] {t.get('name','?')} — formato={t.get('format','')} sfondo={t.get('background','')}\n"
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

=== BRAND IDENTITY ===
Tono visual: {color_lines}
{opus_tone_block}
{opus_rules_block}

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

    return f"""Sei il Content Designer AI per {brand_name}.
Il tuo compito è generare il CONTENUTO di un carosello Instagram di {num_slides} slide.

=== REGOLE DEL BRAND {brand_name.upper()} ===
Persona: {persona}
Principi tono di voce:
{principles_block}

=== STRUTTURA OBBLIGATORIA ===
Sequenza: {seq}
Numero slide: da {num_min} a {num_max} (in questo caso ESATTAMENTE {num_slides})

=== RICETTE SLIDE DISPONIBILI (usa SOLO questi recipe_id) ==={recipes_block}

=== REGOLE DI VARIAZIONE (rispetta SEMPRE) ===
{variation_block}

=== DIMENSIONI TESTO (per slide 420×420px) ===
H1: {text_sizes.get('h1_min', 52)}–{text_sizes.get('h1_max', 72)}px
H2: {text_sizes.get('h2_min', 36)}–{text_sizes.get('h2_max', 52)}px
Tag: {text_sizes.get('tag', 10)}px (letter-spacing 0.22em)
Sub: {text_sizes.get('sub', 14)}px
Nota: {text_sizes.get('note', '')}

=== FORMATO RISPOSTA (JSON ARRAY — NESSUN TESTO FUORI) ===
Restituisci ESATTAMENTE {num_slides} oggetti in un array JSON:

[
  {{
    "idx": 0,
    "slide_type": "intro",
    "recipe_id": "intro",
    "tag": "ETICHETTA BREVE IN MAIUSCOLO",
    "headline": "PAROLA O FRASE BREVE",
    "h2": "SECONDA RIGA",
    "sub": "sottotitolo breve (max 8 parole)",
    "scroll_hint": "Desliza para descubrir →"
  }},
  {{
    "idx": 1,
    "slide_type": "body",
    "recipe_id": "body_navy",
    "tag": "ETICHETTA",
    "headline": "TITOLO",
    "h2": "TITOLO 2",
    "sub": "dettaglio breve"
  }},
  ...
  {{
    "idx": {num_slides - 1},
    "slide_type": "cta",
    "recipe_id": "cta",
    "tag": "Empieza hoy",
    "headline": "VERBO AZIONE",
    "h2": "AL SISTEMA",
    "pill_text": "CALL TO ACTION BREVE",
    "sub": "info aggiuntiva breve"
  }}
]

Regole stringenti:
- headline SEMPRE MAIUSCOLO, max 10 caratteri per riga
- h2 SEMPRE MAIUSCOLO, max 12 caratteri per riga
- tag SEMPRE MAIUSCOLO con letter-spacing
- sub normale (non tutto maiuscolo), max 8 parole
- recipe_id DEVE essere uno dei: {list(recipes.keys())}
- Rispetta la variation_rule — NON due recipe consecutive con stesso bg
- Risposta SOLO JSON valido, nessun testo prima o dopo"""
