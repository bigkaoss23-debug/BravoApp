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
from typing import Optional, List

from agents.orchestrator import Orchestrator
from models.content import GenerateContentRequest, GenerateContentResponse, ContentFeedback, FeedbackResponse
from tools.feedback_store import save_feedback
from tools.pdf_extractor import extract_text_from_pdf_bytes
from tools.briefing_store import get_briefing, save_briefing, delete_briefing

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
    allow_origins=[
        "https://elaborate-chaja-62ee24.netlify.app",
        "http://localhost:3000",
        "http://localhost:8080",
        "*",  # Temporaneo — rimuovere in produzione finale
    ],
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


# ── ENDPOINT: analisi brand kit con Opus ────────────────────────────────────

@app.post("/api/brand/analyze")
async def analyze_brand_kit(
    client_id: str = Form(...),
    client_name: str = Form(""),
    files: List[UploadFile] = File(...),
):
    """
    Analizza file SVG/logo con Claude Opus e salva il brand kit in Supabase.
    Salva in brand_kit_opus (colonna separata) per confronto con il kit esistente.
    """
    from agents.brand_analyzer import analyze_brand_files
    from tools.supabase_client import get_client as get_supabase

    try:
        # Leggi i file caricati
        file_list = []
        for upload in files:
            name = upload.filename or ""
            raw = await upload.read()

            if name.lower().endswith(".svg"):
                try:
                    content = raw.decode("utf-8", errors="ignore")
                    file_list.append({"name": name, "content": content, "type": "svg"})
                except Exception:
                    pass
            elif name.lower().endswith((".png", ".jpg", ".jpeg")):
                file_list.append({"name": name, "content": "", "type": "logo"})

        if not file_list:
            raise HTTPException(status_code=400, detail="Nessun file SVG o logo trovato")

        # Analisi con Opus
        brand_kit = analyze_brand_files(file_list, client_name=client_name)

        # Salva in Supabase nella colonna brand_kit_opus
        sb = get_supabase()
        sb.table("client_brand").upsert({
            "client_id": client_id,
            "brand_kit_opus": brand_kit,
            "updated_at": "now()"
        }, on_conflict="client_id").execute()

        return {"success": True, "brand_kit": brand_kit}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore analisi brand: {str(e)}")


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
        from tools.pipeline import generate_variants  # import lazy — non blocca l'avvio
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


# ============================================================
# BRIEFING cliente — testo integrale (no riassunto), per agenti AI
# ============================================================

@app.post("/api/briefing/extract-pdf")
async def briefing_extract_pdf(pdf_file: UploadFile = File(...)):
    """Estrae testo grezzo da un PDF. NON salva. Serve al frontend per
    precompilare la textarea del briefing."""
    if not pdf_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File deve essere un PDF")
    try:
        data = await pdf_file.read()
        text = extract_text_from_pdf_bytes(data)
        if not text:
            raise HTTPException(
                status_code=422,
                detail="Nessun testo estraibile dal PDF (scannerizzato?). Serve OCR.",
            )
        return {
            "filename": pdf_file.filename,
            "char_count": len(text),
            "briefing_text": text,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore estrazione PDF: {e}")


@app.get("/api/briefing/{client_id}")
async def briefing_get(client_id: str):
    row = get_briefing(client_id)
    if not row:
        return {"exists": False, "client_id": client_id}
    return {"exists": True, **row}


@app.post("/api/briefing/{client_id}")
async def briefing_save(
    client_id: str,
    briefing_text: str = Form(...),
    source: str = Form("manual"),
    source_filename: Optional[str] = Form(None),
    updated_by: Optional[str] = Form(None),
):
    if not briefing_text.strip():
        raise HTTPException(status_code=400, detail="briefing_text vuoto")
    if source not in ("pdf", "manual"):
        raise HTTPException(status_code=400, detail="source deve essere 'pdf' o 'manual'")
    try:
        row = save_briefing(
            client_id=client_id,
            briefing_text=briefing_text,
            source=source,
            source_filename=source_filename,
            updated_by=updated_by,
        )
        return {"ok": True, **row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore salvataggio: {e}")


@app.delete("/api/briefing/{client_id}")
async def briefing_delete(client_id: str):
    delete_briefing(client_id)
    return {"ok": True}
