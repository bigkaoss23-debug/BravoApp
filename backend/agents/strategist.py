"""
Strategist Agent — Stratega Editoriale BRAVO.

Legge il briefing integrale del cliente, la ricerca di mercato, il brand kit
e lo storico dei post recenti. Produce un piano editoriale settimanale concreto:
3 post pianificati (Lun reel / Mer carrusel / Ven story) con pillar, angolo e brief
dettagliato per il Designer.

Non genera immagini né testo finale — produce il brief che passa al Designer.

Modalità di esecuzione:
  - Diretta: Strategist().run(client_id="...", week_start="2026-04-21")
  - Da coda:  Strategist().run_from_queue()
"""

import json
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import anthropic

from tools.briefing_store import get_briefing
from tools.editorial_store import get_recent_generated, get_recent_plans, save_editorial_plan
from tools.supabase_client import get_client
from tools.task_store import claim_pending_task, complete_task, fail_task

SYSTEM_PROMPT = """Eres el Estratega Editorial de BRAVO!COMUNICA, agencia creativa especializada en social media marketing.

Tu tarea es transformar el briefing del cliente + la investigación de mercado + el brand kit en un plan editorial concreto para la semana.

QUÉ DEBES PRODUCIR:
Exactamente 3 publicaciones planificadas. Sigue la cadencia indicada en el brand kit del cliente. Si no está especificada, usa la cadencia por defecto:
- Lunes → Reel (Proyectos / obras recientes)
- Miércoles → Carrusel (alterna: Personas ↔ Sistema/producto)
- Viernes → Story o reel corto (momento real del equipo, menos producción)

REGLAS DE ROTACIÓN DE PILARES:
- Revisa los posts recientes — si un pilar se ha usado 4 veces seguidas, evítalo esta semana
- Distribuye los pilares en el tiempo: los definidos en el brand kit deben rotar cada 2-3 semanas
- Usa los pilares exactos del brand kit del cliente — no inventes nombres
- Usa la investigación de mercado para elegir el ángulo más relevante en este momento

EL BRIEF DE CADA POST debe ser lo suficientemente rico para que el Diseñador trabaje sin preguntas:
- Qué mostrar (visual: tipo de escena, sujeto principal)
- Qué decir (mensaje clave, tono)
- Headline sugerida (en mayúsculas, estilo brand)
- Caption orientativa (2-4 líneas, primera persona plural, termina con CTA)
- Hashtags adicionales específicos (además de los fijos del brand)

CÓMO LEER LOS DATOS:
- Briefing: léelo todo, sin filtrar — cada detalle es intencional
- Investigación de mercado: usa los trends y las oportunidades concretas como ángulos para los posts
- Análisis de métricas: si el Analista señala un pilar con excelente rendimiento, priorízalo esta semana
- Voz del público: si los comentarios muestran una pregunta recurrente (ej. "¿dónde compro?", "¿cuánto cuesta?"), uno de los 3 posts debe responder a esa pregunta — es la máxima prioridad editorial porque viene directamente del público real
- Posts recientes: evita repetir pilares y ángulos ya usados recientemente
- Brand kit: respeta tono, pilares, layouts y notas

OUTPUT — JSON exacto (ningún texto fuera del JSON):
{
  "week_start": "YYYY-MM-DD",
  "reasoning": "2-3 líneas: por qué elegiste estos 3 pilares esta semana",
  "posts": [
    {
      "day": "Lunes",
      "scheduled_date": "YYYY-MM-DD",
      "pillar": "NOMBRE_PILAR",
      "platform": "instagram",
      "format": "reel",
      "angle": "ángulo específico del post (1 línea)",
      "brief": "brief completo para el Diseñador (mín 150 palabras): visual + mensaje + headline + caption + hashtags adicionales"
    },
    {
      "day": "Miércoles",
      ...
    },
    {
      "day": "Viernes",
      ...
    }
  ]
}"""


def _format_metrics_report(metrics_report: Optional[dict]) -> str:
    """Formatta il report dell'Analista in testo leggibile per lo Strategist."""
    if not metrics_report:
        return "(no disponible aún — se genera automáticamente de noche o manualmente desde la tab Métricas)"
    r = metrics_report.get("report", {})
    generated = metrics_report.get("generated_at", "")[:10]
    lines = [f"Generado: {generated}" if generated else ""]
    if r.get("tendencia"):
        lines.append(f"Tendencia general: {r['tendencia']}")
    if r.get("pilar_top"):
        lines.append(f"Pilar con mejor rendimiento: {r['pilar_top']}")
    if r.get("pilar_bottom"):
        lines.append(f"Pilar con menor rendimiento: {r['pilar_bottom']}")
    if r.get("funciona"):
        lines.append(f"\nLo que está funcionando:\n{r['funciona']}")
    if r.get("mejorar"):
        lines.append(f"\nLo que mejorar:\n{r['mejorar']}")
    if r.get("audience_insights"):
        lines.append(f"\nLo que pide el público (de los comentarios):\n{r['audience_insights']}")
    if r.get("idea_top_brief"):
        lines.append(f"\nIdea prioritaria del Analista (brief listo):\n{r['idea_top_brief']}")
    return "\n".join(l for l in lines if l)


class Strategist:
    """
    Produce il piano editoriale settimanale per un cliente.
    """

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)

    # ──────────────────────────────────────────────
    # Lettura dati
    # ──────────────────────────────────────────────

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
            .select("tone_of_voice,pillars,layouts,notes,brand_kit_opus")
            .eq("client_id", client_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def _get_weekly_context(self, client_id: str, week_start: str) -> Optional[dict]:
        """Legge il contesto settimanale compilato da Bravo (tema, prodotti, foto…)."""
        sb = get_client()
        if sb is None:
            return None
        resp = (
            sb.table("weekly_contexts")
            .select("*")
            .eq("client_id", client_id)
            .eq("week_start", week_start)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def _get_latest_market_research(self, sector: str) -> Optional[dict]:
        sb = get_client()
        if sb is None:
            return None
        now = datetime.now(timezone.utc).isoformat()
        resp = (
            sb.table("market_research")
            .select("report,keywords,hashtags,trends,created_at")
            .eq("sector", sector)
            .gt("valid_until", now)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def _get_latest_metrics_report(self, client_id: str) -> Optional[dict]:
        """Legge l'ultimo report dell'Analista per questo cliente."""
        sb = get_client()
        if sb is None:
            return None
        resp = (
            sb.table("metrics_reports")
            .select("report,posts_analyzed,generated_at")
            .eq("client_id", client_id)
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def _next_monday(self) -> str:
        """Ritorna la data del prossimo lunedì (o oggi se è già lunedì)."""
        today = date.today()
        days_ahead = (7 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        return (today + timedelta(days=days_ahead)).isoformat()

    # ──────────────────────────────────────────────
    # Logica principale
    # ──────────────────────────────────────────────

    def run(
        self,
        client_id: str,
        week_start: Optional[str] = None,
        task_id: Optional[str] = None,
        force: bool = False,
    ) -> dict:
        """
        Produce il piano editoriale per la settimana indicata.
        Se force=False e il piano esiste già per quella settimana, lo salta.
        """
        if not week_start:
            week_start = self._next_monday()

        # 1. Dati cliente
        client = self._get_client_data(client_id)
        if not client:
            raise ValueError(f"Cliente {client_id} non trovato")

        client_name = client.get("name", "Cliente")
        client_key = client.get("client_key", "")
        sector = client.get("sector", "")

        # 2. Piano già esistente per questa settimana?
        if not force:
            sb = get_client()
            if sb:
                existing = (
                    sb.table("editorial_plans")
                    .select("id")
                    .eq("client_id", client_id)
                    .eq("week_start", week_start)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    print(f"♻️  Piano settimana {week_start} già esistente — salto (usa force=True per rigenerare)")
                    return {"reused": True, "week_start": week_start, "client": client_name}

        # 3. Contesto settimanale (tema reale, prodotti, chi è in campo, foto)
        weekly_ctx = self._get_weekly_context(client_id, week_start)

        # 4. Briefing — usa versione distillata se disponibile (risparmio ~85% token)
        briefing_data = get_briefing(client_id)
        briefing_text = (briefing_data.get("briefing_text") or "") if briefing_data else ""

        # 5. Brand kit
        brand_kit = self._get_brand_kit(client_id) or {}

        # Usa il prompt specifico del cliente se presente nel brand kit
        opus = brand_kit.get("brand_kit_opus") or {}

        # Sostituisce il briefing integrale con la versione distillata se presente
        briefing_distilled = opus.get("briefing_distilled", "")
        if briefing_distilled:
            briefing_text = briefing_distilled
            print(f"✅ Usando briefing distillado ({len(briefing_distilled)} chars vs {len((briefing_data or {}).get('briefing_text') or '')} del integrale)")

        client_prompt = (opus.get("agent_prompts") or {}).get("estratega")
        system_prompt = client_prompt if client_prompt else SYSTEM_PROMPT
        if client_prompt:
            print(f"✅ Usando prompt Stratega specifico di {client_name} dal brand kit")

        # 6. Ricerca di mercato
        market = self._get_latest_market_research(sector) or {}

        # 7. Post recenti (evita ripetizioni)
        recent_planned = get_recent_plans(client_id, days=30)
        recent_generated = get_recent_generated(client_key, days=30) if client_key else []
        recent_posts = recent_planned + recent_generated

        # 8. Report Analista Metriche (input dalla catena notturna)
        metrics_report = self._get_latest_metrics_report(client_id)

        # 9. Costruzione messaggio per Claude
        nota_campo = ""
        istruzioni_bravo = ""
        if weekly_ctx:
            nota_campo = (
                weekly_ctx.get("nota_campo")
                or weekly_ctx.get("note_aggiuntive")  # fallback dati vecchi
                or ""
            ).strip()
            istruzioni_bravo = (weekly_ctx.get("istruzioni_bravo") or "").strip()

        if nota_campo:
            campo_section = f"""--- MATERIAL DE CAMPO (lo que pasó esta semana — materia prima real) ---
⚠️ ESTE ES EL PUNTO DE PARTIDA — es el contenido real de la semana, no una instrucción.
Úsalo para decidir QUÉ contar. El briefing del cliente es el contexto de fondo.

{nota_campo}
--- FIN MATERIAL DE CAMPO ---"""
        else:
            campo_section = "⚠️ Material de campo no disponible esta semana — basa los ángulos en la investigación de mercado y la estacionalidad."

        if istruzioni_bravo:
            bravo_section = f"""--- INSTRUCCIONES DE BRAVO PARA ESTA SEMANA ---
Lee esto como instrucciones editoriales: cuántas publicaciones, plataformas, restricciones, prioridades.

{istruzioni_bravo}
--- FIN INSTRUCCIONES BRAVO ---"""
        else:
            bravo_section = "Instrucciones Bravo: ninguna específica — sigue el plan estándar (Lun reel / Mié carrusel / Vie story)."

        ctx_section = f"\n{campo_section}\n\n{bravo_section}\n"

        user_message = f"""CLIENTE: {client_name}
SETTORE: {sector}
SETTIMANA DA PIANIFICARE: {week_start} (Lunedì)
{ctx_section}

--- BRIEFING INTEGRALE DEL CLIENTE ---
{briefing_text or "(non ancora caricato)"}
--- FINE BRIEFING ---

--- BRAND KIT ---
Tono di voce: {brand_kit.get('tone_of_voice', 'N/D')}
Pilastri: {json.dumps(brand_kit.get('pillars', []), ensure_ascii=False)}
Layout disponibili: {json.dumps(brand_kit.get('layouts', []), ensure_ascii=False)}
Note importanti: {brand_kit.get('notes', 'N/D')}
--- FINE BRAND KIT ---

--- RICERCA DI MERCATO ({sector}) ---
Trend principali: {json.dumps(market.get('trends', {}).get('principali', []), ensure_ascii=False)}
Opportunità di contenuto: {json.dumps(market.get('trends', {}).get('opportunita', []), ensure_ascii=False)}
Trend stagionali: {json.dumps(market.get('trends', {}).get('stagionali', []), ensure_ascii=False)}
Keywords di settore: {', '.join(market.get('keywords', [])[:10])}
--- FINE RICERCA ---

--- POST RECENTI (ultimi 30 giorni — evita ripetizioni) ---
{json.dumps(recent_posts[-15:], ensure_ascii=False, default=str) if recent_posts else "(nessuno)"}
--- FINE POST RECENTI ---

--- ANALISI METRICHE (dall'Analista — usala per scegliere pillar e angoli) ---
{_format_metrics_report(metrics_report)}
--- FINE ANALISI METRICHE ---

Produci il piano editoriale per la settimana del {week_start}."""

        print(f"📅 Stratega al lavoro — piano settimana {week_start} per {client_name}...")

        response = self.claude.messages.create(
            model="claude-opus-4-7",
            max_tokens=8192,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()

        # Parse JSON
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:].strip()

        try:
            plan = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON non valido dallo Stratega: {e}. Inizio risposta: {raw[:300]}")

        posts = plan.get("posts", [])
        if not posts:
            raise ValueError("Lo Stratega non ha prodotto nessun post nel piano")
        if len(posts) != 3:
            print(f"⚠️  Stratega: {len(posts)} post invece di 3 — troncato a 3")
            posts = posts[:3]

        # Salva in editorial_plans
        saved = save_editorial_plan(
            client_id=client_id,
            week_start=plan.get("week_start", week_start),
            posts=posts,
            task_id=task_id,
        )

        print(f"✅ Piano editoriale salvato — {len(saved)} post per settimana {week_start}")

        return {
            "reused": False,
            "week_start": week_start,
            "client": client_name,
            "posts_count": len(saved),
            "reasoning": plan.get("reasoning", ""),
            "posts": [
                {
                    "day": p.get("day"),
                    "pillar": p.get("pillar"),
                    "format": p.get("format"),
                    "angle": p.get("angle"),
                }
                for p in posts
            ],
        }

    def run_from_queue(self) -> bool:
        """Worker loop: prende il primo task pending e lo esegue."""
        task = claim_pending_task("strategist")
        if not task:
            return False

        task_id = task["id"]
        client_id = task.get("client_id")
        payload = task.get("payload", {})
        force = payload.get("force", False)
        week_start = payload.get("week_start")

        try:
            result = self.run(
                client_id=client_id,
                week_start=week_start,
                task_id=task_id,
                force=force,
            )
            complete_task(task_id, result)
            print(f"✅ Task strategist {task_id} completato")
            return True
        except Exception as e:
            fail_task(task_id, str(e))
            print(f"❌ Task strategist {task_id} fallito: {e}")
            return False
