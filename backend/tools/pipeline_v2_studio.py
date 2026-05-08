"""
pipeline_v2_studio.py — Pipeline B Studio · Fase 1C.

Sostituisce il flusso lineare di pipeline_v2.py con un flusso "studio":

    propose_post(...)   → genera 3 finalisti (archetipi diversi, copy adattati)
                          NON renderizza nulla.
                          I 3 finalisti vivono come righe in generated_content
                          con stesso proposal_set_id, status='proposal'.

    finalize_post(...)  → quando Bravo sceglie nell'app:
                          • marca la proposta scelta come is_selected
                          • lancia ArtDirector + Renderer SOLO sulla scelta
                          • aggiorna lo slot piano + decision log

Strategia:
1. Riusiamo gli stessi step di analisi foto + brief composer di pipeline_v2
2. Layout Selector propone 3 archetipi DIVERSI consultando memoria rotazione
3. Copy Agent gira 3 volte, una per archetipo (cambiano i limiti di parole)
4. ToneValidator.rank_proposals annota i 3 con voice_score + repetition_risk + comment
5. Salviamo 3 righe in generated_content con stesso proposal_set_id (status='proposal')
6. Salviamo le decisioni in agent_logs (selected=False per tutte e 3)
7. Ritorniamo i 3 al frontend
"""

from __future__ import annotations

import base64
import io
import uuid
from pathlib import Path
from typing import Optional


# =============================================================================
# Helpers privati
# =============================================================================

def _img_to_b64(pil_image, quality: int = 84) -> str:
    buf = io.BytesIO()
    pil_image.convert("RGB").save(buf, "JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()


# =============================================================================
# STEP 1 · propose_post — genera 3 finalisti
# =============================================================================

def propose_post(
    *,
    client_id: str,
    slot: dict,
    photo_path: str,
    brand_kit_opus: dict,
    copy_agent,
    layout_selector,
    tone_validator,
    user_note: str = "",
    seasonal_context: Optional[dict] = None,
    scene_description: str = "",
) -> dict:
    """
    Genera 3 proposte editoriali per un post. NON renderizza.

    Ritorna:
    {
        "proposal_set_id": "uuid",
        "proposals": [
            {
                "content_id": "uuid",        # già salvato in generated_content (status=proposal)
                "archetype": "mixed_type",
                "headline": "...",
                "headline_alt": "...",
                "whisper": "...",
                "caption": "...",
                "hashtags": [...],
                "position_hint": "...",
                "color_hint": "warm",
                "critic_voice_score": 0.9,
                "critic_repetition_risk": "low",
                "critic_comment": "...",
                "critic_rank": 1,
            }, ... × 3
        ],
        "brief_meta": {pillar, angle, persona, scheduled_date, format},
        "rotation_used": {...}  # cosa ha letto dalla memoria
    }
    """
    from agents.brief_composer import compose
    from tools.photo_analyzer import analyze_photo_full
    from tools.decision_log import get_recent_choices, write_decision
    from tools.content_store import find_plan_slot_id

    pillar = slot.get("pillar", "")
    angle = slot.get("angle", "")
    persona = slot.get("persona", "")
    print(f"🎬 Pipeline Studio · {pillar} × {angle} × {persona}")

    # ── A5 BriefComposer ──────────────────────────────────────────────────────
    brief = compose(slot, brand_kit_opus, seasonal_context)
    print("   ✓ BriefComposer")

    # ── A8 PhotoAnalyzer ──────────────────────────────────────────────────────
    photo_analysis = analyze_photo_full(photo_path)
    overlay_start_pct = photo_analysis["overlay_start_pct"]
    print(f"   ✓ PhotoAnalyzer — overlay at {int(overlay_start_pct*100)}%")

    # ── Memoria rotazione ─────────────────────────────────────────────────────
    recent_choices = get_recent_choices(client_id, days=14)
    print(f"   ✓ Rotation memory — {recent_choices.get('decisions_count', 0)} decisioni recenti")

    # ── Layout Selector → 3 archetipi diversi ────────────────────────────────
    layout_result = layout_selector.run(
        brief=brief,
        scene_description=scene_description,
        recent_choices=recent_choices,
    )
    archetype_proposals = layout_result.get("proposals", [])
    if len(archetype_proposals) < 3:
        print(f"   ⚠ Layout Selector ha proposto solo {len(archetype_proposals)} archetipi")
    print(f"   ✓ Layout Selector — archetipi: {[p['archetype'] for p in archetype_proposals]}")

    # ── Copy Agent × 3 (uno per archetipo) ───────────────────────────────────
    extra_ctx = (
        f"\n\nANÁLISIS DE FOTO: zona oscura desde {int(overlay_start_pct*100)}% altura."
    )
    if scene_description:
        extra_ctx += f"\nDESCRIPCIÓN ESCENA: {scene_description}"
    if user_note:
        extra_ctx += f"\n\nNOTA ADICIONAL: {user_note}"

    proposal_set_id = str(uuid.uuid4())
    proposals: list[dict] = []

    for arc_proposal in archetype_proposals:
        archetype = arc_proposal.get("archetype", "")
        if not archetype:
            continue
        try:
            copy = copy_agent.run(
                brief=brief,
                extra_context=extra_ctx,
                user_note=user_note,
                archetype=archetype,
            )
        except Exception as e:
            print(f"   ⚠ Copy Agent fallito per {archetype}: {e}")
            continue

        proposals.append({
            "archetype":      archetype,
            "headline":       copy.get("headline", ""),
            "headline_alt":   copy.get("headline_alt", ""),
            "whisper":        copy.get("whisper", ""),
            "caption":        copy.get("caption", ""),
            "hashtags":       copy.get("hashtags", []) or brief.get("hashtags", []),
            "ellipsis_used":  copy.get("ellipsis_used", False),
            "position_hint":  arc_proposal.get("position_hint", ""),
            "color_hint":     arc_proposal.get("color_hint", "warm"),
            "_copy_reasoning": copy.get("_reasoning", {}),
            "_copy_log":       copy.get("_copy_log", {}),
        })
    print(f"   ✓ Copy Agent × {len(proposals)} (varianti per archetipo)")

    # ── Critic: rank_proposals (1 chiamata Haiku) ────────────────────────────
    if proposals:
        ranked = tone_validator.rank_proposals(
            proposals=proposals,
            brand_kit_opus=brand_kit_opus,
            recent_choices=recent_choices,
        )
    else:
        ranked = []
    print(f"   ✓ Critic — ranked {len(ranked)} proposte")

    # ── Persistenza: 3 righe in generated_content (status='proposal') ────────
    content_format = slot.get("format", "Post 1:1")
    plan_slot_id = find_plan_slot_id(
        client_id=client_id,
        scheduled_date=brief.get("scheduled_date", ""),
        pillar=brief.get("pillar", ""),
        angle=brief.get("angle", ""),
        format=content_format,
    )

    saved_proposals: list[dict] = []
    for p in ranked:
        cid = _save_proposal_row(
            client_id=client_id,
            proposal_set_id=proposal_set_id,
            archetype=p["archetype"],
            headline=p["headline"],
            caption=p["caption"],
            hashtags=p["hashtags"],
            pillar=brief.get("pillar", ""),
            format=content_format,
            plan_slot_id=plan_slot_id,
            critic_score=p.get("critic_voice_score", 0.5),
            critic_risk=p.get("critic_repetition_risk", "low"),
            critic_comment=p.get("critic_comment", ""),
            critic_rank=p.get("critic_rank", 999),
            position_hint=p.get("position_hint", ""),
            color_hint=p.get("color_hint", "warm"),
            whisper=p.get("whisper", ""),
            headline_alt=p.get("headline_alt", ""),
            brief_text=brief.get("brief", "") or "",
        )
        if cid:
            p["content_id"] = cid
            # Decision log: layout_selector + copy_agent per QUESTA proposta
            try:
                write_decision(
                    agent_name="layout_selector",
                    client_id=client_id,
                    decision={"archetype": p["archetype"],
                              "position_hint": p.get("position_hint", ""),
                              "color_hint": p.get("color_hint", "warm")},
                    reasoning=layout_result.get("_reasoning", {}),
                    archetype=p["archetype"],
                    proposal_set_id=proposal_set_id,
                    content_id=cid,
                    selected=False,
                )
                copy_reasoning = p.get("_copy_reasoning") or {}
                write_decision(
                    agent_name="copy_agent",
                    client_id=client_id,
                    decision={"headline": p["headline"], "headline_alt": p["headline_alt"],
                              "whisper": p["whisper"], "caption": p["caption"],
                              "ellipsis_used": p.get("ellipsis_used", False)},
                    reasoning=copy_reasoning,
                    archetype=p["archetype"],
                    palabra_clave=copy_reasoning.get("palabra_clave", ""),
                    proposal_set_id=proposal_set_id,
                    content_id=cid,
                    selected=False,
                )
                write_decision(
                    agent_name="critic",
                    client_id=client_id,
                    decision={"voice_score": p.get("critic_voice_score"),
                              "repetition_risk": p.get("critic_repetition_risk"),
                              "rank": p.get("critic_rank"),
                              "comment": p.get("critic_comment")},
                    archetype=p["archetype"],
                    proposal_set_id=proposal_set_id,
                    content_id=cid,
                    selected=False,
                )
            except Exception as e:
                print(f"   ⚠ decision log per {cid[:8]}: {e}")

            # Pulizia campi privati prima di restituire
            saved_proposals.append({
                k: v for k, v in p.items()
                if not k.startswith("_")
            })
    print(f"   ✓ {len(saved_proposals)} proposte salvate · proposal_set={proposal_set_id[:8]}")

    return {
        "proposal_set_id": proposal_set_id,
        "proposals":       saved_proposals,
        "brief_meta": {
            "pillar":         brief["pillar"],
            "angle":          brief["angle"],
            "persona":        brief["persona"],
            "scheduled_date": brief.get("scheduled_date", ""),
            "format":         content_format,
        },
        "rotation_used": recent_choices,
    }


def _save_proposal_row(
    *,
    client_id: str,
    proposal_set_id: str,
    archetype: str,
    headline: str,
    caption: str,
    hashtags: list,
    pillar: str,
    format: str,
    plan_slot_id: Optional[str],
    critic_score: float,
    critic_risk: str,
    critic_comment: str,
    critic_rank: int,
    position_hint: str,
    color_hint: str,
    whisper: str,
    headline_alt: str,
    brief_text: str,
) -> Optional[str]:
    """
    Inserisce una riga in generated_content con status='proposal'.
    Ritorna il content_id (uuid string) o None se fallisce.
    """
    from tools.supabase_client import get_client
    sb = get_client()
    if sb is None:
        return None

    content_id = str(uuid.uuid4())
    pipeline_decisions = {
        "critic": {
            "voice_score":     critic_score,
            "repetition_risk": critic_risk,
            "comment":         critic_comment,
            "rank":            critic_rank,
        },
        "layout_selector": {
            "position_hint": position_hint,
            "color_hint":    color_hint,
        },
        "copy_agent": {
            "headline_alt": headline_alt,
            "whisper":      whisper,
        },
    }

    row = {
        "content_id":      content_id,
        "client_id":       client_id,
        "brief":           brief_text,
        "platform":        "instagram",
        "pillar":          pillar,
        "format":          format,
        "headline":        headline,
        "caption":         caption,
        "layout_variant":  archetype,   # riusiamo questa colonna per l'archetipo
        "archetype":       archetype,
        "proposal_set_id": proposal_set_id,
        "agent_notes":     ("hashtags: " + ", ".join(hashtags)) if hashtags else "",
        "generated_by":    "pipeline_studio",
        "status":          "proposal",
        "plan_id":         plan_slot_id,
        "pipeline_decisions": pipeline_decisions,
    }

    try:
        resp = sb.table("generated_content").insert(row).execute()
        return content_id if resp.data else None
    except Exception as e:
        print(f"   ⚠ Insert proposal fallito: {e}")
        return None


# =============================================================================
# STEP 2 · finalize_post — Bravo ha scelto, renderizza solo la scelta
# =============================================================================

def finalize_post(
    *,
    content_id: str,
    art_director,
    brand_kit_opus: dict,
    photo_path: str,
    scene_description: str = "",
) -> dict:
    """
    Quando Bravo sceglie 1 dei 3 finalisti nell'app:
      1. Recupera la riga da generated_content
      2. ArtDirector modula i parametri liberi (filtri, posizione fine)
      3. Renderer monta il PNG
      4. Aggiorna la riga con image_url + status='draft'
      5. Marca selected=true nelle decisioni di agent_logs (e false sugli altri 2)
      6. Aggiorna lo slot del piano editoriale (se collegato)

    Ritorna:
    {
      "content_id": "uuid",
      "image_url":  "https://...",
      "img_b64":    "...",
      "headline":   "...",
      "caption":    "...",
      "archetype":  "...",
      "render_error": null | "..."
    }
    """
    from tools.supabase_client import get_client
    from tools.decision_log import mark_selected
    from tools.pipeline import upload_image_to_storage

    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")

    # 1) Recupero la proposta scelta
    resp = sb.table("generated_content").select("*").eq("content_id", content_id).limit(1).execute()
    if not resp.data:
        raise ValueError(f"content_id {content_id} non trovato")
    row = resp.data[0]
    proposal_set_id = row.get("proposal_set_id")
    archetype = row.get("archetype") or row.get("layout_variant", "")
    headline = row.get("headline", "")
    caption  = row.get("caption", "")
    client_id = row.get("client_id", "")
    plan_slot_id = row.get("plan_id")
    pipe_dec = row.get("pipeline_decisions") or {}
    layout_hints = pipe_dec.get("layout_selector", {})
    copy_hints = pipe_dec.get("copy_agent", {})

    # 2) ArtDirector — modulazione parametri foto + posizione fine
    try:
        from agents.brief_composer import compose
        slot = {
            "pillar": row.get("pillar", ""),
            "angle":  "",  # non strettamente necessario per la modulazione
            "persona": "",
            "scheduled_date": "",
            "format": row.get("format", "Post 1:1"),
        }
        # ArtDirector legacy ha ancora bisogno di un brief minimo
        brief = compose(slot, brand_kit_opus)
        art_result = art_director.run(
            brief=brief,
            headline=headline,
            caption=caption,
            scene_description=scene_description,
        )
        photo_filter_applied = art_result.get("photo_filter_applied", brief.get("photo_filter", {}))
    except Exception as e:
        print(f"   ⚠ ArtDirector fallito: {e}")
        photo_filter_applied = {}

    # 3) Renderer
    img_b64 = ""
    image_url = ""
    render_error = None
    try:
        from tools.renderer import composite_v2
        from tools.brand_store import get_brand_kit
        from tools.pipeline_v2 import _extract_render_params

        brand_kit_assets = get_brand_kit(client_id) or {}
        logo_b64 = brand_kit_assets.get("logo_b64")
        content_format = row.get("format", "Post 1:1")
        render_params = _extract_render_params(brand_kit_opus, content_format)

        # Whisper come body per archetipi che lo usano
        whisper = copy_hints.get("whisper", "") or ""
        _WHISPER_LAYOUTS = {"frase_susurro", "mixed_type"}
        body = whisper if archetype in _WHISPER_LAYOUTS else ""

        img = composite_v2(
            photo_path=photo_path,
            headline=headline,
            photo_filters=photo_filter_applied,
            body=body,
            layout_variant=archetype,
            logo_position="br",
            content_format=content_format,
            label="",
            side="left",
            logo_b64=logo_b64,
            overlay_start_pct=0.50,
            **render_params,
        )
        img_b64 = _img_to_b64(img)
        image_url = upload_image_to_storage(img, client_id, 0) or ""
        print(f"   ✓ Renderer · {archetype} · uploaded")
    except Exception as e:
        import traceback
        render_error = traceback.format_exc()
        print(f"   ⚠ Renderer fallito: {e}")

    # 4) Update riga a status='draft' + image_url
    try:
        sb.table("generated_content").update({
            "media_id": image_url,
            "status":   "draft",  # passato dal proposal a draft (pronto per approvazione)
        }).eq("content_id", content_id).execute()
    except Exception as e:
        print(f"   ⚠ Update generated_content fallito: {e}")

    # 5) Marca selected=true sulle decisioni della scelta
    if proposal_set_id:
        try:
            updated = mark_selected(
                proposal_set_id=str(proposal_set_id),
                selected_content_id=content_id,
            )
            print(f"   ✓ {updated} decisioni marcate selected=true")
        except Exception as e:
            print(f"   ⚠ mark_selected fallito: {e}")

    # 6) Update lo slot piano editoriale
    if plan_slot_id:
        try:
            sb.table("editorial_plans").update({
                "status":     "generated",
                "content_id": content_id,
            }).eq("id", plan_slot_id).execute()
        except Exception as e:
            print(f"   ⚠ editorial_plans update fallito: {e}")

    return {
        "content_id":  content_id,
        "image_url":   image_url,
        "img_b64":     img_b64,
        "headline":    headline,
        "caption":     caption,
        "archetype":   archetype,
        **({"render_error": render_error} if render_error else {}),
    }
