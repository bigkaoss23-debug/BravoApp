"""
Market Researcher Agent — Ricercatore di Mercato BRAVO.

Legge il briefing integrale del cliente e il suo settore, produce un report
di mercato (trend, parole chiave, hashtag, dinamiche competitor) che viene
salvato in market_research e usato dallo Stratega Editoriale.

Il report è valido 30 giorni e condiviso tra clienti dello stesso settore:
se due clienti operano in Ristorazione, la ricerca viene fatta una volta sola.

Modalità di esecuzione:
  - Diretta: MarketResearcher().run(client_id="...")
  - Da coda:  MarketResearcher().run_from_queue()
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

import anthropic

from tools.briefing_store import get_briefing
from tools.brand_store import get_brand_kit
from tools.supabase_client import get_client
from tools.task_store import claim_pending_task, complete_task, fail_task

TABLE = "market_research"

SYSTEM_PROMPT = """Eres el Investigador de Mercado de BRAVO!COMUNICA, agencia creativa especializada en social media marketing.

Tu tarea es producir un informe de mercado en profundidad que servirá al Estratega Editorial como contexto para construir el plan de contenidos semanal del cliente.

CÓMO LEER EL BRIEFING:
- Lee cada línea — no resumas, no filtres
- El briefing contiene años de trabajo estratégico: cada detalle es intencional
- Busca el "calor humano": la voz del brand, las personas detrás de la empresa, los valores no declarados

TU OUTPUT debe ser un JSON con esta estructura exacta (ningún texto fuera del JSON):
{
  "report": "informe narrativo completo, mín 600 palabras, en el idioma del cliente",
  "keywords": ["keyword1", "keyword2"],
  "hashtags": ["#hashtag1", "#hashtag2"],
  "trends": {
    "principali": ["trend sectorial relevante para los contenidos sociales"],
    "stagionali": ["trends ligados al período del año / estacionalidad"],
    "opportunita": ["ángulo de contenido aún poco explotado en el sector"],
    "competitor_pattern": "cómo se mueven los competidores en redes sociales en este sector"
  }
}

DETALLES:
- keywords: 15-20 términos técnicos/comerciales del sector
- hashtags: 25-35 hashtags para Instagram/LinkedIn (mix volumen alto + nicho)
- report: análisis narrativo de trends sectoriales, comportamiento del público, oportunidades de contenido
- Mantén siempre el idioma del mercado del cliente"""


class MarketResearcher:
    """
    Analizza il settore di un cliente e produce un report di mercato strutturato.
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

    def _get_existing_research(self, sector: str) -> Optional[dict]:
        """Ritorna il report più recente ancora valido per questo settore, o None."""
        sb = get_client()
        if sb is None:
            return None
        now = datetime.now(timezone.utc).isoformat()
        resp = (
            sb.table(TABLE)
            .select("id,sector,valid_until,created_at")
            .eq("sector", sector)
            .gt("valid_until", now)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    # ──────────────────────────────────────────────
    # Scrittura dati
    # ──────────────────────────────────────────────

    def _save_research(self, sector: str, result: dict, task_id: Optional[str] = None) -> dict:
        sb = get_client()
        if sb is None:
            raise RuntimeError("Supabase non disponibile")
        payload = {
            "sector": sector,
            "report": result.get("report", ""),
            "keywords": result.get("keywords", []),
            "hashtags": result.get("hashtags", []),
            "trends": result.get("trends", {}),
            "task_id": task_id,
        }
        resp = sb.table(TABLE).insert(payload).execute()
        return resp.data[0] if resp.data else payload

    # ──────────────────────────────────────────────
    # Logica principale
    # ──────────────────────────────────────────────

    def run(self, client_id: str, task_id: Optional[str] = None, force: bool = False) -> dict:
        """
        Esegue la ricerca di mercato per un cliente.
        Riusa il report esistente se ancora valido (evita lavoro duplicato).
        Con force=True ignora la cache e produce sempre una ricerca nuova.
        """
        # 1. Dati cliente
        client = self._get_client_data(client_id)
        if not client:
            raise ValueError(f"Cliente {client_id} non trovato in Supabase")

        sector = client.get("sector") or "Settore non specificato"
        client_name = client.get("name", "Cliente")

        # 2. Ricerca ancora valida? Riusa (a meno che force=True).
        existing = self._get_existing_research(sector)
        if existing and not force:
            print(f"♻️  Ricerca esistente per '{sector}' valida fino a {existing.get('valid_until')} — riuso")
            return {
                "reused": True,
                "sector": sector,
                "research_id": existing["id"],
                "valid_until": existing.get("valid_until"),
            }

        # 3. Briefing — usa versione distillata se disponibile (risparmio ~85% token)
        briefing_data = get_briefing(client_id)
        briefing_text = (briefing_data.get("briefing_text") or "") if briefing_data else ""

        brand_kit = get_brand_kit(client_id) or {}
        opus = brand_kit.get("brand_kit_opus") or {}
        briefing_distilled = opus.get("briefing_distilled", "")
        if briefing_distilled:
            briefing_text = briefing_distilled
            print(f"✅ Usando briefing distillado ({len(briefing_distilled)} chars)")

        if not briefing_text:
            print(f"⚠️  Nessun briefing caricato per {client_name} — procedo con dati anagrafici")

        # 4. Costruzione messaggio per Claude
        user_message = f"""SETTORE: {sector}
CLIENTE: {client_name}
MERCATO: {client.get('city', 'Non specificato')}
DESCRIZIONE: {client.get('description', '')}
INSTAGRAM: {client.get('instagram', 'Non specificato')}

--- BRIEFING INTEGRALE DEL CLIENTE ---
{briefing_text if briefing_text else "(briefing non ancora caricato — usa dati anagrafici sopra)"}
--- FINE BRIEFING ---

Produci il report di mercato completo per questo settore e cliente."""

        print(f"🔍 Avvio ricerca mercato per '{sector}' ({client_name})...")

        # 5. Chiamata a Claude Opus — compito analitico complesso
        response = self.claude.messages.create(
            model="claude-opus-4-7",
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()

        # 6. Parse JSON — rimuove eventuali backtick se Claude li aggiunge
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:].strip()

        try:
            result = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Claude ha restituito un JSON non valido: {e}. Risposta parziale: {raw[:300]}")

        # 7. Salva in Supabase
        saved = self._save_research(sector, result, task_id)
        research_id = saved.get("id", "n/a")
        print(f"✅ Ricerca mercato salvata — id: {research_id}")

        return {
            "reused": False,
            "sector": sector,
            "research_id": research_id,
            "keywords_count": len(result.get("keywords", [])),
            "hashtags_count": len(result.get("hashtags", [])),
        }

    def run_from_queue(self, force: bool = False) -> bool:
        """
        Worker loop: prende il primo task pending dalla coda e lo esegue.
        Ritorna True se ha processato un task, False se la coda era vuota.
        """
        task = claim_pending_task("market_researcher")
        if not task:
            return False

        task_id = task["id"]
        client_id = task.get("client_id")
        # force può venire anche dal payload del task
        task_force = task.get("payload", {}).get("force", force)

        try:
            result = self.run(client_id=client_id, task_id=task_id, force=task_force)
            complete_task(task_id, result)
            print(f"✅ Task {task_id} completato")
            return True
        except Exception as e:
            fail_task(task_id, str(e))
            print(f"❌ Task {task_id} fallito: {e}")
            return False
