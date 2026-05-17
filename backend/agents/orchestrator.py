"""
orchestrator.py — A0 Orchestrator v2.

Punto d'ingresso centrale del sistema multi-agente BRAVO.
Inizializza tutti gli agenti, espone metodi per ogni pipeline.
Mantiene compatibilità con v1 (generate_content → ContentDesignerAgent).
"""

from __future__ import annotations

import os
from typing import Optional

from agents.content_designer import ContentDesignerAgent
from agents.editorial_planner import EditorialPlanner
from agents.copy_agent import CopyAgent
from agents.art_director import ArtDirector
from agents.layout_selector import LayoutSelector
from agents.review_interpreter import ReviewInterpreter
from agents.market_intelligence import MarketIntelligence
from tools.tone_validator import ToneValidator
from tools.brand_compliance import check_compliance
from tools.hashtag_selector import select_hashtags
from tools.instagram_publisher import schedule_post, process_due_posts, get_scheduled_posts
from models.content import GenerateContentRequest, GenerateContentResponse


class Orchestrator:
    """
    A0 — Cervello centrale del sistema BRAVO v2.
    Inizializza tutti gli agenti e delega ogni richiesta all'agente corretto.
    """

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata nel file .env")

        # Higgsfield non usa API key (auth account-based via MCP/CLI).
        # Il parametro resta per compat firma v1, ma è None.
        image_gen_key = None

        # ── v1 compat ──────────────────────────────────────────────────────────
        self.content_designer = ContentDesignerAgent(
            api_key=api_key,
            image_gen_key=image_gen_key,
        )

        # ── v2 agents ──────────────────────────────────────────────────────────
        self.editorial_planner = EditorialPlanner()
        self.copy_agent = CopyAgent()
        self.art_director = ArtDirector()
        self.layout_selector = LayoutSelector()       # Fase 1C — propone 3 archetipi
        self.review_interpreter = ReviewInterpreter()
        self.tone_validator = ToneValidator()         # con rank_proposals (Critic)
        self.market_intelligence = MarketIntelligence()

        print("✅ Orchestrator v2 inizializzato (v1 compat + 7 agenti v2 incl. studio)")

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _get_brand_kit_opus(self, client_id: str) -> dict:
        from tools.supabase_client import get_client
        sb = get_client()
        if not sb:
            return {}
        resp = (
            sb.table("client_brand")
            .select("brand_kit_opus")
            .eq("client_id", client_id)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0].get("brand_kit_opus") or {}
        return {}

    # ── v1 compat ──────────────────────────────────────────────────────────────

    def generate_content(self, request: GenerateContentRequest) -> GenerateContentResponse:
        """Genera contenuti social — compatibilità v1 (ContentDesignerAgent)."""
        return self.content_designer.run(request)

    # ── v2 — Pipeline A: Pianificazione mensile ───────────────────────────────

    def run_editorial_plan(
        self,
        client_id: str,
        month: Optional[str] = None,
        task_id: Optional[str] = None,
        force: bool = False,
    ) -> dict:
        """A1 — Produce il piano mensile (8 feed + 12 stories)."""
        return self.editorial_planner.run(
            client_id=client_id,
            month=month,
            task_id=task_id,
            force=force,
        )

    # ── v2 — Pipeline B: Generazione singolo post ─────────────────────────────

    def run_post_pipeline(
        self,
        client_id: str,
        slot: dict,
        photo_path: str,
        user_note: str = "",
        seasonal_context: Optional[dict] = None,
        scene_description: str = "",
    ) -> dict:
        """
        A5→A6→A7→A8→A11→A14→A15 — Pipeline completa post singolo.

        slot deve contenere: pillar, angle, persona, scheduled_date
        Campi opzionali: format, platform, brief
        """
        from tools.pipeline_v2 import run_post_pipeline
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return run_post_pipeline(
            client_id=client_id,
            slot=slot,
            photo_path=photo_path,
            brand_kit_opus=brand_kit_opus,
            copy_agent=self.copy_agent,
            art_director=self.art_director,
            tone_validator=self.tone_validator,
            user_note=user_note,
            seasonal_context=seasonal_context,
            scene_description=scene_description,
        )

    # ── v2 Studio · Fase 1C — propose + finalize (3 finalisti) ───────────────

    def propose_post(
        self,
        client_id: str,
        slot: dict,
        photo_path: Optional[str] = None,
        user_note: str = "",
        seasonal_context: Optional[dict] = None,
        scene_description: str = "",
    ) -> dict:
        """
        Genera 3 finalisti editoriali per un post (3 archetipi diversi + 3 copy + ranking del Critic).
        NON renderizza. La scelta finale spetta a Bravo nell'app.
        """
        from tools.pipeline_v2_studio import propose_post
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return propose_post(
            client_id=client_id,
            slot=slot,
            photo_path=photo_path,
            brand_kit_opus=brand_kit_opus,
            copy_agent=self.copy_agent,
            layout_selector=self.layout_selector,
            tone_validator=self.tone_validator,
            user_note=user_note,
            seasonal_context=seasonal_context,
            scene_description=scene_description,
        )

    def finalize_post(
        self,
        content_id: str,
        photo_path: Optional[str] = None,
        scene_description: str = "",
    ) -> dict:
        """
        Bravo ha scelto 1 dei 3 finalisti: art director + renderer + decision log.
        """
        from tools.pipeline_v2_studio import finalize_post
        # client_id e brand kit si ricavano dal record
        from tools.supabase_client import get_client
        sb = get_client()
        if sb is None:
            raise RuntimeError("Supabase non disponibile")
        resp = sb.table("generated_content").select("client_id").eq("content_id", content_id).limit(1).execute()
        if not resp.data:
            raise ValueError(f"content_id {content_id} non trovato")
        client_id = resp.data[0].get("client_id", "")
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return finalize_post(
            content_id=content_id,
            art_director=self.art_director,
            brand_kit_opus=brand_kit_opus,
            photo_path=photo_path,
            scene_description=scene_description,
        )

    # ── D · Gate Designer (additivo) ─────────────────────────────────────────

    def propose_layouts(
        self,
        content_id: str,
        photo_path: Optional[str] = None,
        scene_description: str = "",
    ) -> dict:
        """3 layout renderizzati del finalista scelto (Designer · gate umano)."""
        from tools.pipeline_v2_studio import propose_layouts
        from tools.supabase_client import get_client
        sb = get_client()
        if sb is None:
            raise RuntimeError("Supabase non disponibile")
        resp = sb.table("generated_content").select("client_id").eq("content_id", content_id).limit(1).execute()
        if not resp.data:
            raise ValueError(f"content_id {content_id} non trovato")
        client_id = resp.data[0].get("client_id", "")
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return propose_layouts(
            content_id=content_id,
            art_director=self.art_director,
            brand_kit_opus=brand_kit_opus,
            photo_path=photo_path,
            scene_description=scene_description,
        )

    def finalize_layout(
        self,
        content_id: str,
        proposal_set_id: str = "",
        image_url: str = "",
    ) -> dict:
        """L'umano ha scelto 1 layout: persiste (additivo)."""
        from tools.pipeline_v2_studio import finalize_layout
        return finalize_layout(
            content_id=content_id,
            proposal_set_id=proposal_set_id,
            image_url=image_url,
        )

    # ── v2 — Pipeline D: Recensioni → Contenuto "Voz Real" ───────────────────

    def interpret_review(
        self,
        review_text: str,
        client_id: str,
        reviewer_name: Optional[str] = None,
        platform: str = "Google",
    ) -> dict:
        """A9 — Trasforma una recensione in copy editorial in brand voice."""
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return self.review_interpreter.run(
            review_text=review_text,
            brand_kit_opus=brand_kit_opus,
            reviewer_name=reviewer_name,
            platform=platform,
        )

    # ── v2 — Validazione standalone ───────────────────────────────────────────

    def validate_tone(
        self,
        headline: str,
        caption: str,
        client_id: str,
    ) -> dict:
        """A15 — Valida il tono del copy contro il brand kit del cliente."""
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return self.tone_validator.validate(headline, caption, brand_kit_opus)

    def check_compliance(
        self,
        headline: str,
        caption: str,
        client_id: str,
        format_type: str = "feed_post",
    ) -> dict:
        """A14 — Check di conformità brand (pass/fail)."""
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return check_compliance(headline, caption, brand_kit_opus, format_type)

    def select_hashtags(
        self,
        client_id: str,
        season_level: Optional[str] = None,
        pillar: Optional[str] = None,
        max_count: int = 2,
    ) -> list:
        """A12 — Seleziona hashtag dal brand kit del cliente."""
        brand_kit_opus = self._get_brand_kit_opus(client_id)
        return select_hashtags(
            brand_kit_opus,
            season_level=season_level,
            pillar=pillar,
            max_count=max_count,
        )

    # ── v2 — A4 Market Intelligence ───────────────────────────────────────────

    def run_market_intelligence(
        self,
        client_id: str,
        task_id: Optional[str] = None,
        force: bool = False,
    ) -> dict:
        """A4 — Ricerca di mercato per settore (riuso cache 30 giorni)."""
        return self.market_intelligence.run(
            client_id=client_id,
            task_id=task_id,
            force=force,
        )

    # ── v2 — A13 Publishing Scheduler ─────────────────────────────────────────

    def schedule_post(
        self,
        client_id: str,
        content_id: str,
        image_url: str,
        caption: str,
        scheduled_for=None,
        slot_index: int = 0,
    ) -> dict:
        """A13 — Aggiunge un post alla coda di pubblicazione con orario ottimale."""
        return schedule_post(
            client_id=client_id,
            content_id=content_id,
            image_url=image_url,
            caption=caption,
            scheduled_for=scheduled_for,
            slot_index=slot_index,
        )

    def process_due_posts(self, dry_run: bool = False) -> list:
        """A13 — Pubblica tutti i post in scadenza dalla coda."""
        return process_due_posts(dry_run=dry_run)

    def get_scheduled_posts(self, client_id: str, status: str = "pending") -> list:
        """A13 — Legge la coda di pubblicazione per un cliente."""
        return get_scheduled_posts(client_id=client_id, status=status)
