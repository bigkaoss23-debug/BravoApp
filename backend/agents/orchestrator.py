"""
Orchestratore multi-agente BRAVO.

Riceve la richiesta dalla FastAPI, capisce cosa fare,
e delega all'agente specializzato corretto.

Struttura attuale:
  - ContentDesignerAgent → genera contenuti social

Struttura futura (agenti da aggiungere):
  - CalendarAgent     → gestisce piano editoriale e scheduling
  - AnalyticsAgent    → analisi performance e ROI
  - PublisherAgent    → pubblica su Buffer/Later dopo approvazione
"""

import os
from agents.content_designer import ContentDesignerAgent
from models.content import GenerateContentRequest, GenerateContentResponse


class Orchestrator:
    """
    Punto d'ingresso centrale del sistema multi-agente.
    Ogni metodo corrisponde a un tipo di operazione.
    """

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata nel file .env")

        ideogram_key = os.getenv("IDEOGRAM_API_KEY")

        # Inizializza gli agenti disponibili
        self.content_designer = ContentDesignerAgent(
            api_key=api_key,
            ideogram_api_key=ideogram_key,
        )

        # In futuro:
        # self.calendar = CalendarAgent(api_key=api_key)
        # self.analytics = AnalyticsAgent(api_key=api_key)
        # self.publisher = PublisherAgent(api_key=api_key, buffer_key=...)

    def generate_content(self, request: GenerateContentRequest) -> GenerateContentResponse:
        """Genera contenuti social per un cliente."""
        return self.content_designer.run(request)

    # --- Metodi futuri ---
    # def get_editorial_plan(self, client_id: str, month: int, year: int):
    #     return self.calendar.run(client_id, month, year)
    #
    # def get_analytics(self, client_id: str, period: str):
    #     return self.analytics.run(client_id, period)
    #
    # def publish_content(self, content_id: str):
    #     return self.publisher.run(content_id)
