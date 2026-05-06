"""
market_intelligence.py — A4 Market Intelligence (Sonnet).

Legge il briefing integrale del cliente e il suo settore, produce un report
di mercato (trend, parole chiave, hashtag, dinamiche competitor) salvato in
market_research e usato dall'Editorial Planner.

Shared per settore: se due clienti operano in Hospitality, la ricerca viene
fatta una volta sola e riusata per 30 giorni.

Sostituisce market_researcher.py (rinominato a .deprecated).
Modello aggiornato: claude-sonnet-4-6 (era claude-opus-4-7).
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

_SYSTEM = """Eres el Agente de Market Intelligence de Studio Bravo. Tu tarea es producir un informe de mercado que sirve al Editorial Planner como contexto para construir el plan de contenidos mensual del cliente.

CÓMO LEER EL BRIEFING:
- Lee cada línea — no resumas, no filtres
- El briefing contiene años de trabajo estratégico: cada detalle es intencional
- Busca el "calor humano": la voz del brand, las personas detrás de la empresa, los valores no declarados

OUTPUT — JSON exacto (ningún texto fuera del JSON):
{
  "report": "informe narrativo completo, mín 500 palabras, en el idioma del cliente",
  "keywords": ["keyword1", "keyword2"],
  "hashtags": ["#hashtag1", "#hashtag2"],
  "trends": {
    "principali": ["trend sectorial relevante para los contenidos sociales"],
    "stagionali": ["trends ligados al período del año / estacionalidad"],
    "opportunita": ["ángulo de contenido aún poco explotado en el sector"],
    "competitor_pattern": "cómo se mueven los competidores en redes sociales en este sector"
  },
  "differentiation_gaps": ["aspecto donde el cliente puede diferenciarse de la competencia"]
}

DETALLES:
- keywords: 15-20 términos técnicos/comerciales del sector
- hashtags: 25-35 hashtags para Instagram (mix volumen alto + nicho)
- differentiation_gaps: 3-5 gaps específicos donde el cliente puede ganar terreno
- Mantén siempre el idioma del mercado del cliente"""


class MarketIntelligence:
    """A4 — Ricerca settore e competitor, produce report per Editorial Planner."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        self.claude = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-6"

    def _get_client_data(self, client_id: str) -> Optional[dict]:
        sb = get_client()
        if sb is None:
            return None
        resp = sb.table("clients").select("*").eq("id", client_id).limit(1).execute()
        rows = resp.data or []
        return rows[0] if rows else None

    def _get_existing_research(self, sector: str) -> Optional[dict]:
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

    def run(self, client_id: str, task_id: Optional[str] = None, force: bool = False) -> dict:
        """
        Esegue la ricerca di mercato per un cliente.
        Riusa il report esistente se ancora valido (30 giorni).
        force=True ignora la cache e produce sempre una ricerca nuova.
        """
        client = self._get_client_data(client_id)
        if not client:
            raise ValueError(f"Cliente {client_id} non trovato in Supabase")

        sector = client.get("sector") or "Settore non specificato"
        client_name = client.get("name", "Cliente")

        existing = self._get_existing_research(sector)
        if existing and not force:
            print(f"♻️  Market Intelligence: ricerca '{sector}' valida fino a {existing.get('valid_until')} — riuso")
            return {
                "reused": True,
                "sector": sector,
                "research_id": existing["id"],
                "valid_until": existing.get("valid_until"),
            }

        briefing_data = get_briefing(client_id)
        briefing_text = (briefing_data.get("briefing_text") or "") if briefing_data else ""

        brand_kit = get_brand_kit(client_id) or {}
        opus = brand_kit.get("brand_kit_opus") or {}

        # Competitor dal brand kit (v2)
        competitors = opus.get("competitors", [])
        competitor_block = ""
        if competitors:
            competitor_block = "\nCOMPETIDORES CONOCIDOS:\n" + "\n".join(
                f"  - {c.get('name', '')}: {c.get('positioning', '')}" for c in competitors[:5]
            )

        if not briefing_text:
            print(f"⚠️  Market Intelligence: nessun briefing per {client_name} — uso dati anagrafici")

        user_message = (
            f"SETTORE: {sector}\n"
            f"CLIENTE: {client_name}\n"
            f"MERCATO: {client.get('city', 'Non specificato')}\n"
            f"DESCRIZIONE: {client.get('description', '')}\n"
            f"INSTAGRAM: {client.get('instagram', 'Non specificato')}\n"
            + competitor_block
            + "\n\n--- BRIEFING INTEGRALE DEL CLIENTE ---\n"
            + (briefing_text if briefing_text else "(briefing non ancora caricato)")
            + "\n--- FINE BRIEFING ---\n\n"
            "Produci il report di market intelligence completo per questo settore e cliente."
        )

        print(f"🔍 Market Intelligence — analisi '{sector}' ({client_name})...")

        response = self.claude.messages.create(
            model=self.model,
            max_tokens=8192,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text.strip()
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:].strip()

        try:
            result = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON non valido da Market Intelligence: {e}. Risposta: {raw[:300]}")

        saved = self._save_research(sector, result, task_id)
        research_id = saved.get("id", "n/a")
        print(f"✅ Market Intelligence salvata — id: {research_id}")

        return {
            "reused": False,
            "sector": sector,
            "research_id": research_id,
            "keywords_count": len(result.get("keywords", [])),
            "hashtags_count": len(result.get("hashtags", [])),
            "differentiation_gaps": result.get("differentiation_gaps", []),
        }

    def run_from_queue(self, force: bool = False) -> bool:
        task = claim_pending_task("market_intelligence")
        if not task:
            return False
        task_id = task["id"]
        client_id = task.get("client_id")
        task_force = task.get("payload", {}).get("force", force)
        try:
            result = self.run(client_id=client_id, task_id=task_id, force=task_force)
            complete_task(task_id, result)
            return True
        except Exception as e:
            fail_task(task_id, str(e))
            print(f"❌ Task market_intelligence {task_id} fallito: {e}")
            return False
