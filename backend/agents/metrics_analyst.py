"""
Metrics Analyst Agent — Analista de Métricas BRAVO.

Lee las métricas de los posts publicados (likes, reach, saves, comments por pillar
y plataforma), el brand kit del cliente y los posts recientes. Produce un informe
narrativo con:
  - Resumen ejecutivo del período
  - Qué está funcionando (pillar, formato, día)
  - Qué mejorar
  - 3-5 ideas concretas para Studio Bravo

Ejecutado bajo demanda desde la tab Métricas del cliente.
"""

import json
import os
from datetime import date, timedelta
from typing import Optional

import anthropic

from tools.briefing_store import get_briefing
from tools.supabase_client import get_client

SYSTEM_PROMPT = """Eres el Analista de Métricas de BRAVO!COMUNICA, una agencia de marketing especializada en social media para empresas del sector agrícola.

Tu trabajo es leer los datos de rendimiento de los posts del cliente y producir un informe claro, accionable y honesto para el equipo creativo de Studio Bravo.

CÓMO LEER LOS DATOS:
- Compara pilares: ¿TECNOLOGIA supera a PRODUCTO en reach? ¿Por qué podría ser?
- Compara formatos: reels vs carruseles vs stories
- Busca patrones temporales: ¿hay posts que rompen la media? ¿por qué?
- Conecta con el brand kit: si un pilar tiene bajo engagement pero es importante para la marca, no lo descartes — propón mejorarlo
- Sé honesto: si los datos son escasos o poco representativos, dilo

LAS IDEAS PARA STUDIO BRAVO deben ser:
- Concretas y ejecutables (no "mejorar el contenido" sino "publicar 2 carruseles de AGRONOMIA con datos técnicos los miércoles")
- Ancladas en los datos que ves
- Coherentes con el tono y los pilares del brand kit

OUTPUT — JSON exacto (nada fuera del JSON):
{
  "resumen": "párrafo narrativo de 4-6 líneas sobre el período analizado",
  "funciona": "2-4 puntos concretos de lo que está funcionando bien (usa HTML <br> para separar)",
  "mejorar": "2-3 puntos honestos de lo que necesita mejora (usa HTML <br> para separar)",
  "ideas": "3-5 ideas ejecutables para Studio Bravo, numeradas, con contexto (usa HTML <br> para separar)",
  "pilar_top": "nombre del pilar con mejor rendimiento",
  "pilar_bottom": "nombre del pilar con menor rendimiento"
}"""


class MetricsAnalyst:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)

    def _get_client_data(self, client_id: str) -> Optional[dict]:
        sb = get_client()
        if sb is None:
            return None
        resp = sb.table("clients").select("*").eq("id", client_id).limit(1).execute()
        rows = resp.data or []
        return rows[0] if rows else None

    def _get_brand_kit(self, client_id: str) -> Optional[dict]:
        sb = get_client()
        if sb is None:
            return None
        resp = (
            sb.table("client_brand")
            .select("tone_of_voice,pillars,notes")
            .eq("client_id", client_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def _get_metrics(self, client_id: str, days: int = 90) -> list:
        sb = get_client()
        if sb is None:
            return []
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        resp = (
            sb.table("post_metrics")
            .select("*")
            .eq("client_id", client_id)
            .gte("published_at", cutoff)
            .order("published_at", desc=True)
            .execute()
        )
        return resp.data or []

    def run(self, client_id: str, days: int = 90) -> dict:
        client = self._get_client_data(client_id)
        if not client:
            raise ValueError(f"Cliente {client_id} non trovato")

        client_name = client.get("name", "Cliente")
        sector      = client.get("sector", "")

        metrics    = self._get_metrics(client_id, days)
        brand_kit  = self._get_brand_kit(client_id) or {}
        briefing   = get_briefing(client_id) or {}
        brief_text = (briefing.get("briefing_text") or "")[:2000]

        if not metrics:
            return {
                "ok": False,
                "error": "No hay métricas registradas para este cliente. Añade métricas manualmente o sincroniza desde Instagram."
            }

        # Aggregati per pillar
        pillar_stats: dict = {}
        platform_stats: dict = {}
        for r in metrics:
            p = r.get("pillar") or "Sin pilar"
            pillar_stats.setdefault(p, {"posts": 0, "likes": 0, "reach": 0, "saves": 0, "comments": 0})
            pillar_stats[p]["posts"]    += 1
            pillar_stats[p]["likes"]    += r.get("likes", 0)
            pillar_stats[p]["reach"]    += r.get("reach", 0)
            pillar_stats[p]["saves"]    += r.get("saves", 0)
            pillar_stats[p]["comments"] += r.get("comments", 0)

            pl = r.get("platform") or "instagram"
            platform_stats.setdefault(pl, {"posts": 0, "likes": 0, "reach": 0})
            platform_stats[pl]["posts"] += 1
            platform_stats[pl]["likes"] += r.get("likes", 0)
            platform_stats[pl]["reach"] += r.get("reach", 0)

        total_posts  = len(metrics)
        avg_likes    = round(sum(r.get("likes", 0) for r in metrics) / total_posts, 1)
        avg_reach    = round(sum(r.get("reach", 0) for r in metrics) / total_posts, 1)
        avg_saves    = round(sum(r.get("saves", 0) for r in metrics) / total_posts, 1)

        # Top 3 post per reach
        top_posts = sorted(metrics, key=lambda x: x.get("reach", 0), reverse=True)[:3]

        user_message = f"""CLIENTE: {client_name}
SECTOR: {sector}
PERÍODO ANALIZADO: últimos {days} días
TOTAL POSTS: {total_posts}
MEDIA LIKES: {avg_likes} | MEDIA REACH: {avg_reach} | MEDIA SAVES: {avg_saves}

--- MÉTRICAS POR PILAR ---
{json.dumps(pillar_stats, ensure_ascii=False, indent=2)}

--- MÉTRICAS POR PLATAFORMA ---
{json.dumps(platform_stats, ensure_ascii=False, indent=2)}

--- TOP 3 POSTS (por reach) ---
{json.dumps([{"headline": p.get("headline"), "pillar": p.get("pillar"), "platform": p.get("platform"),
              "likes": p.get("likes"), "reach": p.get("reach"), "saves": p.get("saves"),
              "date": p.get("published_at")} for p in top_posts], ensure_ascii=False, indent=2)}

--- BRAND KIT ---
Tono: {brand_kit.get("tone_of_voice", "N/D")}
Pilares: {json.dumps(brand_kit.get("pillars", []), ensure_ascii=False)}
Notas: {brand_kit.get("notes", "N/D")}

--- BRIEFING (extracto) ---
{brief_text or "(no disponible)"}

Produce el informe de métricas para Studio Bravo."""

        print(f"📊 Analista de métricas al trabajo — {client_name} ({total_posts} posts, {days} días)...")

        response = self.claude.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:].strip()

        report = json.loads(raw)
        return {"ok": True, "report": report, "posts_analyzed": total_posts}
