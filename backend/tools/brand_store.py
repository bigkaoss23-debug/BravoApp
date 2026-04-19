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

    template_lines = "\n".join(
        f"  [{t.get('id','?')}] {t.get('name','?')} — {t.get('descripcion', '')}"
        for t in templates
    )
    templates_block = ("TEMPLATES APPROVATI — usa come riferimento visivo:\n" + template_lines) if template_lines else ""

    return f"""Eres el Content Designer AI para {name}.
Tu misión es producir contenido completo y publicable para Instagram, Facebook y LinkedIn.

=== IDENTIDAD DEL CLIENTE ===
Empresa: {name}
Sector: {sector}
Ciudad: {city}
Descripción: {description}
Instagram: {instagram}
Tono de voz: {tone}

=== PILARES EDITORIALES ===
Rota los contenidos entre estos pilares:
{pillar_lines}

=== BRAND IDENTITY VISUAL ===
Color primario: {primary_color}
Paleta completa: {color_lines}
Tipografía: {font_lines}

=== NOTAS DE MARCA (seguir siempre) ===
{notes or "Sin notas adicionales."}

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
    "body": "[texto body en minúsculas. SIEMPRE termina con punto final.]",
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
