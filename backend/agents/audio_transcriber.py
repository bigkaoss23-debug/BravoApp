"""
Audio Transcriber — Groq Whisper + Claude
Trascrive un file audio dal campo e produce un contesto strutturato.

Output: testo formattato con il materiale grezzo della settimana
(tema, chi era presente, prodotti, foto disponibili, angoli narrativi).

NON mescola istruzioni editoriali di Bravo — quelle arrivano separatamente.
"""

import os
import httpx
import anthropic
from pathlib import Path


def transcribe_and_extract(audio_path: str) -> str:
    """
    1. Trascrive l'audio con Groq Whisper (in memoria, non salvato)
    2. Claude struttura il contenuto di campo in forma leggibile
    Restituisce testo pronto per la textarea "Material de campo" del frontend.
    """
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise ValueError("GROQ_API_KEY non configurata nel .env")

    suffix = Path(audio_path).suffix or ".mp3"
    mime_map = {
        ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav",
        ".ogg": "audio/ogg", ".webm": "audio/webm",
    }
    mime = mime_map.get(suffix.lower(), "audio/mpeg")

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    # ── 1. Trascrizione con Groq Whisper ────────────────────────────────────
    resp = httpx.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers={"Authorization": f"Bearer {groq_key}"},
        files={"file": (f"audio{suffix}", audio_bytes, mime)},
        data={"model": "whisper-large-v3-turbo", "response_format": "text"},
        timeout=120,
    )

    if resp.status_code != 200:
        raise ValueError(f"Groq Whisper error {resp.status_code}: {resp.text[:300]}")

    transcript = resp.text.strip()
    if not transcript:
        raise ValueError("Trascrizione vuota — verifica che l'audio contenga parlato")

    # ── 2. Claude struttura il materiale di campo ────────────────────────────
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    prompt = f"""Eres el asistente de una agencia de marketing (BRAVO) que gestiona redes sociales para clientes agrícolas.

Se te pasa la transcripción de una grabación de campo: puede ser una visita a finca, una llamada con el cliente, una reunión con técnicos o agrónomos.

Tu tarea es estructurar el CONTENIDO DE CAMPO en este formato exacto (en español):

Tema principal: [el tema central de lo que pasó, 1 frase concreta]
Productos / soluciones mostradas: [productos, técnicas o soluciones mencionadas]
Quién estaba presente: [personas — cliente, técnico, agrónomo, equipo, etc.]
Material visual disponible: [fotos, vídeos o material mencionado explícitamente]
Ángulos narrativos: [2-4 ángulos concretos que surgieron de la conversación, para posts sociales]
Frases destacadas: [1-2 citas textuales del cliente o técnico que sean potentes para un post]

Si algo no aparece en la grabación, escribe "No mencionado".

IMPORTANTE: extrae SOLO lo que está en la grabación. No añadas interpretaciones editoriales ni instrucciones. Eso lo hace Bravo por separado.

TRANSCRIPCIÓN:
{transcript}

Responde SOLO con el contenido estructurado, sin introducción ni explicación."""

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )

    return msg.content[0].text.strip()
