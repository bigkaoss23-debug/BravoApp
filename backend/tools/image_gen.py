"""
image_gen.py — Interfaccia astratta per la generazione di immagini IA.

Sostituisce il vecchio tools/ideogram.py. Il tool concreto dietro questa
interfaccia è intercambiabile: oggi Higgsfield (via MCP/CLI, on-demand,
con cancello umano), domani altro — senza toccare i chiamanti.

PRINCIPIO (manifesto BRAVO):
  La generazione di immagini IA NON è un passo automatico della catena.
  È on-demand, a lotti, con conferma umana prima che gli altri agenti
  proseguano. Per questo generate_image() qui NON chiama un'API headless:
  solleva un errore esplicito che indica il flusso corretto (batch +
  gate umano via Higgsfield MCP).

  Higgsfield non espone API key: si autentica via account attraverso
  MCP/CLI. Quindi la generazione in fase sviluppo la fa l'operatore
  (o l'agente in sessione) — non il backend in autonomia.
"""

from enum import Enum


class AspectRatio(str, Enum):
    SQUARE = "1:1"        # Post 1:1 / Carosello
    STORY = "9:16"        # Story / Reel verticale
    LANDSCAPE = "16:9"    # Copertina LinkedIn / YouTube


# Mappa formato contenuto → aspect ratio (utile anche per i prompt Higgsfield)
FORMAT_TO_RATIO = {
    "Post 1:1": AspectRatio.SQUARE,
    "Story 9:16": AspectRatio.STORY,
    "Portada Reel": AspectRatio.STORY,
    "Carosello": AspectRatio.SQUARE,
}


class ImageGenError(Exception):
    """Errore generico di generazione immagini (ex IdeogramError)."""


# Backward-compat: codice esistente importa ancora IdeogramError
IdeogramError = ImageGenError


def generate_image(
    prompt: str,
    api_key: str = "",
    format: str = "Post 1:1",
    negative_prompt: str = "",
) -> dict:
    """
    Interfaccia stabile mantenuta per i chiamanti esistenti.

    NON genera in autonomia: la generazione immagini IA è un passo
    on-demand a controllo umano (Higgsfield via MCP/CLI). Chi chiama
    deve gestire l'assenza di immagine, non aspettarsi un URL automatico.

    Ritorna sempre errore esplicito finché non è collegato il flusso
    batch Higgsfield con gate umano.
    """
    raise ImageGenError(
        "Generazione immagini non automatica. Le immagini IA si producono "
        "via Higgsfield (MCP/CLI) in modalità batch con conferma umana, "
        "non nella catena agenti. Vedi flusso catalogo foto."
    )
