"""
Metrics Analyst Agent — Analista de Métricas BRAVO.

Legge:
  - Metriche degli ultimi 90 giorni (post singoli con caption)
  - Snapshot mensili degli ultimi 12 mesi (confronto storico)
  - Brand kit del cliente
  - Briefing del cliente

Produce un informe narrativo con:
  - Resumen ejecutivo con confronto storico (es. +22% reach vs mismo período año anterior)
  - Qué está funcionando (pillar, formato, apertura caption)
  - Qué mejorar
  - 3-5 ideas concretas para Studio Bravo (con brief eseguibile per la migliore)
  - Pilar top / bottom
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

CÓMO LEER LOS DATOS CUANTITATIVOS:
- Usa los snapshots mensuales para detectar tendencias: ¿el reach está subiendo o bajando en los últimos 6 meses?
- Compara el período actual con el mismo período del año anterior si hay datos disponibles
- Compara pilares: ¿TECNOLOGIA supera a PRODUCTO en reach? ¿Por qué podría ser?
- Conecta con el brand kit: si un pilar tiene bajo engagement pero es estratégicamente importante, no lo descartes — propón cómo mejorarlo
- Sé honesto: si los datos son escasos o poco representativos, dilo

CÓMO LEER LOS COMENTARIOS (datos cualitativos — muy valiosos):
- Los comentarios son la voz real del público. Léelos como un investigador, no como un moderador.
- Busca: ¿qué preguntan con más frecuencia? ¿qué productos mencionan? ¿dónde quieren comprar? ¿qué problemas tienen?
- Agrupa por temas: si 6 personas preguntan "¿dónde lo compro?", eso es una señal editorial clara
- Nota el tono: ¿entusiasmo, dudas técnicas, comparación con competidores?
- Las palabras exactas que usa el público son oro para los textos futuros

REGLAS PARA LAS IDEAS DE STUDIO BRAVO:
- Concretas y ejecutables dentro de la producción de Bravo (3 posts/semana: lunes reel, miércoles carrusel, viernes story)
- Ancladas en los datos que ves, no en teoría general
- Si los comentarios revelan una necesidad clara (ej. "¿dónde compro?"), la idea #1 debe responder a esa necesidad
- La mejor idea debe tener un brief listo para pasar al Strategist directamente

OUTPUT — JSON exacto (nada fuera del JSON):
{
  "resumen": "párrafo narrativo de 4-6 líneas: tendencia del período + comparación histórica si disponible",
  "funciona": "2-4 puntos concretos de lo que está funcionando (usa <br> para separar)",
  "mejorar": "2-3 puntos honestos de lo que necesita mejora (usa <br> para separar)",
  "audience_insights": "lo que el público está diciendo y pidiendo en los comentarios: temas, preguntas frecuentes, palabras clave usadas, tono general (usa <br> para separar puntos distintos)",
  "ideas": "3-5 ideas ejecutables numeradas, priorizando las que responden a lo que pide el público (usa <br> para separar)",
  "idea_top_brief": "brief completo listo para el Strategist de la idea #1: pillar, formato, ángulo, headline sugerida, por qué funcionará según los datos y los comentarios",
  "pilar_top": "nombre del pilar con mejor rendimiento",
  "pilar_bottom": "nombre del pilar con menor rendimiento",
  "tendencia": "subiendo | estable | bajando"
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

    def _get_recent_comments(self, client_id: str, days: int = 30, limit: int = 200) -> list:
        """Legge i commenti recenti del cliente per l'analisi qualitativa."""
        sb = get_client()
        if sb is None:
            return []
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        resp = (
            sb.table("post_comments")
            .select("text,timestamp,ig_media_id")
            .eq("client_id", client_id)
            .gte("timestamp", cutoff)
            .order("timestamp", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []

    def _get_monthly_history(self, client_id: str, months: int = 12) -> list:
        """Legge gli snapshot mensili degli ultimi N mesi per confronto storico."""
        sb = get_client()
        if sb is None:
            return []
        cutoff = (date.today().replace(day=1) - timedelta(days=months * 30)).strftime("%Y-%m")
        resp = (
            sb.table("metrics_monthly")
            .select("month,total_posts,avg_likes,avg_reach,avg_saves,by_pillar")
            .eq("client_id", client_id)
            .gte("month", cutoff)
            .order("month", desc=False)
            .execute()
        )
        return resp.data or []

    def run(self, client_id: str, days: int = 90) -> dict:
        client = self._get_client_data(client_id)
        if not client:
            raise ValueError(f"Cliente {client_id} non trovato")

        client_name = client.get("name", "Cliente")
        sector      = client.get("sector", "")

        metrics         = self._get_metrics(client_id, days)
        monthly_history = self._get_monthly_history(client_id, months=12)
        recent_comments = self._get_recent_comments(client_id, days=30)
        brand_kit       = self._get_brand_kit(client_id) or {}
        briefing        = get_briefing(client_id) or {}
        brief_text      = (briefing.get("briefing_text") or "")[:2000]

        if not metrics:
            return {
                "ok": False,
                "error": "No hay métricas registradas para este cliente. Añade métricas manualmente o sincroniza desde Instagram."
            }

        # Aggregati per pillar e piattaforma
        pillar_stats: dict   = {}
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

        total_posts = len(metrics)
        avg_likes   = round(sum(r.get("likes", 0) for r in metrics) / total_posts, 1)
        avg_reach   = round(sum(r.get("reach", 0) for r in metrics) / total_posts, 1)
        avg_saves   = round(sum(r.get("saves", 0) for r in metrics) / total_posts, 1)

        # Top 5 post per reach (con caption per analisi linguistica)
        top_posts = sorted(metrics, key=lambda x: x.get("reach", 0), reverse=True)[:5]
        top_posts_data = [
            {
                "headline": p.get("headline", ""),
                "caption":  (p.get("notes", "") or "")[:200],  # notes contiene permalink, ma se in futuro salviamo caption è qui
                "pillar":   p.get("pillar"),
                "platform": p.get("platform"),
                "likes":    p.get("likes"),
                "reach":    p.get("reach"),
                "saves":    p.get("saves"),
                "date":     p.get("published_at"),
            }
            for p in top_posts
        ]

        # Sezione storico mensile
        history_section = ""
        if monthly_history:
            history_section = f"""--- HISTÓRICO MENSUAL (últimos {len(monthly_history)} meses) ---
{json.dumps(monthly_history, ensure_ascii=False, indent=2)}
--- FIN HISTÓRICO ---"""
        else:
            history_section = "--- HISTÓRICO MENSUAL: no disponible aún (se genera automáticamente cada noche) ---"

        # Prepara commenti: testo pulito, max 200 caratteri per commento
        comments_text = ""
        if recent_comments:
            comment_lines = [f"- {c['text'][:200]}" for c in recent_comments if c.get("text")]
            comments_text = f"--- COMENTARIOS RECIENTES ({len(comment_lines)} últimos 30 días) ---\n" + "\n".join(comment_lines[:150]) + "\n--- FIN COMENTARIOS ---"
        else:
            comments_text = "--- COMENTARIOS: no disponibles aún (se sincronizan desde Instagram) ---"

        user_message = f"""CLIENTE: {client_name}
SECTOR: {sector}
PERÍODO ANALIZADO: últimos {days} días
TOTAL POSTS: {total_posts}
MEDIA LIKES: {avg_likes} | MEDIA REACH: {avg_reach} | MEDIA SAVES: {avg_saves}

--- MÉTRICAS POR PILAR (período actual) ---
{json.dumps(pillar_stats, ensure_ascii=False, indent=2)}

--- MÉTRICAS POR PLATAFORMA ---
{json.dumps(platform_stats, ensure_ascii=False, indent=2)}

--- TOP 5 POSTS (por reach) ---
{json.dumps(top_posts_data, ensure_ascii=False, indent=2)}

{history_section}

{comments_text}

--- BRAND KIT ---
Tono: {brand_kit.get("tone_of_voice", "N/D")}
Pilares estratégicos: {json.dumps(brand_kit.get("pillars", []), ensure_ascii=False)}
Notas: {brand_kit.get("notes", "N/D")}

--- BRIEFING DEL CLIENTE (extracto) ---
{brief_text or "(no disponible)"}

Produce el informe de métricas para Studio Bravo."""

        print(f"📊 Analista de métricas al trabajo — {client_name} ({total_posts} posts, {days} días, {len(monthly_history)} meses histórico, {len(recent_comments)} comentarios)...")

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
        return {"ok": True, "report": report, "posts_analyzed": total_posts, "months_history": len(monthly_history)}
