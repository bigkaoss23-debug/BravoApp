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

BRAND_ANALYZER_SYSTEM = """Sei un art director senior specializzato in brand identity e social media design.
Analizzi file SVG di layout Instagram Stories (1080x1920px) e materiale di brand per estrarre
un brand kit completo e strutturato.

Il tuo output DEVE essere un JSON valido, senza testo prima o dopo, con questa struttura esatta:

{
  "colors": [
    { "name": "Nome colore", "hex": "#XXXXXX", "uso": "Descrizione utilizzo nel layout" }
  ],
  "fonts": [
    { "name": "Nome font", "tipo": "Headline|Subtítulo|Cuerpo|Datos", "uso": "Descrizione utilizzo" }
  ],
  "tone_of_voice": "Descrizione del tono comunicativo dedotto dai testi nei layout",
  "pillars": [
    { "nombre": "NOME_PILLAR", "pct": 20, "color": "#XXXXXX", "descripcion": "Descrizione" }
  ],
  "layouts": [
    { "name": "nome-layout", "descripcion": "Descrizione struttura e utilizzo ideale" }
  ],
  "templates": [
    { "name": "Nome template", "descripcion": "Descrizione del template e quando usarlo" }
  ],
  "notes": "Note importanti sulle regole del brand: cosa fare e non fare"
}

Regole di analisi:
- Estrai i colori esatti (hex) dagli attributi fill/stroke delle SVG
- Identifica i font dai tag <text>, font-family o dai path vettoriali di testo
- Deduci il tono dai testi presenti nei layout
- I layout vanno nominati in kebab-case (es. "centered-header", "bottom-text-bar")
- I pillar percentuali devono sommare 100
- Sii preciso e professionale — questo brand kit guiderà un agente AI che genererà contenuti reali"""


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
