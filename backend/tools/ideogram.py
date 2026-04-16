"""
Tool per la generazione di immagini via Ideogram API v2.
Documentazione: https://developer.ideogram.ai
"""

import httpx
from enum import Enum


IDEOGRAM_API_URL = "https://api.ideogram.ai/generate"


class AspectRatio(str, Enum):
    SQUARE = "ASPECT_1_1"        # Post 1:1
    STORY = "ASPECT_9_16"        # Story / Reel verticale
    LANDSCAPE = "ASPECT_16_9"    # Copertina LinkedIn / YouTube


# Mappa formato contenuto → aspect ratio Ideogram
FORMAT_TO_RATIO = {
    "Post 1:1": AspectRatio.SQUARE,
    "Story 9:16": AspectRatio.STORY,
    "Portada Reel": AspectRatio.STORY,
    "Carosello": AspectRatio.SQUARE,
}


class IdeogramError(Exception):
    pass


def generate_image(
    prompt: str,
    api_key: str,
    format: str = "Post 1:1",
    negative_prompt: str = "text, letters, words, typography, watermark, logo, blurry, low quality, cartoon, illustration, fake labels, invented logos",
) -> dict:
    """
    Chiama Ideogram API e restituisce l'URL dell'immagine generata.

    Args:
        prompt: descrizione dell'immagine in inglese (dal visual_prompt dell'agente)
        api_key: chiave API Ideogram
        format: formato del contenuto (determina l'aspect ratio)
        negative_prompt: elementi da evitare nell'immagine

    Returns:
        dict con 'url' (str) e 'resolution' (str)
    """
    aspect_ratio = FORMAT_TO_RATIO.get(format, AspectRatio.SQUARE)

    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json",
    }

    payload = {
        "image_request": {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "aspect_ratio": aspect_ratio.value,
            "model": "V_2",
            "magic_prompt_option": "OFF",  # OFF = usa il prompt esatto, AUTO = Ideogram lo espande
        }
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(IDEOGRAM_API_URL, headers=headers, json=payload)

        if response.status_code != 200:
            raise IdeogramError(
                f"Ideogram API error {response.status_code}: {response.text}"
            )

        data = response.json()
        images = data.get("data", [])

        if not images:
            raise IdeogramError("Ideogram non ha restituito immagini.")

        first = images[0]
        return {
            "url": first.get("url"),
            "resolution": first.get("resolution", ""),
            "is_image_safe": first.get("is_image_safe", True),
        }

    except httpx.TimeoutException:
        raise IdeogramError("Timeout: Ideogram API ha impiegato troppo. Riprova.")
    except httpx.RequestError as e:
        raise IdeogramError(f"Errore di connessione a Ideogram: {e}")
