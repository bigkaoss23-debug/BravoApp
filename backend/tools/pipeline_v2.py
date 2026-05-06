"""
pipeline_v2.py — Pipeline B: Generazione singolo post (v2).

Catena completa:
  A5 BriefComposer → A6 CopyAgent → A7 ArtDirector → A8 PhotoAnalyzer
  → A11 Renderer (designer.composite) → A14 BrandCompliance → A15 ToneValidator (+ retry A6)

Input:  slot dal piano editoriale + brand_kit_opus + path foto.
Output: dict con copy finale, immagine b64+url, compliance e tone result.
"""

from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Optional


# =============================================================================
# Helpers privati
# =============================================================================

def _img_to_b64(pil_image, quality: int = 84) -> str:
    buf = io.BytesIO()
    pil_image.convert("RGB").save(buf, "JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()


def _extract_render_params(brand_kit_opus: dict, content_format: str = "Post 1:1") -> dict:
    """
    Estrae da brand_kit_opus tutti i parametri necessari a designer.composite().
    Replica la logica di pipeline.py::generate_variants per i casi standard.
    Verrà eliminata in Step 7 quando designer.py diventa tools/renderer.py.
    """
    opus_typo = brand_kit_opus.get("typography", {})
    opus_hier = brand_kit_opus.get("text_hierarchy", {})
    _styles = opus_typo.get("styles", {})

    # ── Colori testo ──────────────────────────────────────────────────────────
    on_dark = opus_hier.get("on_dark_bg", {})
    headline_color_hex = (
        on_dark.get("h1")
        or _styles.get("headline", {}).get("colors", {}).get("on_dark")
        or "#FFFFFF"
    )
    headline_color_h2_hex = (
        on_dark.get("h2")
        or _styles.get("subheadline", {}).get("colors", {}).get("on_dark")
    )
    body_color_hex = (
        on_dark.get("body")
        or _styles.get("body", {}).get("colors", {}).get("on_dark")
        or "#E6E6E6"
    )

    # ── Overlay background ────────────────────────────────────────────────────
    primary_color_hex = "#1C1C1C"
    bg_overlay_hex = None
    bg_overlay_alpha = 0.52

    opus_colors = brand_kit_opus.get("colors", {})
    _colors_iter = (
        opus_colors.values()
        if isinstance(opus_colors, dict)
        else (opus_colors if isinstance(opus_colors, list) else [])
    )
    for _c in _colors_iter:
        if isinstance(_c, dict) and _c.get("role") == "background_dark":
            primary_color_hex = _c.get("hex", primary_color_hex)
            bg_overlay_hex = _c.get("hex")
            bg_overlay_alpha = float(_c.get("overlay_opacity", 0.72))
            break

    # Brand elegante/luminoso → overlay leggero
    ds = brand_kit_opus.get("design_system") or {}
    visual_direction = ds.get("visual_direction", "") or brand_kit_opus.get("visual_direction", "")
    if any(kw in visual_direction.lower() for kw in ["soft", "light", "warm", "minimal", "airy", "editorial"]):
        bg_overlay_alpha = min(bg_overlay_alpha, 0.42)

    # ── Font sizes (scala ×2.5 per canvas 1080px) ─────────────────────────────
    _format_key_map = {
        "Story 9:16": "story_9x16_px",
        "Portada Reel": "story_9x16_px",
        "Post 1:1": "square_1x1_px",
        "Carosello": "square_1x1_px",
        "Landscape": "landscape_16x9_px",
    }
    _size_key = _format_key_map.get(content_format, "square_1x1_px")
    _SCALE = 2.5
    _hl_raw = (_styles.get("headline", {}).get("sizes", {}) or {}).get(_size_key)
    _body_raw = (_styles.get("body", {}).get("sizes", {}) or {}).get(_size_key)
    headline_size = int(_hl_raw * _SCALE) if _hl_raw else None
    body_size_val = int(_body_raw * _SCALE) if _body_raw else None

    # ── Font files ────────────────────────────────────────────────────────────
    _assets = Path(__file__).parent.parent / "assets"
    _font_map = {
        "barlow condensed": str(_assets / "BarlowCondensed-Black.otf"),
        "barlow": str(_assets / "BarlowCondensed-Black.otf"),
        "oswald": str(_assets / "Oswald-Bold.ttf"),
        "bebas": str(_assets / "BebasNeue-Regular.ttf"),
        "libre": str(_assets / "LibreFranklin.ttf"),
        "montserrat": str(_assets / "Oswald-Bold.ttf"),
        "cormorant garamond": str(_assets / "CormorantGaramond-Regular.ttf"),
        "cormorant": str(_assets / "CormorantGaramond-Regular.ttf"),
        "jost": str(_assets / "Jost-Regular.ttf"),
    }
    font_family = opus_typo.get("font_family", "").lower()
    font_headline_path = None
    font_body_path = None
    for key, path in _font_map.items():
        if key in font_family and Path(path).exists():
            font_headline_path = path
            bold_path = path.replace("-Black.otf", "-Bold.otf").replace("-Bold.ttf", "-Bold.ttf")
            font_body_path = bold_path if Path(bold_path).exists() else path
            break

    force_uppercase = opus_typo.get("transform", "") == "uppercase"

    return {
        "primary_color_hex": primary_color_hex,
        "headline_color_hex": headline_color_hex,
        "headline_color_h2_hex": headline_color_h2_hex,
        "body_color_hex": body_color_hex,
        "bg_overlay_hex": bg_overlay_hex,
        "bg_overlay_alpha": bg_overlay_alpha,
        "font_headline_path": font_headline_path,
        "font_body_path": font_body_path,
        "force_uppercase": force_uppercase,
        "headline_size": headline_size,
        "body_size_override": body_size_val,
    }


# =============================================================================
# Pipeline principale
# =============================================================================

def run_post_pipeline(
    *,
    client_id: str,
    slot: dict,
    photo_path: str,
    brand_kit_opus: dict,
    copy_agent,
    art_director,
    tone_validator,
    user_note: str = "",
    seasonal_context: Optional[dict] = None,
    scene_description: str = "",
    render: bool = True,
) -> dict:
    """
    Pipeline B completa per un singolo post.

    slot deve contenere: pillar, angle, persona, scheduled_date
    Campi opzionali: format (default 'Post 1:1'), platform, brief (note extra)

    Restituisce dict con:
      headline, caption, hashtags, layout_variant, photo_filter_applied,
      content_type, img_b64, image_url, compliance, tone, brief (metadati slot)
    """
    from agents.brief_composer import compose, to_prompt_block
    from tools.photo_analyzer import analyze_photo_full
    from tools.brand_compliance import check_compliance
    from tools.pipeline import upload_image_to_storage  # riusa utility v1

    pillar = slot.get("pillar", "")
    angle = slot.get("angle", "")
    persona = slot.get("persona", "")
    print(f"🚀 Pipeline v2 — {pillar} × {angle} × {persona}")

    # ── A5 BriefComposer ──────────────────────────────────────────────────────
    brief = compose(slot, brand_kit_opus, seasonal_context)
    brief_block = to_prompt_block(brief)
    print("   ✓ A5 BriefComposer")

    # ── A8 PhotoAnalyzer ──────────────────────────────────────────────────────
    photo_analysis = analyze_photo_full(photo_path)
    overlay_start_pct = photo_analysis["overlay_start_pct"]
    ranked_layouts = photo_analysis["ranked_layouts"][:4]
    print(f"   ✓ A8 PhotoAnalyzer — top layouts: {ranked_layouts[:2]} | overlay: {int(overlay_start_pct*100)}%")

    # Brief arricchito con hint foto + note utente
    extra_ctx = (
        f"\n\nANÁLISIS DE FOTO: zona oscura desde {int(overlay_start_pct*100)}% altura. "
        f"Layouts recomendados: {ranked_layouts}."
    )
    if user_note:
        extra_ctx += f"\n\nNOTA ADICIONAL: {user_note}"

    # ── A6 CopyAgent ──────────────────────────────────────────────────────────
    copy_result = copy_agent.run(brief, extra_context=extra_ctx)
    headline = copy_result.get("headline", "")
    caption = copy_result.get("caption", "")
    hashtags = copy_result.get("hashtags", brief.get("hashtags", []))
    print(f"   ✓ A6 CopyAgent — '{headline[:50]}'")

    # ── A7 ArtDirector ────────────────────────────────────────────────────────
    art_result = art_director.run(brief, headline, caption, scene_description=scene_description)
    layout_variant = art_result.get("layout_variant", ranked_layouts[0] if ranked_layouts else "bottom-text")
    photo_filter_applied = art_result.get("photo_filter_applied", brief.get("photo_filter", {}))
    content_type = art_result.get("content_type", "")

    # Valida layout contro analisi foto
    if layout_variant not in ranked_layouts and ranked_layouts:
        print(f"   ⚠ Layout '{layout_variant}' non in lista foto → '{ranked_layouts[0]}'")
        layout_variant = ranked_layouts[0]
    print(f"   ✓ A7 ArtDirector — layout: {layout_variant}")

    # ── A15 ToneValidator (retry A6 integrato) ────────────────────────────────
    copy_final, tone_result = tone_validator.validate_with_retry(
        headline=headline,
        caption=caption,
        brand_kit_opus=brand_kit_opus,
        copy_agent=copy_agent,
        brief=brief,
    )
    headline = copy_final.get("headline", headline)
    caption = copy_final.get("caption", caption)
    print(f"   ✓ A15 ToneValidator — passed: {tone_result['passed']} score: {tone_result['score']:.2f}")

    # ── A14 BrandCompliance ───────────────────────────────────────────────────
    compliance_result = check_compliance(headline, caption, brand_kit_opus)
    print(f"   ✓ A14 BrandCompliance — passed: {compliance_result['passed']}")

    # ── A11 Renderer (designer.composite) ────────────────────────────────────
    img_b64 = ""
    image_url = ""
    render_error = None

    if render:
        try:
            from tools.renderer import composite_v2
            from tools.brand_store import get_brand_kit

            brand_kit = get_brand_kit(client_id)
            logo_b64 = brand_kit.get("logo_b64")
            content_format = brief.get("format", "Post 1:1")
            render_params = _extract_render_params(brand_kit_opus, content_format)

            img = composite_v2(
                photo_path=photo_path,
                headline=headline,
                photo_filters=photo_filter_applied,
                body="",
                layout_variant=layout_variant,
                logo_position="br",
                content_format=content_format,
                label="",
                side="left",
                logo_b64=logo_b64,
                overlay_start_pct=overlay_start_pct,
                **render_params,
            )
            img_b64 = _img_to_b64(img)
            image_url = upload_image_to_storage(img, client_id, 0) or ""
            print("   ✓ A11 Renderer (con filtri foto)")
        except Exception as e:
            import traceback
            render_error = traceback.format_exc()
            print(f"   ⚠ A11 Renderer fallito: {e}")

    return {
        "headline": headline,
        "caption": caption,
        "hashtags": hashtags,
        "layout_variant": layout_variant,
        "photo_filter_applied": photo_filter_applied,
        "content_type": content_type,
        "img_b64": img_b64,
        "image_url": image_url,
        "overlay_start_pct": overlay_start_pct,
        "compliance": {
            "passed": compliance_result["passed"],
            "score": compliance_result["score"],
            "checks": compliance_result.get("checks", []),
        },
        "tone": {
            "passed": tone_result["passed"],
            "score": tone_result["score"],
            "violations": tone_result.get("violations", []),
        },
        "brief": {
            "pillar": brief["pillar"],
            "angle": brief["angle"],
            "persona": brief["persona"],
            "scheduled_date": brief.get("scheduled_date", ""),
            "format": brief.get("format", "Post 1:1"),
        },
        **({"render_error": render_error} if render_error else {}),
    }
