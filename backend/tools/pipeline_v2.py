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

    Legge la tipografia da due percorsi possibili:
      1. brand_kit_opus["design_system"]["typography"]  (Belvedere, nuovi brand kit)
      2. brand_kit_opus["typography"]                    (DaKady, brand kit vecchi)
    """
    ds = brand_kit_opus.get("design_system") or {}

    # Tipografia: nuovo formato (design_system.typography) o vecchio (typography)
    ds_typo = ds.get("typography") or {}
    opus_typo = brand_kit_opus.get("typography") or {}
    _styles = opus_typo.get("styles") or {}

    opus_hier = brand_kit_opus.get("text_hierarchy") or {}

    # ── Colori testo ──────────────────────────────────────────────────────────
    # Nuovo formato: design_system.colors.background è il colore testo su sfondo scuro
    ds_colors = ds.get("colors") or {}
    brand_light = ds_colors.get("background") or ds_colors.get("surface")

    on_dark = opus_hier.get("on_dark_bg") or {}
    headline_color_hex = (
        on_dark.get("h1")
        or _styles.get("headline", {}).get("colors", {}).get("on_dark")
        or brand_light
        or "#F5F0E8"
    )
    headline_color_h2_hex = (
        on_dark.get("h2")
        or _styles.get("subheadline", {}).get("colors", {}).get("on_dark")
        or ds_colors.get("warm")
    )
    body_color_hex = (
        on_dark.get("body")
        or _styles.get("body", {}).get("colors", {}).get("on_dark")
        or brand_light
        or "#F5F0E8"
    )

    # ── Overlay background ────────────────────────────────────────────────────
    ds_colors = ds.get("colors") or {}
    primary_color_hex = ds_colors.get("foreground") or "#1C1C1C"
    bg_overlay_hex = ds_colors.get("foreground")
    bg_overlay_alpha = 0.52

    opus_colors = brand_kit_opus.get("colors") or {}
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
    visual_direction = ds.get("visual_direction", "") or brand_kit_opus.get("visual_direction", "")
    if any(kw in visual_direction.lower() for kw in ["soft", "light", "warm", "minimal", "airy", "editorial"]):
        bg_overlay_alpha = min(bg_overlay_alpha, 0.42)

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

    # Nuovo formato: display.family per headline, body.family per body
    display_family = (ds_typo.get("display") or {}).get("family", "").lower()
    body_family = (ds_typo.get("body") or {}).get("family", "").lower()
    # Vecchio formato: font_family unico
    legacy_family = opus_typo.get("font_family", "").lower()

    font_headline_path = None
    font_body_path = None

    # Headline font (display)
    hl_family = display_family or legacy_family
    for key, path in _font_map.items():
        if key in hl_family and Path(path).exists():
            font_headline_path = path
            break

    # Body font
    bd_family = body_family or legacy_family
    for key, path in _font_map.items():
        if key in bd_family and Path(path).exists():
            font_body_path = path
            break

    # ── Font sizes ────────────────────────────────────────────────────────────
    _format_key_map = {
        "Story 9:16": "story_9x16_px",
        "Portada Reel": "story_9x16_px",
        "Post 1:1": "square_1x1_px",
        "Carosello": "square_1x1_px",
        "Landscape": "landscape_16x9_px",
    }
    _size_key = _format_key_map.get(content_format, "square_1x1_px")
    _SCALE = 2.5

    # Nuovo formato: size_range "48-96px" → usa il valore minimo per post
    headline_size = None
    body_size_val = None

    display_size_range = (ds_typo.get("display") or {}).get("size_range", "")
    if display_size_range:
        import re
        nums = re.findall(r'\d+', display_size_range)
        if nums:
            headline_size = int(int(nums[0]) * _SCALE)

    body_size_range = (ds_typo.get("body") or {}).get("size_range", "")
    if body_size_range:
        import re
        nums = re.findall(r'\d+', body_size_range)
        if nums:
            body_size_val = int(int(nums[0]) * _SCALE)

    # Fallback vecchio formato
    if not headline_size:
        _hl_raw = (_styles.get("headline", {}).get("sizes") or {}).get(_size_key)
        headline_size = int(_hl_raw * _SCALE) if _hl_raw else None
    if not body_size_val:
        _body_raw = (_styles.get("body", {}).get("sizes") or {}).get(_size_key)
        body_size_val = int(_body_raw * _SCALE) if _body_raw else None

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
    headline_alt = copy_result.get("headline_alt", "")
    whisper = copy_result.get("whisper", "")
    caption = copy_result.get("caption", "")
    hashtags = copy_result.get("hashtags", brief.get("hashtags", []))
    copy_log = copy_result.get("_copy_log", {})
    print(f"   ✓ A6 CopyAgent — '{headline[:50]}'")
    if headline_alt:
        print(f"   ✓ A6 headline_alt — '{headline_alt[:50]}'")
    if whisper:
        print(f"   ✓ A6 whisper — '{whisper[:50]}'")

    # ── A7 ArtDirector ────────────────────────────────────────────────────────
    art_result = art_director.run(brief, headline, caption, scene_description=scene_description)
    layout_variant = art_result.get("layout_variant", ranked_layouts[0] if ranked_layouts else "bottom-text")
    photo_filter_applied = art_result.get("photo_filter_applied", brief.get("photo_filter", {}))
    content_type = art_result.get("content_type", "")
    art_reasoning = art_result.get("reasoning", "")

    # Valida layout contro analisi foto
    layout_overridden = False
    if layout_variant not in ranked_layouts and ranked_layouts:
        print(f"   ⚠ Layout '{layout_variant}' non in lista foto → '{ranked_layouts[0]}'")
        layout_variant = ranked_layouts[0]
        layout_overridden = True
    print(f"   ✓ A7 ArtDirector — layout: {layout_variant}")

    # ── A15 ToneValidator (retry A6 integrato) ────────────────────────────────
    copy_final, tone_result = tone_validator.validate_with_retry(
        headline=headline,
        caption=caption,
        brand_kit_opus=brand_kit_opus,
        copy_agent=copy_agent,
        brief=brief,
    )
    tone_rewritten = copy_final.get("headline", headline) != headline
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
            print(f"   ℹ render_params: font_headline={render_params.get('font_headline_path')}, font_body={render_params.get('font_body_path')}, bg_alpha={render_params.get('bg_overlay_alpha')}, hl_size={render_params.get('headline_size')}")

            # Per frase_susurro e mixed_type, il whisper va come body al renderer
            _WHISPER_LAYOUTS = {"frase_susurro", "mixed_type"}
            render_body = whisper if layout_variant in _WHISPER_LAYOUTS else ""

            img = composite_v2(
                photo_path=photo_path,
                headline=headline,
                photo_filters=photo_filter_applied,
                body=render_body,
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

    # ── Decisioni pipeline (memory layer) ────────────────────────────────────
    pipeline_decisions = {
        "visual_analyst": scene_description or "",
        "photo_analyzer": {
            "ranked_layouts": ranked_layouts,
            "overlay_start_pct": overlay_start_pct,
            "time_of_day": photo_analysis.get("time_of_day", ""),
            "dominant_color": photo_analysis.get("dominant_color", ""),
        },
        "copy_agent": {
            **copy_log,
            "headline_alt": headline_alt,
            "whisper": whisper,
            "ellipsis_used": copy_result.get("ellipsis_used", False),
            "reasoning": copy_result.get("_reasoning", {}),
        },
        "art_director": {
            "layout_chosen": layout_variant,
            "layout_overridden_by_photo": layout_overridden,
            "filters": photo_filter_applied,
            "reasoning": art_reasoning,
        },
        "tone_validator": {
            "passed": tone_result.get("passed"),
            "score": tone_result.get("score"),
            "violations": tone_result.get("violations", []),
            "copy_rewritten": tone_rewritten,
        },
        "brand_compliance": {
            "passed": compliance_result.get("passed"),
            "score": compliance_result.get("score"),
            "checks": compliance_result.get("checks", []),
        },
        "seasonal_variant": {
            "time_hint": brief.get("time_hint", ""),
            "season_label": brief.get("season_label", ""),
            "season_descriptor": brief.get("season_descriptor", ""),
        },
    }

    # ── Persistenza in DB ─────────────────────────────────────────────────────
    plan_slot_id = None
    saved_content_id = None
    if image_url:
        try:
            from tools.content_store import save_generated_post, find_plan_slot_id
            plan_slot_id = find_plan_slot_id(
                client_id=client_id,
                scheduled_date=brief.get("scheduled_date", ""),
                pillar=brief.get("pillar", ""),
                angle=brief.get("angle", ""),
                format=brief.get("format", "Post 1:1"),
            )
            saved = save_generated_post(
                client_id=client_id,
                headline=headline,
                caption=caption,
                pillar=brief.get("pillar", ""),
                format=brief.get("format", "Post 1:1"),
                content_type=content_type,
                layout_variant=layout_variant,
                image_url=image_url,
                plan_slot_id=plan_slot_id,
                brief=brief.get("brief", "") or "",
                hashtags=hashtags,
                pipeline_decisions=pipeline_decisions,
                render_params=render_params if render and not render_error else {},
            )
            if saved:
                saved_content_id = saved.get("content_id")
        except Exception as e:
            print(f"   ⚠ Persistenza DB fallita: {e}")

    return {
        "headline": headline,
        "headline_alt": headline_alt,
        "whisper": whisper,
        "caption": caption,
        "hashtags": hashtags,
        "layout_variant": layout_variant,
        "photo_filter_applied": photo_filter_applied,
        "content_type": content_type,
        "img_b64": img_b64,
        "image_url": image_url,
        "content_id": saved_content_id,
        "plan_slot_id": plan_slot_id,
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
