"""
BRAVO — Brand Kit Analyzer
Usa Claude Opus per analizzare file SVG/logo di un cliente
e restituire un brand kit strutturato.
"""

import re
import json
import anthropic


# ── Stripping base64 dalle SVG con foto embedded ─────────────────────────────

def strip_base64_from_svg(svg_content: str) -> str:
    """Rimuove i dati base64 da SVG mantenendo la struttura del layout."""
    # Sostituisce data:image/...;base64,<DATI> con un placeholder
    cleaned = re.sub(
        r'(xlink:href|href)="data:image/[^;]+;base64,[^"]{20,}"',
        r'\1="[PHOTO_PLACEHOLDER]"',
        svg_content
    )
    return cleaned


def is_useful_svg(content: str) -> bool:
    """Scarta SVG vuoti o troppo piccoli per essere layout reali."""
    return len(content.strip()) > 500


# ── Prompt Opus ───────────────────────────────────────────────────────────────

BRAND_ANALYZER_SYSTEM = """Eres un art director senior especializado en brand identity y diseño para redes sociales.
Analizas archivos SVG de layouts de Instagram Stories (1080x1920px) y material de marca para extraer
un brand kit completo y estructurado.

Tu output DEBE ser un JSON válido, sin texto antes ni después, con esta estructura exacta:

{
  "colors": [
    { "name": "Nombre color", "hex": "#XXXXXX", "uso": "Descripción de uso en el layout" }
  ],
  "fonts": [
    { "name": "Nombre fuente", "tipo": "Headline|Subtítulo|Cuerpo|Datos", "uso": "Descripción de uso" }
  ],
  "tone_of_voice": "Descripción del tono comunicativo deducido de los textos en los layouts",
  "pillars": [
    { "nombre": "NOMBRE_PILAR", "pct": 20, "color": "#XXXXXX", "descripcion": "Descripción" }
  ],
  "layouts": [
    { "name": "nombre-layout", "descripcion": "Descripción de la estructura y uso ideal" }
  ],
  "templates": [
    { "name": "Nombre template", "descripcion": "Descripción del template y cuándo usarlo" }
  ],
  "notes": "Notas importantes sobre las reglas del brand: qué hacer y qué no hacer",
  "moods": [
    {
      "id": "slug-del-mood",
      "label": "Nombre legible (ej: Calma / Salud)",
      "palette": [
        { "name": "Nombre color", "hex": "#XXXXXX", "role": "primary|secondary|accent|background|text" }
      ],
      "font_headline": "Nombre fuente headline para este mood",
      "uso": "Cuándo usar este mood (tipo de contenido, emoción buscada)"
    }
  ],
  "archetypes": [
    { "id": "slug", "label": "Nombre", "descripcion": "Cuándo usar este arquetipo visual" }
  ],
  "pillar_mood_rules": {
    "NOMBRE_PILAR": { "mood": "slug-del-mood", "archetype": "slug-arquetipo" }
  }
}

Reglas de análisis:
- Extrae los colores exactos (hex) de los atributos fill/stroke de los SVG
- Identifica las fuentes de los tags <text>, font-family o de los paths vectoriales de texto
- Deduce el tono de los textos presentes en los layouts
- Los layouts se nombran en kebab-case (ej. "centered-header", "bottom-text-bar")
- Los porcentajes de los pilares deben sumar 100
- Para los moods: identifica 2-3 "universos visuales" distintos en el material (ej: uno técnico/frío, uno cálido/humano). Si el material es homogéneo, crea un solo mood que lo represente.
- Archetipos sugeridos: editoriale, minimalista, dinamico, focus-producto, informativo, inspiracional
- pillar_mood_rules mapea cada pilar al mood y arquetipo más apropiado para ese tipo de contenido
- Si no hay suficiente material para inferir moods, devuelve moods=[], archetypes=[], pillar_mood_rules={}
- Sé preciso y profesional — este brand kit guiará a un agente AI que generará contenidos reales"""


def analyze_brand_files(files: list[dict], client_name: str = "") -> dict:
    """
    Analizza i file SVG/logo con Claude Opus e restituisce il brand kit strutturato.

    files: lista di dict { "name": str, "content": str, "type": "svg"|"logo" }
    """
    client = anthropic.Anthropic()

    # Prepara il contenuto per Opus
    file_sections = []
    image_blocks = []   # blocchi immagine multimodali per Opus (logo + ref)
    svg_count = 0
    logo_count = 0
    ref_count = 0

    def _media_type_from_name(name: str) -> str:
        n = name.lower()
        if n.endswith(".png"):  return "image/png"
        if n.endswith(".webp"): return "image/webp"
        return "image/jpeg"

    for f in files:
        if f["type"] == "svg":
            content = strip_base64_from_svg(f["content"])
            if not is_useful_svg(content):
                continue
            svg_count += 1
            if len(content) > 15000:
                content = content[:12000] + "\n... [TRONCATO] ...\n" + content[-2000:]
            file_sections.append(f"=== LAYOUT SVG: {f['name']} ===\n{content}\n")
        elif f["type"] == "logo":
            logo_count += 1
            file_sections.append(f"=== LOGO: {f['name']} (vedi immagine allegata) ===\n")
            image_blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": _media_type_from_name(f["name"]),
                    "data": f["content"],
                },
            })
        elif f["type"] == "ref":
            ref_count += 1
            file_sections.append(
                f"=== POST IG DI RIFERIMENTO #{ref_count}: {f['name']} "
                f"(esempio reale di stile visuale del brand — vedi immagine allegata) ===\n"
            )
            image_blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": _media_type_from_name(f["name"]),
                    "data": f["content"],
                },
            })

    if not file_sections:
        raise ValueError("Nessun file valido da analizzare")

    user_text = f"""Analizza il brand kit di {client_name or 'questo cliente'}.

Materiale fornito:
- {svg_count} layout SVG (Instagram Stories 1080x1920px)
- {logo_count} file logo
- {ref_count} post Instagram di riferimento (sono esempi reali di post del brand: estrai da qui colori, font, gerarchia visiva, tono e tipologie di layout ricorrenti)

Analizza TUTTO il materiale e restituisci il brand kit completo in JSON.
Per i post di riferimento, identifica i pattern visivi ricorrenti (colori dominanti, font, posizione del logo, uso degli spazi) e descrivili nei "layouts".

{''.join(file_sections)}

Restituisci SOLO il JSON, niente altro."""

    user_content = image_blocks + [{"type": "text", "text": user_text}]

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        system=BRAND_ANALYZER_SYSTEM,
        messages=[
            {"role": "user", "content": user_content}
        ]
    )

    raw = response.content[0].text.strip()

    # Estrai JSON dalla risposta (rimuovi eventuali backtick)
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if not json_match:
        raise ValueError(f"Opus non ha restituito JSON valido: {raw[:200]}")

    brand_kit = json.loads(json_match.group(0))
    return brand_kit
