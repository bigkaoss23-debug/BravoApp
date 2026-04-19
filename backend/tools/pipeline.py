"""
pipeline.py — Logica condivisa tra generate_demo.py, generate_preview.py,
generate_weekly_posts.py.

Elimina la duplicazione del flusso Claude → Designer (Pillow) → dict pronti
per HTML. Ogni script CLI conserva il proprio HTML template (demo pitch-deck,
preview interna, weekly review BRAVO) ma condivide TUTTA la parte di elaborazione.
"""

import base64
import io
import uuid
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


_storage_bucket_ready = False

def upload_image_to_storage(pil_image, client_id: str, idx: int) -> Optional[str]:
    """
    Carica l'immagine su Supabase Storage bucket 'bravo-content'.
    Restituisce l'URL pubblico, oppure None se fallisce (il chiamante usa base64 come fallback).
    """
    global _storage_bucket_ready
    from tools.supabase_client import get_client
    sb = get_client()
    if sb is None:
        return None
    try:
        # Crea bucket una volta sola se non esiste
        if not _storage_bucket_ready:
            try:
                sb.storage.create_bucket("bravo-content", options={"public": True})
            except Exception:
                pass  # Già esistente è ok
            _storage_bucket_ready = True

        buf = io.BytesIO()
        pil_image.convert("RGB").save(buf, "JPEG", quality=84)
        img_bytes = buf.getvalue()
        filename = f"{client_id}/{uuid.uuid4().hex}_{idx}.jpg"
        sb.storage.from_("bravo-content").upload(filename, img_bytes, {"content-type": "image/jpeg"})
        url = sb.storage.from_("bravo-content").get_public_url(filename)
        print(f"   ☁️  Storage OK: {filename}")
        return url
    except Exception as e:
        print(f"   ⚠️  Storage upload fallito, uso base64: {e}")
        return None


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
    client_id: str = "dakady",
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

    # 2. Carica brand kit completo
    from tools.brand_store import get_brand_kit
    from pathlib import Path as _Path
    brand_kit = get_brand_kit(client_id)
    logo_b64  = brand_kit.get("logo_b64")
    colors    = brand_kit.get("colors") or []
    bk_fonts  = brand_kit.get("fonts") or []

    # Colore primario (accent bar, logo backing)
    primary_color_hex = colors[0].get("hex", "#C0392B") if colors else "#C0392B"

    # Colori testo — letti dal campo "uso" di ogni colore nel brand kit
    headline_color_hex = "#FFFFFF"
    body_color_hex     = "#E6E6E6"
    for c in colors:
        uso = (c.get("uso") or "").lower()
        h   = c.get("hex", "")
        if not h:
            continue
        if any(k in uso for k in ["headline", "titol", "primari", "enfatiz"]):
            headline_color_hex = h
        elif any(k in uso for k in ["body", "cuerpo", "secondar", "soporte", "testo di supporto"]):
            body_color_hex = h

    # Font — seleziona file TTF in base al nome del font del brand kit
    _assets = _Path(__file__).parent.parent / "assets"
    _font_map = {
        "oswald":       str(_assets / "Oswald-Bold.ttf"),
        "bebas":        str(_assets / "BebasNeue-Regular.ttf"),
        "libre":        str(_assets / "LibreFranklin.ttf"),
        "montserrat":   str(_assets / "Oswald-Bold.ttf"),   # proxy — stessa famiglia impact
        "sans-serif bold": str(_assets / "Oswald-Bold.ttf"),
        "bold":         str(_assets / "Oswald-Bold.ttf"),
        "heavy":        str(_assets / "Oswald-Bold.ttf"),
    }
    font_headline_path = None
    font_body_path     = None
    if bk_fonts:
        hl_name = (bk_fonts[0].get("name") or "").lower()
        for key, path in _font_map.items():
            if key in hl_name and _Path(path).exists():
                font_headline_path = path
                break
        if len(bk_fonts) > 1:
            body_name = (bk_fonts[1].get("name") or "").lower()
            for key, path in _font_map.items():
                if key in body_name and _Path(path).exists():
                    font_body_path = path
                    break

    # 3. Chiama Claude
    print(f"⚡ Claude genera {num_variants} varianti...", flush=True)
    agent = ContentDesignerAgent(api_key=anthropic_key, ideogram_api_key=ideogram_key)
    request = GenerateContentRequest(
        brief=brief,
        client_id=client_id,
        platform=Platform(platform),
        format=ContentFormat(content_format),
        num_contents=num_variants,
        generate_image=False,
    )
    response = agent.run(request)
    contents = response.contents

    for i, c in enumerate(contents):
        print(f"   [{i+1}] {c.overlay.headline}  [{c.overlay.layout_variant.value}]")

    # 4. Rendering Pillow
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
            side=content.overlay.side or "left",
            logo_b64=logo_b64,
            primary_color_hex=primary_color_hex,
            headline_color_hex=headline_color_hex,
            body_color_hex=body_color_hex,
            font_headline_path=font_headline_path,
            font_body_path=font_body_path,
        )
        b64 = img_to_b64(img)          # sempre generato come fallback sicuro
        image_url = upload_image_to_storage(img, client_id, i)
        variants.append({
            "idx":            i,
            "img_b64":        b64,          # base64 sempre presente
            "image_url":      image_url or "",
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
