"""
editorial_planner.py — A1 Editorial Planner (Sonnet).

Produce il piano mensile: 8 post feed + 12 stories.
Legge pillar_identity, angle_identity, scope, seasonality dal brand_kit_opus.
Rispetta: % pillar, frequency cap angoli, bilanciamento persona A/B.

Sostituisce strategist.py (piano settimanale 3 post fissi Lun/Mer/Ven).
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import re

import anthropic

from tools.briefing_store import get_briefing
from tools.editorial_store import get_recent_generated, get_recent_plans, save_editorial_plan
from tools.supabase_client import get_client
from tools.task_store import claim_pending_task, complete_task, fail_task
from tools.seasonality import get_seasonal_context
from tools.persona_router import route_plan


_SYSTEM = """Eres el Editorial Planner de Studio Bravo. Tu trabajo es crear el plan editorial mensual de un hotel o marca de hospitalidad en Instagram.

PRODUCIRÁS: exactamente 8 posts de feed + 12 stories para el mes indicado.

REGLAS OBLIGATORIAS:
1. PILARES: distribuye los posts respetando los % del brand kit (ej. 30% = ~2-3 posts de ese pilar)
2. ÁNGULOS: respeta el frequency cap de cada ángulo (ej. "2x/mes" = máximo 2 veces al mes)
3. PERSONAS: alterna A/B en los posts de feed — no más de 2 consecutivos de la misma persona
4. HISTORIAS: más ligeras, más frecuentes, pueden repetir pilar pero varía el ángulo
5. TEMPORADA: si hay eventos estacionales, asígnalos a los posts de esa semana
6. VARIEDAD: no repitas el mismo ángulo en posts consecutivos de feed

OUTPUT — JSON exacto:
{
  "month": "YYYY-MM",
  "reasoning": "2-3 líneas explicando la distribución elegida",
  "feed_posts": [
    {
      "slot": 1,
      "week": 1,
      "pillar": "nombre exacto del pilar",
      "angle": "nombre exacto del ángulo",
      "persona": "nombre exacto de la persona",
      "format": "Post 1:1",
      "platform": "instagram",
      "scheduled_date": "YYYY-MM-DD",
      "brief": "brief para el Copy Agent (2-4 líneas: qué contar, qué mostrar, tono)"
    }
  ],
  "stories": [
    {
      "slot": 1,
      "week": 1,
      "pillar": "nombre exacto del pilar",
      "angle": "nombre exacto del ángulo",
      "format": "Story 9:16",
      "platform": "instagram",
      "scheduled_date": "YYYY-MM-DD",
      "interactive_element": "poll|quiz|slider|countdown|none",
      "brief": "brief breve (1-2 líneas)"
    }
  ]
}"""


def _build_angle_caps(brand_kit_opus: dict) -> dict[str, int]:
    """Estrae frequency cap per angolo dal brand_kit_opus."""
    caps: dict[str, int] = {}
    ds = brand_kit_opus.get("design_system", {})
    angles = ds.get("angle_identity", []) or brand_kit_opus.get("angle_identity", [])

    for a in angles:
        name = a.get("name", "")
        freq = a.get("frequency", "")
        if not name or not freq:
            continue
        import re
        m = re.search(r"(\d+)\s*[x×veces/]", freq.lower())
        if m:
            caps[name] = int(m.group(1))
        elif "quincen" in freq.lower():
            caps[name] = 2
        elif "seman" in freq.lower():
            caps[name] = 4
        elif "mes" in freq.lower() or "mensual" in freq.lower():
            caps[name] = 1

    return caps


def _format_brand_context(brand_kit_opus: dict, season: dict) -> str:
    """Formatta il contesto brand per il prompt del Planner."""
    ds = brand_kit_opus.get("design_system", {})
    pillar_id = ds.get("pillar_identity", []) or brand_kit_opus.get("pillar_identity", [])
    angle_id = ds.get("angle_identity", []) or brand_kit_opus.get("angle_identity", [])
    personas = brand_kit_opus.get("personas", [])
    hashtags = brand_kit_opus.get("hashtags", []) or brand_kit_opus.get("key_messages", {}).get("hashtags", [])

    pillar_lines = "\n".join(
        f"  - {p.get('name')} ({p.get('percentage', 0)}%): {p.get('description', '')[:100]}"
        for p in pillar_id
    )

    angle_lines = "\n".join(
        f"  - {a.get('name')}: {a.get('frequency', '')} | energy: {a.get('energy', '')} | headline_style: {a.get('headline_style', '')[:80]}"
        for a in angle_id
    )

    persona_lines = "\n".join(
        f"  - {p.get('name')}: {p.get('profile', '')[:100]}"
        for p in personas
    )

    season_block = ""
    if season:
        events_str = " | ".join(e.get("note", "")[:60] for e in season.get("events", []))
        season_block = f"""
TEMPORADA: {season.get('month')} — nivel {season.get('season_level', 'media').upper()}
Mood: {season.get('mood', '')}
{f'Eventos: {events_str}' if events_str else ''}"""

    return f"""PILARES DEL BRAND:
{pillar_lines}

ÁNGULOS NARRATIVOS:
{angle_lines}

PERSONAS:
{persona_lines}

HASHTAGS OFICIALES: {' '.join(hashtags)}
{season_block}"""


class EditorialPlanner:
    """A1 — Produce il piano mensile 8 feed + 12 stories."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-6"

    def _get_client_data(self, client_id: str) -> Optional[dict]:
        sb = get_client()
        if not sb:
            return None
        resp = sb.table("clients").select("*").eq("id", client_id).limit(1).execute()
        return resp.data[0] if resp.data else None

    def _get_brand_kit_opus(self, client_id: str) -> dict:
        sb = get_client()
        if not sb:
            return {}
        resp = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_id).limit(1).execute()
        if resp.data:
            return resp.data[0].get("brand_kit_opus") or {}
        return {}

    def _get_latest_metrics_report(self, client_id: str) -> Optional[dict]:
        sb = get_client()
        if not sb:
            return None
        resp = (
            sb.table("metrics_reports")
            .select("report,posts_analyzed,generated_at")
            .eq("client_id", client_id)
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    def _get_latest_market_research(self, sector: str) -> Optional[dict]:
        sb = get_client()
        if not sb:
            return None
        now = datetime.now(timezone.utc).isoformat()
        resp = (
            sb.table("market_research")
            .select("report,keywords,trends,created_at")
            .eq("sector", sector)
            .gt("valid_until", now)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    def run(
        self,
        client_id: str,
        month: Optional[str] = None,
        task_id: Optional[str] = None,
        force: bool = False,
    ) -> dict:
        """
        Produce il piano mensile (8 feed + 12 stories).
        month: formato YYYY-MM (default: mese corrente).
        """
        if not month:
            today = date.today()
            month = today.strftime("%Y-%m")

        year, month_num = int(month.split("-")[0]), int(month.split("-")[1])

        client = self._get_client_data(client_id)
        if not client:
            raise ValueError(f"Cliente {client_id} non trovato")

        client_name = client.get("name", "Cliente")
        sector = client.get("sector", "")

        brand_kit_opus = self._get_brand_kit_opus(client_id)
        if not brand_kit_opus:
            raise ValueError(f"Brand kit non trovato per {client_name}")

        scope = brand_kit_opus.get("scope", {})
        n_posts = scope.get("feed_posts_per_month", 8)
        n_stories = scope.get("stories_per_month", 12)

        season = get_seasonal_context(brand_kit_opus, month_num=month_num)
        angle_caps = _build_angle_caps(brand_kit_opus)

        briefing_data = get_briefing(client_id)
        briefing_text = (briefing_data.get("briefing_text") or "") if briefing_data else ""
        if len(briefing_text) > 3000:
            briefing_text = briefing_text[:3000] + "\n[...briefing troncato per brevità]"

        metrics = self._get_latest_metrics_report(client_id) or {}
        market = self._get_latest_market_research(sector) or {}

        recent_feed = get_recent_plans(client_id, days=60)
        recent_generated = get_recent_plans(client_id, days=60)

        brand_context = _format_brand_context(brand_kit_opus, season)

        caps_block = "\n".join(
            f"  - {name}: máx {cap} veces/mes" for name, cap in angle_caps.items()
        ) if angle_caps else "  (sin caps definidos)"

        metrics_summary = ""
        if metrics.get("report"):
            r = metrics["report"]
            metrics_summary = f"Pilar top: {r.get('pilar_top', 'N/D')} | Tendencia: {r.get('tendencia', 'N/D')}"

        user_msg = f"""CLIENTE: {client_name}
SECTOR: {sector}
MES A PLANIFICAR: {month} ({season.get('month')})
PUBLICACIONES: {n_posts} posts de feed + {n_stories} stories

{brand_context}

FREQUENCY CAPS POR ÁNGULO:
{caps_block}

MÉTRICAS RECIENTES: {metrics_summary or '(no disponible)'}
TENDENCIAS DE MERCADO: {', '.join((market.get('trends') or {}).get('principali', [])[:3])}

HISTORIAL RECIENTE (últimas 8 semanas — evitar repeticiones):
{json.dumps([{'pillar': r.get('pillar'), 'angle': r.get('angle')} for r in (recent_feed or [])[-12:]], ensure_ascii=False)}

BRIEFING DEL CLIENTE:
{briefing_text or '(no disponible)'}

Produce el plan mensual para {month} con {n_posts} posts de feed y {n_stories} stories."""

        print(f"📅 Editorial Planner al lavoro — piano {month} per {client_name} ({n_posts} feed + {n_stories} stories)...")

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=8000,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = response.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw) if "```" in raw else raw
        raw = re.sub(r"\s*```$", "", raw) if "```" in raw else raw
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        try:
            plan = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Piano JSON non valido: {e}. Inizio: {raw[:200]}")

        feed_posts = plan.get("feed_posts", [])
        stories = plan.get("stories", [])

        if not feed_posts:
            raise ValueError("Il Planner non ha prodotto posts feed")

        slotted_feed = route_plan(feed_posts, brand_kit_opus)

        saved_feed = save_editorial_plan(
            client_id=client_id,
            week_start=f"{month}-01",
            posts=slotted_feed,
            task_id=task_id,
        )
        saved_stories = save_editorial_plan(
            client_id=client_id,
            week_start=f"{month}-01",
            posts=[{**s, "pillar": s.get("pillar", ""), "brief": s.get("brief", ""), "format": "Story 9:16"} for s in stories],
            task_id=task_id,
        )

        print(f"✅ Piano mensile salvato: {len(saved_feed)} feed + {len(saved_stories)} stories per {month}")

        return {
            "month": month,
            "client": client_name,
            "feed_posts_count": len(saved_feed),
            "stories_count": len(saved_stories),
            "reasoning": plan.get("reasoning", ""),
            "season": season.get("season_level"),
            "feed_posts": [
                {"slot": p.get("slot"), "pillar": p.get("pillar"), "angle": p.get("angle"), "persona": p.get("persona")}
                for p in slotted_feed
            ],
        }

    def run_from_queue(self) -> bool:
        """Worker loop: prende il primo task pending e lo esegue."""
        task = claim_pending_task("editorial_planner")
        if not task:
            return False

        task_id = task["id"]
        client_id = task.get("client_id")
        payload = task.get("payload", {})

        try:
            result = self.run(
                client_id=client_id,
                month=payload.get("month"),
                task_id=task_id,
                force=payload.get("force", False),
            )
            complete_task(task_id, result)
            return True
        except Exception as e:
            fail_task(task_id, str(e))
            print(f"❌ Task editorial_planner {task_id} fallito: {e}")
            return False
