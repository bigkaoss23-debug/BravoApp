"""
pipeline.py — Logica condivisa tra generate_demo.py, generate_preview.py,
generate_weekly_posts.py.

Elimina la duplicazione del flusso Claude → Designer (Pillow) → dict pronti
per HTML. Ogni script CLI conserva il proprio HTML template (demo pitch-deck,
preview interna, weekly review BRAVO) ma condivide TUTTA la parte di elaborazione.
"""

import base64
import io
from pathlib import Path
from typing import Optional

from agents.content_designer import ContentDesignerAgent
from agents.designer import composite
from models.content import GenerateContentRequest, Platform, ContentFormat


# =============================================================================
# Utility
# =============================================================================

def img_to_b64(pil_image, quality: int = 84) -> str:
    """Converte un PIL.Image in base64 JPEG."""
    buf = io.BytesIO()
    pil_image.convert("RGB").save(buf, "JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()


def photo_thumb_b64(photo_path: str, size: int = 700, quality: int = 80) -> str:
    """Genera una thumbnail base64 della foto originale."""
    from PIL import Image as PILImage
    img = PILImage.open(photo_path)
    thumb = img.copy()
    thumb.thumbnail((size, size))
    return img_to_b64(thumb, quality=quality)


# =============================================================================
# Briefing (weekly merge)
# =============================================================================

def load_weekly_briefing(briefing_path: Path) -> str:
    """Legge un file di briefing settimanale. Stringa vuota se non trovato."""
    if not briefing_path.exists():
        print(f"⚠️  Briefing settimanale non trovato: {briefing_path}")
        return ""
    return briefing_path.read_text()


def build_enhanced_brief(daily_brief: str, weekly_briefing: str) -> str:
    """Combina briefing settimanale + brief quotidiano in un solo prompt utente."""
    if not weekly_briefing:
        return daily_brief
    return f"""
=== BRIEFING SETTIMANALE (TEMA + PARTNERS + ÁNGULOS) ===
{weekly_briefing}

---

=== BRIEF QUOTIDIANO DI OGGI ===
{daily_brief}

---

=== TUA MISSIONE ===
Genera varianti coerenti che:
1. SIGUE EL TEMA SEMANAL: coerenza con tema, puntos técnicos y ángulos del briefing.
2. MENCIONA SOLO PARTNERS EN FOCO: solo quelli specificati nel briefing.
3. EQUIPO: menciona team members solo se presenti in "Team en campo".
4. ÁNGULOS NARRATIVOS: scegli tra gli ángulos disponibili, non inventare altri.
5. DETALLE CONCRETO: includi il brief quotidiano come dettaglio specifico del post.
6. DIVERSIDAD: i post devono essere DIFFERENTI tra loro (pilari, tipi, layout).
"""


# =============================================================================
# Pipeline principale
# =============================================================================

def generate_variants(
    *,
    anthropic_key: str,
    photo_path: str,
    brief: str,
    platform: str = "Instagram",
    content_format: str = "Post 1:1",
    num_variants: int = 5,
    ideogram_key: Optional[str] = None,
    briefing_file: Optional[Path] = None,
) -> tuple[list[dict], object]:
    """
    Esegue pipeline Claude → Designer e restituisce (variants, raw_response).

    Ogni variant è un dict pronto per essere serializzato in HTML:
      idx, img_b64, headline, body, caption, agent_notes, pillar,
      format, platform, layout_variant.

    raw_response è il GenerateContentResponse completo (per accedere ai
    agent_notes top-level con eventuali errori Ideogram).
    """
    # 1. Eventualmente arricchisci il brief con il briefing settimanale
    if briefing_file is not None:
        weekly = load_weekly_briefing(briefing_file)
        brief = build_enhanced_brief(brief, weekly)

    # 2. Chiama Claude
    print(f"⚡ Claude genera {num_variants} varianti...", flush=True)
    agent = ContentDesignerAgent(api_key=anthropic_key, ideogram_api_key=ideogram_key)
    request = GenerateContentRequest(
        brief=brief,
        client_id="dakady",
        platform=Platform(platform),
        format=ContentFormat(content_format),
        num_contents=num_variants,
        generate_image=False,
    )
    response = agent.run(request)
    contents = response.contents

    for i, c in enumerate(contents):
        print(f"   [{i+1}] {c.overlay.headline}  [{c.overlay.layout_variant.value}]")

    # 3. Rendering Pillow
    print(f"\n🖼  Designer renderizza {len(contents)} immagini...", flush=True)
    variants: list[dict] = []
    for i, content in enumerate(contents):
        img = composite(
            photo_path=photo_path,
            headline=content.overlay.headline,
            body=content.overlay.body,
            layout_variant=content.overlay.layout_variant.value,
            logo_position=content.overlay.logo_position,
            content_format=content_format,
            label=content.overlay.label,
            subtitle_color=content.overlay.subtitle_color,
            side=content.overlay.side,
        )
        variants.append({
            "idx":            i,
            "img_b64":        img_to_b64(img),
            "headline":       content.overlay.headline,
            "body":           content.overlay.body or "",
            "caption":        content.caption,
            "agent_notes":    content.agent_notes or "",
            "pillar":         content.pillar.value,
            "format":         content.format.value,
            "platform":       content.platform.value,
            "layout_variant": content.overlay.layout_variant.value,
        })
        print(f"   ✓ Opción {i+1}")

    if response.agent_notes:
        print(f"\n⚠️  Note generali: {response.agent_notes}")

    return variants, response
