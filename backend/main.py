"""
BRAVO Agents — Backend FastAPI
Punto d'ingresso del server.

Avvio:
  uvicorn main:app --reload --port 8000
"""

import os
import tempfile
import httpx
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from agents.orchestrator import Orchestrator
from models.content import GenerateContentRequest, GenerateContentResponse, ContentFeedback, FeedbackResponse
from tools.feedback_store import save_feedback
from tools.pipeline import generate_variants

# Carica .env usando il path assoluto relativo a questo file
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# Orchestratore (singleton — creato una volta all'avvio)
orchestrator: Orchestrator = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inizializza le risorse all'avvio del server."""
    global orchestrator
    orchestrator = Orchestrator()
    print("✅ Orchestratore inizializzato")
    yield
    print("🔴 Server spento")


app = FastAPI(
    title="BRAVO Agents API",
    description="Sistema multi-agente AI per la produzione di contenuti social",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — permette al frontend di BRAVO di chiamare questa API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In produzione: specificare il dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================
# ENDPOINT
# =============================================

@app.get("/")
def root():
    return {
        "service": "BRAVO Agents API",
        "version": "0.1.0",
        "status": "running",
        "endpoints": {
            "generate_content": "POST /api/content/generate",
            "submit_feedback": "POST /api/content/feedback",
            "health": "GET /health",
            "docs": "GET /docs",
        }
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/content/generate", response_model=GenerateContentResponse)
def generate_content(request: GenerateContentRequest):
    """
    Genera contenuti social per un cliente.

    Esempio di body:
    {
        "brief": "crea un post sul prodotto BRAVERIA per la fase di arranque del cultivo",
        "client_id": "dakady",
        "platform": "Instagram",
        "num_contents": 1
    }
    """
    try:
        result = orchestrator.generate_content(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")


@app.post("/api/content/feedback", response_model=FeedbackResponse)
def submit_feedback(feedback: ContentFeedback):
    """
    Riceve il feedback di BRAVO su un contenuto generato.

    Esempio approvazione:
    {
        "content_id": "uuid-del-post",
        "client_id": "dakady",
        "status": "approved"
    }

    Esempio rifiuto:
    {
        "content_id": "uuid-del-post",
        "client_id": "dakady",
        "status": "rejected",
        "rejection_reason": "Il tono era troppo formale, DaKady parla in modo più diretto",
        "headline": "LA SOLUZIONE CHE CERCAVI",
        "layout_variant": "centered-header",
        "caption_preview": "In un invernadero de Almería, el equipo...",
        "agent_notes": "Ho scelto centered-header perché il brief era istituzionale"
    }

    I rifiuti vengono iniettati automaticamente nelle generazioni successive
    come 'lezioni apprese' per migliorare la qualità nel tempo.
    """
    try:
        save_feedback(feedback)
        if feedback.status == "rejected":
            msg = (
                f"Rifiuto registrato. Motivo: '{feedback.rejection_reason}' "
                "— sarà aggregato nelle lezioni per le prossime generazioni."
            )
        elif feedback.status == "approved" and feedback.liked_aspects:
            aspects = ", ".join(feedback.liked_aspects)
            msg = (
                f"Approvazione registrata. Aspetti apprezzati: {aspects} "
                "— saranno usati come pattern positivi nelle prossime generazioni."
            )
        else:
            msg = f"Feedback '{feedback.status}' salvato per content_id={feedback.content_id}"
        return FeedbackResponse(saved=True, content_id=feedback.content_id, message=msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel salvataggio feedback: {str(e)}")


# ── HELPER: Google Drive URL → direct download ──────────────────────────────

def gdrive_to_direct(url: str) -> str:
    """Converte un link Google Drive (share) in URL di download diretto."""
    import re
    m = re.search(r"/file/d/([^/]+)", url)
    if m:
        return f"https://drive.google.com/uc?export=download&id={m.group(1)}"
    return url  # già diretto o altro formato


# ── ENDPOINT: genera con foto ────────────────────────────────────────────────

@app.post("/api/content/generate-with-photo")
async def generate_with_photo(
    brief: str = Form(...),
    platform: str = Form("Instagram"),
    num_variants: int = Form(3),
    photo_url: Optional[str] = Form(None),
    photo_file: Optional[UploadFile] = File(None),
):
    """
    Genera contenuti social con immagine composita (foto reale + overlay testo).

    Accetta:
    - photo_file: upload diretto (multipart/form-data)
    - photo_url: link Google Drive o URL immagine diretta

    Restituisce i contenuti con img_b64 (JPEG base64) invece di visual_prompt.
    """
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    tmp_path = None
    try:
        # ── 1. Ottieni la foto ───────────────────────────────────────────────
        if photo_file is not None:
            # Upload diretto
            suffix = Path(photo_file.filename or "photo.jpg").suffix or ".jpg"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(await photo_file.read())
                tmp_path = tmp.name

        elif photo_url:
            # Scarica da URL (supporta Google Drive)
            direct_url = gdrive_to_direct(photo_url.strip())
            async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
                r = await client.get(direct_url)
                if r.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Impossibile scaricare la foto: HTTP {r.status_code}")
            content_type = r.headers.get("content-type", "image/jpeg")
            ext = ".jpg" if "jpeg" in content_type else (".png" if "png" in content_type else ".jpg")
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(r.content)
                tmp_path = tmp.name

        else:
            raise HTTPException(status_code=400, detail="Devi fornire photo_file oppure photo_url")

        # ── 2. Genera varianti ───────────────────────────────────────────────
        variants, _resp = generate_variants(
            anthropic_key=anthropic_key,
            photo_path=tmp_path,
            brief=brief,
            platform=platform,
            num_variants=num_variants,
        )

        return {"variants": variants}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore pipeline: {str(e)}")
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
