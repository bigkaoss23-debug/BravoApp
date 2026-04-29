"""
BRAVO Agents — Backend FastAPI
Punto d'ingresso del server.

Avvio:
  uvicorn main:app --reload --port 8000
"""

import os
import json
import base64
import tempfile
import httpx
from datetime import date
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

from agents.orchestrator import Orchestrator
from models.content import GenerateContentRequest, GenerateContentResponse, ContentFeedback, FeedbackResponse
from tools.feedback_store import save_feedback
from tools.pdf_extractor import extract_text_from_pdf_bytes, extract_text_from_file_bytes
from tools.briefing_store import get_briefing, save_briefing, delete_briefing
from tools.briefing_analyzer import run_for_client

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
        "http://localhost:3001",
        "http://localhost:8080",
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


@app.get("/api/config")
def get_public_config():
    return {
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_key": os.getenv("SUPABASE_KEY", ""),
    }


@app.post("/api/content/generate", response_model=GenerateContentResponse)
def generate_content(request: GenerateContentRequest):
    """
    Genera contenuti social per un cliente.

    Esempio di body:
    {
        "brief": "crea un post motivazionale per il lancio del nuovo programma",
        "client_id": "altair",
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
        "client_id": "altair",
        "status": "approved"
    }

    Esempio rifiuto:
    {
        "content_id": "uuid-del-post",
        "client_id": "altair",
        "status": "rejected",
        "rejection_reason": "Il tono non rispecchia il brand — troppo formale",
        "headline": "STRENGHT DAY",
        "layout_variant": "centered-header",
        "caption_preview": "Esta semana el equipo...",
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


# ── ENDPOINT: crea nuovo cliente ────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class CreateClientRequest(_BaseModel):
    name: str
    sector: str = ""
    city: str = ""
    instagram: str = ""
    client_key: str


@app.post("/api/clients/create")
async def create_client(req: CreateClientRequest):
    """
    Crea un nuovo cliente in Supabase (tabella clients + riga vuota client_brand).
    """
    import re, uuid
    from tools.supabase_client import get_client as get_sb

    key = re.sub(r'[^a-z0-9]', '', req.client_key.lower())
    if not req.name.strip() or not key:
        raise HTTPException(status_code=400, detail="name e client_key sono obbligatori.")

    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile.")

    # Controlla se client_key già esiste
    existing = sb.table("clients").select("id").eq("client_key", key).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"client_key '{key}' già in uso.")

    # Genera UUID deterministico basato sul key
    new_id = str(uuid.uuid4())

    # Crea riga in clients
    sb.table("clients").insert({
        "id":          new_id,
        "name":        req.name.strip(),
        "sector":      req.sector.strip(),
        "city":        req.city.strip(),
        "instagram":   req.instagram.strip(),
        "client_key":  key,
        "description": "",
    }).execute()

    # Crea riga vuota in client_brand
    sb.table("client_brand").insert({
        "client_id": new_id,
        "colors":    [],
        "fonts":     [],
        "templates": [],
        "pillars":   [],
        "layouts":   [],
        "notes":     "",
    }).execute()

    return {
        "ok": True,
        "client": {
            "id":         new_id,
            "name":       req.name.strip(),
            "sector":     req.sector.strip(),
            "city":       req.city.strip(),
            "instagram":  req.instagram.strip(),
            "client_key": key,
            "description": "",
        }
    }


# ── ENDPOINT: analisi brand kit con Opus ────────────────────────────────────

@app.post("/api/brand/analyze")
async def analyze_brand_kit(
    client_id: str = Form(...),
    client_name: str = Form(""),
    files: List[UploadFile] = File(default=[]),
    logo_file: Optional[UploadFile] = File(None),
    ref_files: List[UploadFile] = File(default=[]),
):
    """
    Analizza file SVG/logo/post di riferimento con Claude Opus e salva il brand kit in Supabase.
    - files       → SVG dei layout (flusso "Aggiorna Brand Kit" classico)
    - logo_file   → unico file logo (PNG/JPG)
    - ref_files   → fino a 3 post Instagram di riferimento
    """
    from agents.brand_analyzer import analyze_brand_files
    from tools.supabase_client import get_client as get_supabase

    try:
        file_list = []

        # SVG (flusso modal)
        for upload in files:
            name = upload.filename or ""
            raw = await upload.read()
            if name.lower().endswith(".svg"):
                try:
                    content = raw.decode("utf-8", errors="ignore")
                    file_list.append({"name": name, "content": content, "type": "svg"})
                except Exception:
                    pass
            elif name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                # back-compat: immagini nel campo "files" trattate come logo
                file_list.append({
                    "name": name,
                    "content": base64.b64encode(raw).decode(),
                    "type": "logo",
                })

        # Logo dedicato
        logo_b64_str: Optional[str] = None
        if logo_file is not None:
            raw = await logo_file.read()
            if raw:
                logo_b64_str = base64.b64encode(raw).decode()
                file_list.append({
                    "name": logo_file.filename or "logo",
                    "content": logo_b64_str,
                    "type": "logo",
                })

        # Post IG di riferimento
        ref_b64_list: List[str] = []
        for rf in ref_files:
            raw = await rf.read()
            if not raw:
                continue
            b64 = base64.b64encode(raw).decode()
            ref_b64_list.append(b64)
            file_list.append({
                "name": rf.filename or "ref",
                "content": b64,
                "type": "ref",
            })

        if not file_list:
            raise HTTPException(status_code=400, detail="Nessun file da analizzare")

        # Analisi con Opus
        brand_kit = analyze_brand_files(file_list, client_name=client_name)

        # Fallback: se non è arrivato un logo dedicato, prendi il primo logo trovato in `files`
        if not logo_b64_str:
            legacy_logo = next((f for f in file_list if f["type"] == "logo"), None)
            if legacy_logo:
                logo_b64_str = legacy_logo["content"]

        # Salva in Supabase
        sb = get_supabase()
        upsert_data = {
            "client_id": client_id,
            "brand_kit_opus": brand_kit,
            "updated_at": "now()",
        }
        if logo_b64_str:
            upsert_data["logo_b64"] = logo_b64_str
        if ref_b64_list:
            upsert_data["ig_refs_b64"] = ref_b64_list

        sb.table("client_brand").upsert(upsert_data, on_conflict="client_id").execute()

        return {
            "success": True,
            "brand_kit": brand_kit,
            "logo_saved": bool(logo_b64_str),
            "refs_saved": len(ref_b64_list),
        }

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
    client_id: str = Form(...),
    platform: str = Form("Instagram"),
    num_variants: int = Form(3),
    photo_url: Optional[str] = Form(None),
    photo_file: Optional[UploadFile] = File(None),
    photo_files: List[UploadFile] = File(default=[]),   # multi-foto
    photo_briefs: Optional[str] = Form(None),           # JSON array sub-brief per foto
    content_format: str = Form("Post 1:1"),             # es. "Carosello", "Post 1:1"
):
    """
    Genera contenuti social con immagine composita (foto reale + overlay testo).

    Modalità:
    - 1 foto  → N varianti della stessa foto (comportamento originale)
    - 2-5 foto → 1 post per foto (piano settimanale)

    Accetta:
    - photo_file / photo_files: upload diretto (multipart/form-data)
    - photo_url: link Google Drive o URL immagine diretta
    - photo_briefs: JSON array con sub-brief per ogni foto (opzionale)
    """
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    # ── Raccogli tutte le foto ───────────────────────────────────────────────
    all_uploads: list[UploadFile] = []
    if photo_file is not None:
        all_uploads.append(photo_file)
    all_uploads.extend([f for f in (photo_files or []) if f and f.filename])

    tmp_paths: list[str] = []
    try:
        # ── Caso URL singolo (Google Drive / link diretto) ───────────────────
        if not all_uploads and photo_url:
            direct_url = gdrive_to_direct(photo_url.strip())
            async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
                r = await client.get(direct_url)
                if r.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Impossibile scaricare la foto: HTTP {r.status_code}")
            content_type = r.headers.get("content-type", "image/jpeg")
            ext = ".jpg" if "jpeg" in content_type else (".png" if "png" in content_type else ".jpg")
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(r.content)
                tmp_paths.append(tmp.name)

        elif all_uploads:
            # Salva ogni foto in un file temporaneo
            for upload in all_uploads:
                suffix = Path(upload.filename or "photo.jpg").suffix or ".jpg"
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(await upload.read())
                    tmp_paths.append(tmp.name)
        else:
            raise HTTPException(status_code=400, detail="Devi fornire almeno una foto")

        from tools.pipeline import generate_variants, generate_multi_photo_variants

        is_carousel = "caros" in content_format.lower()

        if len(tmp_paths) == 1:
            # ── 1 foto: N varianti ────────────────────────────────────────────
            variants, _ = generate_variants(
                anthropic_key=anthropic_key,
                photo_path=tmp_paths[0],
                brief=brief,
                client_id=client_id,
                platform=platform,
                num_variants=num_variants,
                content_format=content_format,
            )
        elif is_carousel:
            # ── Carosello multi-foto: 1 slide per foto, testo da carosello ────
            briefs_list: list[str] = []
            if photo_briefs:
                try:
                    briefs_list = json.loads(photo_briefs)
                except Exception:
                    briefs_list = []
            while len(briefs_list) < len(tmp_paths):
                briefs_list.append("")

            variants = generate_multi_photo_variants(
                anthropic_key=anthropic_key,
                photo_paths=tmp_paths,
                photo_briefs=briefs_list,
                global_brief=brief,
                client_id=client_id,
                platform=platform,
                content_format="Carosello",
            )
        else:
            # ── Multi-foto: 1 post indipendente per foto ──────────────────────
            briefs_list: list[str] = []
            if photo_briefs:
                try:
                    briefs_list = json.loads(photo_briefs)
                except Exception:
                    briefs_list = []
            while len(briefs_list) < len(tmp_paths):
                briefs_list.append("")

            variants = generate_multi_photo_variants(
                anthropic_key=anthropic_key,
                photo_paths=tmp_paths,
                photo_briefs=briefs_list,
                global_brief=brief,
                client_id=client_id,
                platform=platform,
            )

        return {"variants": variants}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore pipeline: {str(e)}")
    finally:
        for p in tmp_paths:
            try:
                os.unlink(p)
            except Exception:
                pass


# ============================================================
# CAROSELLO Instagram — genera HTML carosello dal brand kit
# ============================================================

@app.post("/api/content/generate-carousel")
async def generate_carousel_endpoint(
    brief: str = Form(...),
    client_id: str = Form(...),
    num_slides: int = Form(6),
    topic: str = Form(""),
):
    """
    Genera un carosello Instagram completo HTML per il cliente.

    Input:
      - brief: tema/argomento del carosello
      - client_id: ID cliente (es. 'cc000002-...' o 'altair')
      - num_slides: numero slide (5-8, default 6)
      - topic: argomento specifico opzionale

    Output:
      { carousel_html, slides, caption, error }
    """
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    num_slides = max(5, min(8, num_slides))

    from tools.pipeline import generate_carousel
    result = generate_carousel(
        anthropic_key=anthropic_key,
        brief=brief,
        client_id=client_id,
        num_slides=num_slides,
        topic=topic,
    )

    if result.get("error"):
        raise HTTPException(status_code=500, detail=f"Errore carosello: {result['error']}")

    return result


# ============================================================
# BRIEFING cliente — testo integrale (no riassunto), per agenti AI
# ============================================================

@app.post("/api/briefing/extract-pdf")
async def briefing_extract_pdf(pdf_file: UploadFile = File(...)):
    """Estrae testo grezzo da un PDF o DOCX. NON salva. Serve al frontend per
    precompilare la textarea del briefing."""
    fname = (pdf_file.filename or "").lower()
    if not (fname.endswith(".pdf") or fname.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Formato non supportato. Carica un PDF o un file Word (.docx)")
    try:
        data = await pdf_file.read()
        text = extract_text_from_file_bytes(data, pdf_file.filename)
        if not text:
            raise HTTPException(
                status_code=422,
                detail="Nessun testo estraibile dal file. Controlla che non sia vuoto o scannerizzato.",
            )
        return {
            "filename": pdf_file.filename,
            "char_count": len(text),
            "briefing_text": text,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore estrazione file: {e}")


@app.get("/api/briefing/{client_id}")
async def briefing_get(client_id: str):
    row = get_briefing(client_id)
    if not row:
        return {"exists": False, "client_id": client_id}
    return {"exists": True, **row}


@app.post("/api/briefing/{client_id}")
async def briefing_save(
    client_id: str,
    background_tasks: BackgroundTasks,
    briefing_text: str = Form(...),
    source: str = Form("manual"),
    source_filename: Optional[str] = Form(None),
    updated_by: Optional[str] = Form(None),
    briefing_file: Optional[UploadFile] = File(None),
):
    if not briefing_text.strip():
        raise HTTPException(status_code=400, detail="briefing_text vuoto")
    if source not in ("pdf", "manual"):
        raise HTTPException(status_code=400, detail="source deve essere 'pdf' o 'manual'")

    file_url: Optional[str] = None

    # Se è stato caricato un file, lo salviamo su Supabase Storage
    if briefing_file and briefing_file.filename:
        try:
            from tools.supabase_client import get_client as get_supabase
            sb = get_supabase()
            ext = Path(briefing_file.filename).suffix or ".pdf"
            storage_path = f"briefings/{client_id}/briefing{ext}"
            file_bytes = await briefing_file.read()
            # Rimuovi eventuale file precedente (best-effort)
            try:
                sb.storage.from_("bravo-content").remove([storage_path])
            except Exception:
                pass
            sb.storage.from_("bravo-content").upload(
                storage_path,
                file_bytes,
                {"content-type": briefing_file.content_type or "application/octet-stream", "upsert": "true"},
            )
            url_resp = sb.storage.from_("bravo-content").get_public_url(storage_path)
            file_url = url_resp if isinstance(url_resp, str) else (url_resp.get("publicUrl") or url_resp.get("publicURL") or "")
        except Exception as e:
            # Non blocchiamo il salvataggio del testo se lo storage fallisce
            file_url = None

    try:
        row = save_briefing(
            client_id=client_id,
            briefing_text=briefing_text,
            source=source,
            source_filename=source_filename,
            updated_by=updated_by,
            file_url=file_url,
        )
        background_tasks.add_task(run_for_client, client_id, briefing_text)
        return {"ok": True, "analyzing": True, **row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore salvataggio: {e}")


@app.delete("/api/briefing/{client_id}")
async def briefing_delete(client_id: str):
    delete_briefing(client_id)
    return {"ok": True}


def _run_distill_all_bg():
    result = run_migration_all_clients()
    print(f"📋 distill-all completato: {result.get('processed',0)} elaborati, {result.get('skipped',0)} saltati, {result.get('failed',0)} errori")


@app.post("/api/briefing/distill-all")
async def briefing_distill_all(background_tasks: BackgroundTasks):
    """
    Migrazione: genera il briefing distillato per tutti i clienti che non ce l'hanno ancora.
    Sicuro da chiamare più volte — salta i clienti già distillati.
    """
    background_tasks.add_task(_run_distill_all_bg)
    return {"ok": True, "message": "Distillazione avviata in background per tutti i clienti senza distillato."}


# ============================================================
# TEAM TASKS — Livello 2: AI suggerisce task dal briefing
# ============================================================

class SuggestTasksRequest(_BaseModel):
    client_id: str
    member_name: str
    member_role: str
    member_detail: str = ""

# ============================================================
# PROFILE EXTRACTION — estrae dati strutturati dal briefing
# ============================================================

@app.post("/api/briefing/extract-profile/{client_id}")
async def extract_client_profile(client_id: str):
    """
    Legge il briefing del cliente e estrae dati strutturati:
    team BRAVO, persone chiave, storico, obiettivi, strategia,
    partner/marchi, scope e limitazioni.
    Salva su Supabase in client_profile.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    from tools.briefing_store import get_briefing as _get_briefing
    from tools.brand_store import _resolve_client_uuid
    from tools.supabase_client import get_client as get_sb
    import anthropic as _anthropic, json as _json

    client_uuid = _resolve_client_uuid(client_id)
    row = _get_briefing(client_uuid) or _get_briefing(client_id)
    briefing_text = (row or {}).get("briefing_text", "")
    if not briefing_text:
        raise HTTPException(status_code=404, detail="Nessun briefing trovato per questo cliente")

    prompt = f"""Analizza questo briefing di agenzia e estrai le informazioni in formato JSON strutturato.

BRIEFING:
{briefing_text[:12000]}

Responde SOLO con este JSON (ningún texto fuera del JSON):
{{
  "team_bravo": [
    {{"name": "...", "role": "...", "detail": "..."}}
  ],
  "key_contacts": [
    {{"name": "...", "role": "...", "description": "..."}}
  ],
  "history": "Testo narrativo dello storico del cliente e del lavoro svolto. Max 300 parole.",
  "objectives": [
    "Obiettivo 1 concreto",
    "Obiettivo 2 concreto"
  ],
  "strategy": "Testo della strategia editoriale e di comunicazione. Max 300 parole.",
  "editorial_pillars": [
    {{"name": "...", "description": "...", "percentage": 0}}
  ],
  "scope": [
    "Cosa fa BRAVO per questo cliente - punto 1",
    "Cosa fa BRAVO per questo cliente - punto 2"
  ],
  "out_of_scope": [
    "Cosa NON fa BRAVO o cosa è fuori dal progetto attuale"
  ],
  "partners": [
    {{"name": "...", "category": "...", "description": "..."}}
  ]
}}"""

    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()

    # Estrai JSON robusto
    import re as _re
    match = _re.search(r'\{.*\}', raw, _re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Risposta AI non valida")
    profile = _json.loads(match.group(0))

    # Salva su Supabase
    sb = get_sb()
    if sb:
        sb.table("client_profile").upsert({
            "client_id": client_uuid,
            "team_bravo":        profile.get("team_bravo", []),
            "key_contacts":      profile.get("key_contacts", []),
            "history":           profile.get("history", ""),
            "objectives":        profile.get("objectives", []),
            "strategy":          profile.get("strategy", ""),
            "editorial_pillars": profile.get("editorial_pillars", []),
            "scope":             profile.get("scope", []),
            "out_of_scope":      profile.get("out_of_scope", []),
            "partners":          profile.get("partners", []),
            "updated_at":        "now()"
        }, on_conflict="client_id").execute()

    return {"ok": True, "profile": profile, "client_id": client_uuid}


@app.get("/api/briefing/profile/{client_id}")
async def get_client_profile(client_id: str):
    """Legge il profilo estratto dal briefing."""
    from tools.brand_store import _resolve_client_uuid
    from tools.supabase_client import get_client as get_sb
    client_uuid = _resolve_client_uuid(client_id)
    sb = get_sb()
    if not sb:
        return {"exists": False}
    res = sb.table("client_profile").select("*").eq("client_id", client_uuid).limit(1).execute()
    if res.data:
        return {"exists": True, "profile": res.data[0]}
    return {"exists": False, "client_id": client_uuid}


@app.post("/api/briefing/extract-projects/{client_id}")
async def extract_client_projects(client_id: str, background_tasks: BackgroundTasks):
    """
    Rilancia l'analisi completa di Opus sul briefing del cliente (background).
    Risponde subito con analyzing=True — il frontend aspetta e poi ricarica.
    """
    from tools.briefing_store import get_briefing as _get_briefing
    from tools.brand_store import _resolve_client_uuid
    from tools.briefing_analyzer import run_for_client as _analyze

    client_uuid = _resolve_client_uuid(client_id)
    row = _get_briefing(client_uuid) or _get_briefing(client_id)
    briefing_text = (row or {}).get("briefing_text", "")
    if not briefing_text:
        raise HTTPException(status_code=404, detail="Nessun briefing trovato per questo cliente")

    background_tasks.add_task(_analyze, client_uuid, briefing_text)
    return {"ok": True, "analyzing": True, "client_id": client_uuid}


@app.get("/api/briefing/projects/{client_id}")
async def get_client_projects(client_id: str):
    """Lee los proyectos extraídos del briefing desde Supabase."""
    from tools.brand_store import _resolve_client_uuid
    from tools.supabase_client import get_client as get_sb
    client_uuid = _resolve_client_uuid(client_id)
    sb = get_sb()
    if not sb:
        return {"exists": False, "projects": []}
    res = sb.table("client_projects").select("*").eq("client_id", client_uuid).execute()
    rows = res.data or []
    return {"exists": bool(rows), "projects": rows, "client_id": client_uuid}


@app.post("/api/briefing/extract-content-types/{client_id}")
async def extract_content_types(client_id: str):
    """
    Legge il briefing del cliente e genera automaticamente i suoi angoli narrativi
    (content_types) usando Claude. Salva il risultato in client_brand.content_types.
    Funziona per qualsiasi cliente.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    from tools.briefing_store import get_briefing as _get_briefing
    from tools.brand_store import _resolve_client_uuid, get_client_info
    from tools.supabase_client import get_client as get_sb
    import anthropic as _anthropic, json as _json, re as _re

    client_uuid = _resolve_client_uuid(client_id)
    row = _get_briefing(client_uuid) or _get_briefing(client_id)
    briefing_text = (row or {}).get("briefing_text", "")
    if not briefing_text:
        raise HTTPException(status_code=404, detail="Nessun briefing trovato per questo cliente")

    client_info = get_client_info(client_id)
    name   = client_info.get("name", client_id)
    sector = client_info.get("sector", "")

    prompt = f"""Eres un experto en content strategy para redes sociales.
Analiza este briefing de agencia para el cliente "{name}" (sector: {sector})
y genera una lista de 8-12 "ángulos narrativos" (tipos de post) adecuados para su marca y sector.

BRIEFING:
{briefing_text[:12000]}

Para cada ángulo narrativo responde con este JSON (array, ningún texto fuera):
[
  {{
    "name": "Nombre corto del ángulo (ej: Testimonio, TRAMPA, Product Showcase)",
    "when_to_use": "Descripción concreta de cuándo usarlo — situación específica, formato recomendado",
    "tone": "Tono de voz específico para este tipo de post",
    "example_headline": "UN EJEMPLO DE HEADLINE EN MAYÚSCULAS para este ángulo"
  }}
]

REGLAS:
- Nombres cortos y claros (máx 2-3 palabras)
- Adapta cada ángulo al sector y tono específico de {name}
- Incluye siempre: un ángulo educativo, uno de testimonio, uno institucional, uno de alta viralidad (tipo TRAMPA)
- example_headline vacío ("") solo para ángulos puramente visuales (ej. Logo Puro)
- Responde SOLO con el array JSON, cero texto fuera"""

    ai = _anthropic.Anthropic(api_key=api_key)
    response = ai.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()

    match = _re.search(r'\[.*\]', raw, _re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Risposta AI non valida")
    content_types = _json.loads(match.group(0))

    sb = get_sb()
    if sb:
        sb.table("client_brand").update({
            "content_types": content_types
        }).eq("client_id", client_uuid).execute()

    return {"ok": True, "client_id": client_uuid, "content_types": content_types}


@app.patch("/api/briefing/projects/{project_id}")
async def update_project_status(project_id: str, body: dict):
    """Actualiza status, fechas, asignación y presupuesto de un proyecto."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")

    update_data = {}

    if "status" in body:
        allowed = {"aprobado", "rechazado", "propuesto", "editado", "planificado"}
        status = body.get("status")
        if status not in allowed:
            raise HTTPException(status_code=400, detail="Status non valido")
        update_data["status"] = status

    # Campos de planificación y edición
    for field in ["start_date", "end_date", "assigned_to", "budget_eur",
                  "title", "description", "category", "month_target", "deliverable"]:
        if field in body:
            update_data[field] = body[field]

    if update_data:
        sb.table("client_projects").update(update_data).eq("id", project_id).execute()

    return {"ok": True}



# ── PROJECT TASKS ──────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/tasks")
async def get_project_tasks(project_id: str):
    """Lee todas las tareas de un proyecto."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        return {"ok": False, "tasks": []}
    res = (
        sb.table("project_tasks")
        .select("*")
        .eq("project_id", project_id)
        .order("order_index")
        .execute()
    )
    return {"ok": True, "tasks": res.data or []}


@app.post("/api/projects/{project_id}/tasks")
async def create_project_task(project_id: str, body: dict):
    """Crea una nueva tarea para un proyecto."""
    from tools.supabase_client import get_client as get_sb
    import uuid as _uuid
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")

    client_id = body.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="client_id richiesto")

    row = {
        "id": str(_uuid.uuid4()),
        "project_id": project_id,
        "client_id": client_id,
        "title": body.get("title", "Nueva tarea"),
        "description": body.get("description", ""),
        "role": body.get("role"),
        "assigned_to": body.get("assigned_to"),
        "start_date": body.get("start_date"),
        "end_date": body.get("end_date"),
        "status": body.get("status", "pendiente"),
        "priority": body.get("priority", "normal"),
        "order_index": body.get("order_index", 0),
        "deliverable_url": body.get("deliverable_url"),
    }
    res = sb.table("project_tasks").insert(row).execute()
    task = res.data[0] if res.data else row
    return {"ok": True, "task": task}


@app.patch("/api/projects/tasks/{task_id}")
async def update_project_task(task_id: str, body: dict):
    """Actualiza una tarea (status, fechas, responsable, etc.)."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")

    allowed_fields = [
        "title", "description", "role", "assigned_to",
        "start_date", "end_date", "status", "priority",
        "order_index", "deliverable_url",
    ]
    update_data = {k: body[k] for k in allowed_fields if k in body}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    sb.table("project_tasks").update(update_data).eq("id", task_id).execute()
    return {"ok": True}


@app.delete("/api/projects/tasks/{task_id}")
async def delete_project_task(task_id: str):
    """Elimina una tarea."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")
    sb.table("project_tasks").delete().eq("id", task_id).execute()
    return {"ok": True}


@app.post("/api/projects/{project_id}/suggest-tasks")
async def suggest_project_tasks(project_id: str, body: dict):
    """
    Genera un breakdown di tareas con Claude basandosi su
    titolo, descrizione e categoria del progetto.
    """
    import anthropic as _anthropic, json as _json, re as _re
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    title = body.get("title", "")
    description = body.get("description", "")
    category = body.get("category", "")
    client_id = body.get("client_id", "")
    briefing_snippet = body.get("briefing_snippet", "")

    templates = {
        "CONTENIDO": ["estrategia", "copy", "diseño", "publicación"],
        "PUBLICIDAD": ["estrategia", "copy", "diseño", "ads", "reporting"],
        "CAMPAÑA":    ["estrategia", "copy", "diseño", "ads", "publicación", "reporting"],
        "ALIANZAS":   ["gestión", "copy", "publicación"],
        "SEO LOCAL":  ["estrategia", "diseño", "reporting"],
        "CONVERSIÓN": ["estrategia", "copy", "ads", "reporting"],
    }
    cat_key = category.upper().split()[0] if category else ""
    roles_hint = templates.get(cat_key, ["estrategia", "copy", "diseño", "publicación"])

    # Legge il team BRAVO da Supabase (unica fonte di verità)
    from tools.supabase_client import get_client as get_sb
    _sb = get_sb()
    team_lines = []
    if _sb:
        _tm = _sb.table("team_members").select("name,role,responsibilities,skills_detail").eq("active", True).order("order_index").execute()
        for m in (_tm.data or []):
            resp = ", ".join(m.get("responsibilities") or []) or m.get("role", "")
            detail = m.get("skills_detail", "")
            short = detail[:120] if detail else ""
            team_lines.append(f"- {m['name']} ({resp}){': ' + short if short else ''}")
    if not team_lines:
        team_lines = ["- Vicente Palazzolo (estrategia, comercial)", "- Carlos Lage (foto, video)", "- Andrea Valdivia (social, publicación)", "- Mari Almendros (brand, diseño)", "- Agente Copywriter (copy, caption, hashtags)", "- Agente Designer (diseño, imagen, overlay)", "- Agente Strategist (estrategia, editorial)"]

    prompt = f"""Eres el sistema de planificación de BRAVO, una agencia de marketing.
Para el siguiente proyecto, genera un breakdown de tareas operativas.

PROYECTO: {title}
DESCRIPCIÓN: {description}
CATEGORÍA: {category}
ROLES SUGERIDOS PARA ESTA CATEGORÍA: {', '.join(roles_hint)}
CONTEXTO BRIEFING: {briefing_snippet[:800] if briefing_snippet else 'No disponible'}

EQUIPO BRAVO disponible:
{chr(10).join(team_lines)}

Genera entre 3 y 6 tareas concretas y asigna cada una al miembro más adecuado.
Propón fechas relativas en días desde hoy (ej: start_offset=0, duration_days=3).

Responde SOLO con un array JSON:
[
  {{
    "title": "Nombre corto de la tarea",
    "description": "Qué hay que hacer exactamente",
    "role": "uno de: estrategia|copy|diseño|video|ads|publicación|reporting|gestión",
    "assigned_to": "nombre completo del miembro",
    "start_offset": 0,
    "duration_days": 3,
    "priority": "alta|normal|baja"
  }}
]"""

    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    m = _re.search(r"\[.*\]", raw, _re.DOTALL)
    if not m:
        raise HTTPException(status_code=500, detail="Risposta AI non valida")
    tasks = _json.loads(m.group(0))
    return {"ok": True, "tasks": tasks, "project_id": project_id}


@app.get("/api/clients/{client_id}/tasks")
async def get_client_all_tasks(client_id: str):
    """Lee TODAS las tareas de todos los proyectos de un cliente (para Gantt y Equipo)."""
    from tools.supabase_client import get_client as get_sb
    from tools.brand_store import _resolve_client_uuid
    sb = get_sb()
    if not sb:
        return {"ok": False, "tasks": []}
    client_uuid = _resolve_client_uuid(client_id)
    res = (
        sb.table("project_tasks")
        .select("*, client_projects(title, category, status)")
        .eq("client_id", client_uuid)
        .order("start_date", desc=False)
        .execute()
    )
    return {"ok": True, "tasks": res.data or [], "client_id": client_uuid}


@app.get("/api/team/tasks")
async def get_all_team_tasks():
    """Lee TODAS las tareas del equipo (todos los clientes) para vista Gantt global."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        return {"ok": False, "tasks": []}
    res = (
        sb.table("project_tasks")
        .select("*, client_projects(title, category, client_id)")
        .order("start_date", desc=False)
        .execute()
    )
    return {"ok": True, "tasks": res.data or []}


# ── FINE PROJECT TASKS ─────────────────────────────────────────────────────────


# ============================================================
# TEAM MEMBERS — lettura da Supabase (unica fonte di verità)
# ============================================================

@app.get("/api/team/members")
async def get_team_members():
    """
    Restituisce tutti i membri attivi del team BRAVO da Supabase,
    ordinati per order_index. Usato dal frontend come cache globale.
    """
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")
    res = sb.table("team_members").select("*").eq("active", True).order("order_index").execute()
    return {"ok": True, "members": res.data or []}


@app.get("/api/team/auto-assign/{client_id}")
async def auto_assign_team(client_id: str):
    """
    Legge il briefing del cliente ed estrae automaticamente
    i nomi del team BRAVO menzionati — restituisce la lista da assegnare.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    from tools.briefing_store import get_briefing as _get_briefing
    from tools.brand_store import _resolve_client_uuid
    import anthropic as _anthropic, json as _json, re as _re

    client_uuid = _resolve_client_uuid(client_id)
    row = _get_briefing(client_uuid) or _get_briefing(client_id)
    briefing_text = (row or {}).get("briefing_text", "")
    if not briefing_text:
        return {"ok": True, "assigned_members": [], "client_id": client_id}

    # Legge i nomi del team da Supabase (non più hardcoded)
    from tools.supabase_client import get_client as get_sb
    _sb = get_sb()
    known_members = ["Vicente Palazzolo", "Carlos Lage", "Andrea Valdivia", "Mari Almendros"]  # fallback
    if _sb:
        _tm = _sb.table("team_members").select("name").eq("active", True).execute()
        if _tm.data:
            known_members = [m["name"] for m in _tm.data]

    prompt = f"""Analizza questo briefing e dimmi quali dei seguenti membri del team BRAVO sono menzionati come assegnati a questo cliente.

MEMBRI DA CERCARE: {', '.join(known_members)}

BRIEFING (prime 4000 caratteri):
{briefing_text[:4000]}

Responde SOLO con un array JSON de los nombres encontrados, exactamente como están escritos arriba.
Ejemplo: ["Carlos Lage", "Andrea Valdivia"]"""

    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()
    match = _re.search(r'\[.*\]', raw, _re.DOTALL)
    assigned = _json.loads(match.group(0)) if match else []

    return {"ok": True, "assigned_members": assigned, "client_id": client_id}


@app.post("/api/team/suggest-tasks")
async def suggest_team_tasks(req: SuggestTasksRequest):
    """
    Legge il briefing del cliente e suggerisce 3-5 task concreti
    per il membro del team in base al suo ruolo.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    from tools.briefing_store import get_briefing as _get_briefing
    from tools.brand_store import _resolve_client_uuid
    import anthropic as _anthropic

    client_uuid = _resolve_client_uuid(req.client_id)
    row = _get_briefing(client_uuid) or _get_briefing(req.client_id)
    briefing_text = (row or {}).get("briefing_text", "")

    briefing_block = f"\n\nBRIEFING DEL CLIENTE:\n{briefing_text[:6000]}" if briefing_text else ""

    prompt = f"""Eres un coordinador de agencia creativa.
Analiza el rol de este miembro del equipo y el briefing del cliente, luego sugiere exactamente 4 tareas concretas y específicas que esta persona debería hacer para este cliente.

MIEMBRO: {req.member_name}
ROL: {req.member_role}
ESPECIALIDAD: {req.member_detail}{briefing_block}

Responde SOLO con un array JSON de 4 cadenas cortas (máx 12 palabras cada una), sin texto adicional.
Ejemplo: ["Filmar visita técnica en campo esta semana", "Editar reel del equipo esta semana", ...]"""

    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()

    import json as _json, re as _re
    match = _re.search(r'\[.*\]', raw, _re.DOTALL)
    tasks = _json.loads(match.group(0)) if match else []

    return {"ok": True, "tasks": tasks, "member": req.member_name}


# ============================================================
# CONTESTO SETTIMANALE — input settimanale per lo Stratega
# ============================================================

@app.get("/api/agents/weekly-context/{client_id}")
async def get_weekly_context(client_id: str, week_start: Optional[str] = None):
    """
    Legge il contesto settimanale di un cliente.
    Se week_start non specificato, ritorna il più recente.
    """
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")
    query = sb.table("weekly_contexts").select("*").eq("client_id", client_id)
    if week_start:
        query = query.eq("week_start", week_start)
    else:
        query = query.order("week_start", desc=True)
    resp = query.limit(1).execute()
    rows = resp.data or []
    return {"exists": bool(rows), "data": rows[0] if rows else None}


@app.post("/api/agents/weekly-context/{client_id}")
async def save_weekly_context(
    client_id: str,
    week_start: str = Form(...),
    nota_campo: str = Form(""),
    istruzioni_bravo: str = Form(""),
    note_aggiuntive: str = Form(""),  # legacy — mantenuto per compatibilità
):
    """
    Salva (upsert) il contesto settimanale per un cliente.
    - nota_campo: materiale grezzo dal campo (trascrizione audio, appunti visita)
    - istruzioni_bravo: istruzioni editoriali di Bravo (quante uscite, restrizioni, ecc.)
    Un record per cliente per settimana.
    """
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")
    payload = {
        "client_id": client_id,
        "week_start": week_start,
        "nota_campo": nota_campo,
        "istruzioni_bravo": istruzioni_bravo,
        "note_aggiuntive": note_aggiuntive or nota_campo,  # legacy fallback
        "updated_at": "now()",
    }
    resp = sb.table("weekly_contexts").upsert(payload, on_conflict="client_id,week_start").execute()
    rows = resp.data or []
    return {"ok": True, "data": rows[0] if rows else payload}


# ============================================================
# TRASCRIZIONE AUDIO → contesto settimanale
# ============================================================

@app.post("/api/agents/transcribe-audio")
async def transcribe_audio(
    client_id: str = Form(...),
    week_start: str = Form(...),
    audio_file: UploadFile = File(...),
):
    """
    Trascrive un file audio (mp3/m4a/wav/ogg/webm) con Groq Whisper,
    poi Claude fonde la trascrizione con il testo già scritto da Bravo (existing_context)
    e produce un unico contesto settimanale strutturato.
    L'audio NON viene salvato. Il contesto estratto va in textarea per revisione.
    """
    from agents.audio_transcriber import transcribe_and_extract

    suffix = Path(audio_file.filename or "audio.mp3").suffix or ".mp3"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await audio_file.read())
            tmp_path = tmp.name

        context_text = transcribe_and_extract(tmp_path)
        return {"ok": True, "context_text": context_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore trascrizione: {str(e)}")
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


# ============================================================
# AGENTI — endpoint per attivazione manuale e monitoraggio
# ============================================================

def _run_market_researcher_task(task_id: str, client_id: str, force: bool = False):
    """Eseguito in background — chiama Claude e salva il risultato."""
    from agents.market_researcher import MarketResearcher
    from tools.task_store import complete_task, fail_task
    try:
        researcher = MarketResearcher()
        result = researcher.run(client_id=client_id, task_id=task_id, force=force)
        complete_task(task_id, result)
    except Exception as e:
        fail_task(task_id, str(e))
        print(f"❌ Market researcher task {task_id} fallito: {e}")


@app.post("/api/agents/market-research/run")
async def run_market_research(
    background_tasks: BackgroundTasks,
    client_id: str = Form(...),
    force: bool = Form(False),
):
    """
    Avvia il Ricercatore di Mercato per un cliente in background.
    Ritorna subito un task_id — controlla lo stato con GET /api/agents/tasks/{client_id}.

    force=true → ignora la cache e produce sempre una ricerca nuova (utile per test).
    force=false (default) → riusa se esiste una ricerca valida (< 30 giorni).
    """
    from tools.task_store import create_task
    try:
        task = create_task("market_researcher", client_id, {"force": force})
        task_id = task["id"]
        background_tasks.add_task(_run_market_researcher_task, task_id, client_id, force)
        return {
            "ok": True,
            "task_id": task_id,
            "status": "running",
            "agent": "market_researcher",
            "force": force,
            "poll_url": f"/api/agents/status/{client_id}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore avvio ricerca: {str(e)}")


@app.get("/api/agents/tasks/{client_id}")
async def get_agent_tasks(client_id: str):
    """Ritorna gli ultimi task degli agenti per un cliente."""
    from tools.task_store import get_tasks_for_client
    tasks = get_tasks_for_client(client_id)
    return {"client_id": client_id, "tasks": tasks}


@app.get("/api/agents/status/{client_id}")
async def get_agent_status(client_id: str):
    """
    Dashboard di stato degli agenti per un cliente.
    Mostra l'ultimo task per ogni agente con status e risultato.
    """
    from tools.task_store import get_tasks_for_client
    from tools.supabase_client import get_client as get_sb

    tasks = get_tasks_for_client(client_id, limit=50)

    # Ultimo task per agente
    seen = {}
    for t in tasks:
        agent = t["agent_name"]
        if agent not in seen:
            seen[agent] = t

    # Ultima ricerca di mercato valida
    sb = get_sb()
    research = None
    if sb:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        # Trova settore del cliente
        c = sb.table("clients").select("sector").eq("id", client_id).limit(1).execute()
        if c.data:
            sector = c.data[0].get("sector", "")
            r = (
                sb.table("market_research")
                .select("id,sector,valid_until,created_at,keywords,hashtags")
                .eq("sector", sector)
                .gt("valid_until", now)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if r.data:
                d = r.data[0]
                research = {
                    "id": d["id"],
                    "sector": d["sector"],
                    "valid_until": d["valid_until"],
                    "keywords_count": len(d.get("keywords") or []),
                    "hashtags_count": len(d.get("hashtags") or []),
                }

    return {
        "client_id": client_id,
        "agents": seen,
        "market_research": research,
        "tip": "Usa POST /api/agents/run-chain per avviare la catena completa, o i singoli endpoint per testare agente per agente.",
    }


def _run_strategist_task(task_id: str, client_id: str, week_start: Optional[str], force: bool = False):
    """Eseguito in background — Stratega produce il piano editoriale."""
    from agents.strategist import Strategist
    from tools.task_store import complete_task, fail_task
    try:
        strategist = Strategist()
        result = strategist.run(client_id=client_id, week_start=week_start, task_id=task_id, force=force)
        complete_task(task_id, result)
    except Exception as e:
        fail_task(task_id, str(e))
        print(f"❌ Strategist task {task_id} fallito: {e}")


@app.post("/api/agents/strategist/run")
async def run_strategist(
    background_tasks: BackgroundTasks,
    client_id: str = Form(...),
    week_start: Optional[str] = Form(None),
    force: bool = Form(False),
):
    """
    Avvia lo Stratega Editoriale per un cliente in background.
    Produce il piano della settimana (3 post: Lun/Mer/Ven) e lo salva in editorial_plans.

    week_start: data del lunedì di inizio settimana (YYYY-MM-DD). Default: prossimo lunedì.
    force=true: rigenera anche se il piano per quella settimana esiste già.
    """
    from tools.task_store import create_task
    try:
        task = create_task("strategist", client_id, {"force": force, "week_start": week_start})
        task_id = task["id"]
        background_tasks.add_task(_run_strategist_task, task_id, client_id, week_start, force)
        return {
            "ok": True,
            "task_id": task_id,
            "status": "running",
            "agent": "strategist",
            "week_start": week_start or "prossimo lunedì",
            "force": force,
            "poll_url": f"/api/agents/status/{client_id}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore avvio stratega: {str(e)}")


@app.get("/api/agents/editorial-plan/{client_id}")
async def get_editorial_plan(client_id: str, week_start: Optional[str] = None):
    """
    Ritorna il piano editoriale di un cliente per una settimana.
    Se week_start non è specificato, ritorna il piano della settimana corrente/più recente.
    """
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase non disponibile")

    query = (
        sb.table("editorial_plans")
        .select("*")
        .eq("client_id", client_id)
        .order("scheduled_date")
    )
    if week_start:
        query = query.eq("week_start", week_start)
    else:
        query = query.gte("week_start", date.today().isoformat())

    resp = query.limit(10).execute()
    return {"client_id": client_id, "week_start": week_start, "posts": resp.data or []}


@app.post("/api/agents/run-chain")
async def run_agent_chain(
    background_tasks: BackgroundTasks,
    client_id: str = Form(...),
    force: bool = Form(False),
    agents: str = Form("market_researcher"),
):
    """
    Avvia uno o più agenti in sequenza per un cliente (modalità test/manuale).

    agents: lista separata da virgola degli agenti da eseguire in ordine.
    Valori possibili: market_researcher, strategist, coordinator
    Esempio: agents=market_researcher,strategist

    force=true → bypassa cache e riesegue tutto da capo.

    Ogni agente parte come task separato in background.
    Controlla lo stato su GET /api/agents/status/{client_id}
    """
    from tools.task_store import create_task

    agent_list = [a.strip() for a in agents.split(",")]
    valid_agents = {"market_researcher", "strategist", "coordinator", "designer"}
    unknown = [a for a in agent_list if a not in valid_agents]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Agenti non validi: {unknown}")

    launched = []
    for agent_name in agent_list:
        try:
            task = create_task(agent_name, client_id, {"force": force, "chain": True})
            task_id = task["id"]

            if agent_name == "market_researcher":
                background_tasks.add_task(_run_market_researcher_task, task_id, client_id, force)
            elif agent_name == "strategist":
                background_tasks.add_task(_run_strategist_task, task_id, client_id, None, force)
            else:
                # Stub per agenti non ancora implementati
                from tools.task_store import fail_task as _fail
                background_tasks.add_task(
                    _fail, task_id, f"Agente '{agent_name}' non ancora implementato — in arrivo."
                )

            launched.append({"agent": agent_name, "task_id": task_id, "status": "queued"})
        except Exception as e:
            launched.append({"agent": agent_name, "error": str(e)})

    return {
        "ok": True,
        "client_id": client_id,
        "force": force,
        "launched": launched,
        "poll_url": f"/api/agents/status/{client_id}",
    }


# ============================================================
# METRICHE POST — /api/metrics
# ============================================================

@app.get("/api/metrics/{client_id}")
async def get_metrics(client_id: str, days: int = 90):
    """Ritorna le metriche dei post pubblicati + aggregati per pillar/platform."""
    from tools.supabase_client import get_client as get_sb
    from datetime import date, timedelta

    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}

    cutoff = (date.today() - timedelta(days=days)).isoformat()

    try:
        resp = (
            sb.table("post_metrics")
            .select("*")
            .eq("client_id", client_id)
            .gte("published_at", cutoff)
            .order("published_at", desc=True)
            .execute()
        )
        rows = resp.data or []

        # Aggregati per pillar
        pillar_stats: dict = {}
        platform_stats: dict = {}
        for r in rows:
            p = r.get("pillar") or "Sin pilar"
            pillar_stats.setdefault(p, {"posts": 0, "likes": 0, "reach": 0, "saves": 0})
            pillar_stats[p]["posts"] += 1
            pillar_stats[p]["likes"] += r.get("likes", 0)
            pillar_stats[p]["reach"] += r.get("reach", 0)
            pillar_stats[p]["saves"] += r.get("saves", 0)

            pl = r.get("platform") or "instagram"
            platform_stats.setdefault(pl, {"posts": 0, "likes": 0, "reach": 0})
            platform_stats[pl]["posts"] += 1
            platform_stats[pl]["likes"] += r.get("likes", 0)
            platform_stats[pl]["reach"] += r.get("reach", 0)

        total_likes = sum(r.get("likes", 0) for r in rows)
        total_reach = sum(r.get("reach", 0) for r in rows)
        total_saves = sum(r.get("saves", 0) for r in rows)

        return {
            "ok": True,
            "metrics": rows,
            "aggregates": {
                "total_posts": len(rows),
                "total_likes": total_likes,
                "total_reach": total_reach,
                "total_saves": total_saves,
                "avg_likes": round(total_likes / len(rows), 1) if rows else 0,
                "avg_reach": round(total_reach / len(rows), 1) if rows else 0,
                "by_pillar": pillar_stats,
                "by_platform": platform_stats,
            },
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/metrics")
async def save_metric(body: dict):
    """Salva una nuova metrica (inserimento manuale o da Meta API)."""
    from tools.supabase_client import get_client as get_sb

    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}

    required = ["client_id", "published_at"]
    for f in required:
        if not body.get(f):
            return {"ok": False, "error": f"Campo obbligatorio mancante: {f}"}

    payload = {
        "client_id":   body["client_id"],
        "content_id":  body.get("content_id"),
        "headline":    body.get("headline", ""),
        "platform":    body.get("platform", "instagram"),
        "pillar":      body.get("pillar"),
        "published_at": body["published_at"],
        "likes":       int(body.get("likes", 0)),
        "comments":    int(body.get("comments", 0)),
        "reach":       int(body.get("reach", 0)),
        "impressions": int(body.get("impressions", 0)),
        "saves":       int(body.get("saves", 0)),
        "shares":      int(body.get("shares", 0)),
        "notes":       body.get("notes", ""),
        "source":      body.get("source", "manual"),
    }

    try:
        resp = sb.table("post_metrics").insert(payload).execute()
        return {"ok": True, "metric": resp.data[0] if resp.data else payload}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.delete("/api/metrics/{metric_id}")
async def delete_metric(metric_id: str):
    """Elimina una metrica per ID."""
    from tools.supabase_client import get_client as get_sb

    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}

    try:
        sb.table("post_metrics").delete().eq("id", metric_id).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/metrics/report/{client_id}")
async def get_metrics_report(client_id: str):
    """Ritorna l'ultimo report salvato dall'Analista (generato di notte o manualmente)."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}
    try:
        resp = sb.table("metrics_reports").select("*").eq("client_id", client_id).limit(1).execute()
        row  = (resp.data or [None])[0]
        if not row:
            return {"ok": False, "error": "no_report"}
        return {"ok": True, "report": row["report"], "posts_analyzed": row["posts_analyzed"], "generated_at": row["generated_at"]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/metrics/analyze")
async def analyze_metrics(body: dict):
    """
    Esegue l'agente MetricsAnalyst sul cliente indicato e salva il report in DB.
    Body: { client_id, days? }
    """
    from agents.metrics_analyst import MetricsAnalyst
    from tools.supabase_client import get_client as get_sb
    from datetime import datetime, timezone

    client_id = body.get("client_id", "")
    days      = int(body.get("days", 90))

    if not client_id:
        return {"ok": False, "error": "client_id obbligatorio"}

    try:
        analyst = MetricsAnalyst()
        result  = analyst.run(client_id=client_id, days=days)
        if result.get("ok"):
            sb = get_sb()
            if sb:
                sb.table("metrics_reports").upsert({
                    "client_id":      client_id,
                    "report":         result["report"],
                    "posts_analyzed": result.get("posts_analyzed", 0),
                    "generated_at":   datetime.now(timezone.utc).isoformat(),
                }, on_conflict="client_id").execute()
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ============================================================
# INSTAGRAM PUBLISHING — /api/instagram
# ============================================================

@app.get("/api/instagram/status")
def instagram_status():
    """Ritorna se il publishing Instagram è configurato (APP_ID presente)."""
    from tools.instagram_publisher import is_enabled
    return {
        "enabled": is_enabled(),
        "message": "Configurato" if is_enabled() else "Inserisci INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET nel .env per attivare",
    }


@app.get("/api/instagram/token/{client_id}")
def instagram_token_status(client_id: str):
    """Verifica se il cliente ha un token Instagram salvato."""
    from tools.instagram_publisher import get_token
    token = get_token(client_id)
    if not token:
        return {"connected": False}
    return {
        "connected":   True,
        "ig_username": token.get("ig_username", ""),
        "ig_user_id":  token.get("ig_user_id", ""),
        "expires_at":  token.get("expires_at"),
        "updated_at":  token.get("updated_at"),
    }


@app.get("/api/instagram/auth-url")
def instagram_auth_url(client_id: str, redirect_uri: str):
    """
    Genera l'URL OAuth di Meta per collegare un account Instagram Business.
    Il frontend apre questo URL in una popup.
    """
    app_id = os.getenv("INSTAGRAM_APP_ID", "")
    if not app_id:
        return {"ok": False, "error": "INSTAGRAM_APP_ID non configurato"}

    import urllib.parse
    scope = "instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list"
    state = client_id  # usiamo client_id come state per ritrovarlo nel callback

    params = urllib.parse.urlencode({
        "client_id":     app_id,
        "redirect_uri":  redirect_uri,
        "scope":         scope,
        "response_type": "code",
        "state":         state,
    })
    url = f"https://www.facebook.com/v19.0/dialog/oauth?{params}"
    return {"ok": True, "url": url}


@app.post("/api/instagram/callback")
async def instagram_callback(body: dict):
    """
    Riceve il codice OAuth da Meta, lo scambia con un token long-lived
    e lo salva in Supabase per il cliente indicato.
    """
    from tools.instagram_publisher import (
        exchange_code_for_token, fetch_ig_username, save_token
    )
    from datetime import datetime, timedelta, timezone

    code         = body.get("code", "")
    client_id    = body.get("client_id", "")
    redirect_uri = body.get("redirect_uri", "")

    if not code or not client_id:
        return {"ok": False, "error": "Parametri mancanti: code e client_id sono obbligatori"}

    try:
        token_data = exchange_code_for_token(code, redirect_uri)
        access_token = token_data["access_token"]
        ig_user_id   = token_data["ig_user_id"]
        expires_in   = token_data.get("expires_in")

        ig_username = fetch_ig_username(ig_user_id, access_token)

        expires_at = None
        if expires_in:
            expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat()

        saved = save_token(
            client_id=client_id,
            access_token=access_token,
            ig_user_id=ig_user_id,
            ig_username=ig_username,
            expires_at=expires_at,
        )

        return {
            "ok":          True,
            "ig_username": ig_username,
            "ig_user_id":  ig_user_id,
            "expires_at":  expires_at,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.delete("/api/instagram/token/{client_id}")
def instagram_disconnect(client_id: str):
    """Disconnette l'account Instagram del cliente (cancella il token)."""
    from tools.instagram_publisher import delete_token
    ok = delete_token(client_id)
    return {"ok": ok}


@app.post("/api/instagram/publish")
async def instagram_publish(body: dict):
    """
    Pubblica un post su Instagram per un cliente.
    Body: { client_id, image_b64, caption, content_id? }
    """
    from tools.instagram_publisher import publish_post

    client_id = body.get("client_id", "")
    image_b64 = body.get("image_b64", "")
    caption   = body.get("caption", "")

    if not client_id or not image_b64 or not caption:
        return {"ok": False, "error": "Parametri obbligatori: client_id, image_b64, caption"}

    result = publish_post(client_id, image_b64, caption)

    # Se pubblicato con successo, aggiorna lo status del contenuto in DB
    if result.get("ok") and body.get("content_id"):
        try:
            from tools.supabase_client import get_client as get_sb
            sb = get_sb()
            if sb:
                sb.table("generated_content").update({"status": "published"}).eq("content_id", body["content_id"]).execute()
        except Exception:
            pass

    return result


@app.post("/api/instagram/sync-metrics")
async def instagram_sync_metrics(body: dict):
    """
    Scarica i post recenti dell'account Instagram connesso e li salva in post_metrics.
    Se il post esiste già (ig_media_id), aggiorna likes/reach/saves con i valori attuali.
    Body: { client_id }
    """
    from tools.instagram_publisher import get_token
    from tools.supabase_client import get_client as get_sb
    import httpx

    client_id = body.get("client_id", "")
    if not client_id:
        return {"ok": False, "error": "client_id obbligatorio"}

    token_data = get_token(client_id)
    if not token_data or not token_data.get("access_token"):
        return {"ok": False, "error": "Cuenta Instagram no conectada — conecta primero desde la tab Social"}

    access_token = token_data["access_token"]
    ig_user_id   = token_data.get("ig_user_id", "")

    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}

    try:
        # 1. Recupera i media dell'account (ultimi 50 post)
        fields = "id,caption,timestamp,media_type,permalink,like_count,comments_count"
        async with httpx.AsyncClient(timeout=20) as client:
            media_resp = await client.get(
                f"https://graph.instagram.com/{ig_user_id}/media",
                params={"fields": fields, "limit": 50, "access_token": access_token}
            )
        media_data = media_resp.json()
        posts = media_data.get("data", [])

        if not posts:
            return {"ok": True, "imported": 0, "message": "Nessun post trovato sull'account"}

        # 2. Recupera ig_media_id già salvati per questo cliente (per sapere insert vs update)
        existing_resp = sb.table("post_metrics").select("id,ig_media_id").eq("client_id", client_id).execute()
        existing_map  = {r["ig_media_id"]: r["id"] for r in (existing_resp.data or []) if r.get("ig_media_id")}

        imported = 0
        updated  = 0
        for post in posts:
            media_id = post.get("id")
            if not media_id:
                continue

            # 3. Recupera le insights per ogni post (reach, impressions, saves)
            insights_data = {}
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    ins_resp = await client.get(
                        f"https://graph.instagram.com/{media_id}/insights",
                        params={
                            "metric": "reach,impressions,saved",
                            "access_token": access_token
                        }
                    )
                ins_json = ins_resp.json()
                for item in ins_json.get("data", []):
                    insights_data[item["name"]] = item.get("value", 0)
            except Exception:
                pass  # insights opzionali — il post viene salvato comunque

            caption = post.get("caption", "") or ""
            headline = caption[:80].split("\n")[0] if caption else post.get("media_type", "Post")

            payload = {
                "client_id":   client_id,
                "ig_media_id": media_id,
                "headline":    headline,
                "platform":    "instagram",
                "published_at": post.get("timestamp", "")[:10],
                "likes":       int(post.get("like_count", 0)),
                "comments":    int(post.get("comments_count", 0)),
                "reach":       int(insights_data.get("reach", 0)),
                "impressions": int(insights_data.get("impressions", 0)),
                "saves":       int(insights_data.get("saved", 0)),
                "shares":      0,
                "notes":       post.get("permalink", ""),
                "source":      "instagram_api",
            }
            if media_id in existing_map:
                sb.table("post_metrics").update({
                    "likes":       payload["likes"],
                    "comments":    payload["comments"],
                    "reach":       payload["reach"],
                    "impressions": payload["impressions"],
                    "saves":       payload["saves"],
                }).eq("id", existing_map[media_id]).execute()
                updated += 1
            else:
                sb.table("post_metrics").insert(payload).execute()
                imported += 1

            # Scarica commenti del post
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    comm_resp = await client.get(
                        f"https://graph.instagram.com/{media_id}/comments",
                        params={"fields": "id,text,timestamp", "limit": 50, "access_token": access_token}
                    )
                comments = comm_resp.json().get("data", [])
                existing_comm = sb.table("post_comments").select("ig_comment_id").eq("ig_media_id", media_id).execute()
                existing_comm_ids = {r["ig_comment_id"] for r in (existing_comm.data or [])}
                new_comments = [c for c in comments if c.get("id") and c["id"] not in existing_comm_ids]
                if new_comments:
                    sb.table("post_comments").insert([{
                        "client_id":     client_id,
                        "ig_media_id":   media_id,
                        "ig_comment_id": c["id"],
                        "text":          c.get("text", ""),
                        "timestamp":     c.get("timestamp"),
                    } for c in new_comments]).execute()
            except Exception:
                pass

        return {"ok": True, "imported": imported, "updated": updated, "total_found": len(posts)}

    except Exception as e:
        return {"ok": False, "error": str(e)}


# ============================================================
# ASSET LIBRARY — /api/assets
# ============================================================

@app.get("/api/assets/{client_id}")
async def list_assets(client_id: str, type: Optional[str] = None):
    """Lista gli asset del cliente, opzionalmente filtrati per tipo."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}
    try:
        q = sb.table("client_assets").select("*").eq("client_id", client_id)
        if type:
            q = q.eq("type", type)
        resp = q.order("created_at", desc=True).execute()
        return {"ok": True, "assets": resp.data or []}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/assets/{client_id}/upload")
async def upload_asset(client_id: str, file: UploadFile = File(...), type: str = "photo", tags: str = "", notes: str = ""):
    """
    Carica un asset (immagine, video, logo) su Supabase Storage
    e salva i metadati in client_assets.
    """
    from tools.supabase_client import get_client as get_sb
    import time, mimetypes

    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}

    try:
        content   = await file.read()
        ext       = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
        safe_name = f"{int(time.time())}_{file.filename.replace(' ', '_')}"
        path      = f"assets/{client_id}/{safe_name}"
        mime      = file.content_type or mimetypes.guess_type(file.filename)[0] or "image/jpeg"

        # Upload su Supabase Storage
        sb.storage.from_("bravo-content").upload(
            path,
            content,
            {"content-type": mime, "upsert": "true"},
        )

        # URL pubblico
        url_resp   = sb.storage.from_("bravo-content").get_public_url(path)
        public_url = (url_resp.get("publicUrl") or url_resp.get("publicURL", "")) if isinstance(url_resp, dict) else str(url_resp)

        # Parsa tag (separati da virgola)
        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

        # Salva metadati
        row = {
            "client_id":    client_id,
            "filename":     file.filename,
            "storage_path": path,
            "public_url":   public_url,
            "type":         type,
            "tags":         tag_list,
            "size_bytes":   len(content),
            "notes":        notes,
        }
        resp = sb.table("client_assets").insert(row).execute()
        saved = resp.data[0] if resp.data else row
        return {"ok": True, "asset": saved}

    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/projects/{project_id}/upload-media")
async def upload_project_media(
    project_id: str,
    client_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Sube una foto para un contenido del plan.
    1. Guarda en Supabase Storage: media/{client_id}/{project_id}/{filename}
    2. Analiza con Claude Vision → devuelve scene_description
    """
    from tools.supabase_client import get_client as get_sb
    from tools.brand_store import _resolve_client_uuid
    import time, base64 as _b64

    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase no disponible"}

    try:
        content   = await file.read()
        ext       = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
        safe_name = f"{int(time.time())}_{(file.filename or 'photo.jpg').replace(' ', '_')}"
        path      = f"media/{client_id}/{project_id}/{safe_name}"
        mime      = file.content_type or "image/jpeg"

        sb.storage.from_("bravo-content").upload(path, content, {"content-type": mime, "upsert": "true"})
        url_resp   = sb.storage.from_("bravo-content").get_public_url(path)
        public_url = (url_resp.get("publicUrl") or url_resp.get("publicURL", "")) if isinstance(url_resp, dict) else str(url_resp)

        # Vision: análisis de escena con Claude Haiku (económico)
        scene_description = ""
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if api_key:
            briefing_distilled, client_name = "", ""
            try:
                uuid = _resolve_client_uuid(client_id)
                bk   = sb.table("client_brand").select("brand_kit_opus").eq("client_id", uuid).limit(1).execute()
                if bk.data:
                    briefing_distilled = (bk.data[0].get("brand_kit_opus") or {}).get("briefing_distilled", "")
                ci = sb.table("clients").select("name").eq("id", uuid).limit(1).execute()
                client_name = ci.data[0].get("name", "") if ci.data else ""
            except Exception:
                pass

            # Comprimi immagine se > 4MB (limite sicuro Claude Vision = 5MB base64)
            vision_content = content
            vision_mime = mime
            if len(content) > 4 * 1024 * 1024:
                try:
                    from PIL import Image as _PIL
                    import io as _io
                    img = _PIL.open(_io.BytesIO(content)).convert("RGB")
                    # Ridimensiona se larghezza > 1500px
                    if img.width > 1500:
                        ratio = 1500 / img.width
                        img = img.resize((1500, int(img.height * ratio)), _PIL.LANCZOS)
                    buf = _io.BytesIO()
                    img.save(buf, format="JPEG", quality=75, optimize=True)
                    vision_content = buf.getvalue()
                    vision_mime = "image/jpeg"
                except Exception as _ce:
                    print(f"⚠️ Compressione immagine fallita: {_ce} — uso originale")

            import anthropic as _anth
            vision_resp = _anth.Anthropic(api_key=api_key).messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": vision_mime,
                                                  "data": _b64.standard_b64encode(vision_content).decode()}},
                    {"type": "text", "text": f"""Eres el analista visual de Studio Bravo para {client_name or 'el cliente'}.
Analiza esta fotografía y describe la escena en 4-5 líneas para que un copywriter pueda escribir una caption perfecta sin ver la imagen.

BRIEFING DE MARCA (contexto):
{briefing_distilled[:400] if briefing_distilled else "Tono profesional y cercano."}

DESCRIBE EN ESPAÑOL:
- Escena principal: qué se ve (sujeto, entorno, atmósfera)
- Detalles sensoriales: luz, colores, texturas, sensación general
- Emoción que transmite al espectador
- Elemento único que vale la pena destacar en la caption

Responde SOLO con la descripción. Sin etiquetas ni formato extra."""}
                ]}]
            )
            scene_description = vision_resp.content[0].text.strip()

        # Salva record in client_assets con scene_description e project_id
        client_uuid = _resolve_client_uuid(client_id)
        asset_row = {
            "client_id":        client_uuid,
            "filename":         file.filename,
            "storage_path":     path,
            "public_url":       public_url,
            "type":             "rodaje_photo",
            "tags":             [project_id],
            "size_bytes":       len(content),
            "notes":            scene_description,
        }
        try:
            asset_resp = sb.table("client_assets").insert(asset_row).execute()
            asset_id   = asset_resp.data[0]["id"] if asset_resp.data else None
        except Exception:
            asset_id = None

        return {"ok": True, "photo_url": public_url, "storage_path": path,
                "scene_description": scene_description, "filename": file.filename,
                "asset_id": asset_id}

    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/projects/{project_id}/rodaje-photos")
async def get_rodaje_photos(project_id: str, client_id: str):
    """Ritorna tutte le foto del rodaje già analizzate per questo progetto."""
    from tools.supabase_client import get_client as get_sb
    from tools.brand_store import _resolve_client_uuid
    sb = get_sb()
    if not sb:
        return {"ok": False, "photos": []}
    try:
        client_uuid = _resolve_client_uuid(client_id)
        print(f"[RODAJE] client_id={client_id} → uuid={client_uuid}, project_id={project_id}")
        resp = (sb.table("client_assets")
                .select("id,filename,public_url,storage_path,notes,created_at")
                .eq("client_id", client_uuid)
                .eq("type", "rodaje_photo")
                .contains("tags", [project_id])
                .order("created_at")
                .execute())
        print(f"[RODAJE] trovate {len(resp.data or [])} foto")
        photos = []
        for r in (resp.data or []):
            # Prova signed URL (funziona sia con bucket privato che pubblico)
            # TTL 3600 secondi = 1 ora
            url = r.get("public_url") or ""
            storage_path = r.get("storage_path") or ""
            if storage_path:
                try:
                    signed = sb.storage.from_("bravo-content").create_signed_url(storage_path, 3600)
                    if isinstance(signed, dict):
                        url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("data", {}).get("signedUrl") or url
                    elif hasattr(signed, "signed_url"):
                        url = signed.signed_url or url
                    else:
                        url = str(signed) if signed else url
                except Exception as _se:
                    print(f"[RODAJE] signed URL fallita per {storage_path}: {_se} — uso public_url")
            photos.append({
                "id": r["id"],
                "filename": r["filename"],
                "url": url,
                "scene_description": r.get("notes", "")
            })
        return {"ok": True, "photos": photos}
    except Exception as e:
        print(f"[RODAJE] errore: {e}")
        return {"ok": False, "photos": [], "error": str(e)}


@app.post("/api/projects/{project_id}/generate-captions")
async def generate_captions_for_task(project_id: str, body: dict):
    """
    Genera N varianti di caption dalla descrizione della scena + briefing del cliente.
    Body: { client_id, scene_description, num_variants (1-5) }
    """
    from tools.supabase_client import get_client as get_sb
    from tools.brand_store import _resolve_client_uuid
    import json as _json

    client_id       = body.get("client_id", "")
    scene_desc      = body.get("scene_description", "").strip()
    num_variants    = max(1, min(int(body.get("num_variants", 3)), 5))

    if not scene_desc:
        raise HTTPException(status_code=400, detail="scene_description requerida")

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY no configurada")

    sb = get_sb()
    briefing_distilled, client_name = "", ""
    try:
        uuid = _resolve_client_uuid(client_id)
        bk   = sb.table("client_brand").select("brand_kit_opus").eq("client_id", uuid).limit(1).execute()
        if bk.data:
            briefing_distilled = (bk.data[0].get("brand_kit_opus") or {}).get("briefing_distilled", "")
        ci   = sb.table("clients").select("name").eq("id", uuid).limit(1).execute()
        client_name = ci.data[0].get("name", "") if ci.data else ""
    except Exception:
        pass

    personas_pool = [
        ("Cliente Principal",    "Tono cercano y auténtico, dirigido al cliente ideal del negocio."),
        ("Perfil Joven",         "28-38 años: tono visual y auténtico, storytelling para redes sociales."),
        ("Perfil Profesional",   "40-55 años: tono refinado y concreto, enfocado en valor y calidad."),
        ("Perfil Institucional", "Tono formal y elegante, ideal para newsletter o LinkedIn."),
        ("Variante Estacional",  "Conecta con la temporada actual o un evento especial próximo."),
    ]
    personas = personas_pool[:num_variants]
    personas_text = "\n".join(f'{i+1}. Para "{p[0]}": {p[1]}' for i, p in enumerate(personas))

    import anthropic as _anth
    resp = _anth.Anthropic(api_key=api_key).messages.create(
        model="claude-sonnet-4-5-20251001",
        max_tokens=2000,
        messages=[{"role": "user", "content": f"""Eres el Agente Copywriter de Studio Bravo para {client_name or 'el cliente'}.

DESCRIPCIÓN DE LA FOTO:
{scene_desc}

BRIEFING DE MARCA (tono obligatorio — sin excepciones):
{briefing_distilled[:1500] if briefing_distilled else "Tono profesional, cercano y auténtico. Sin urgencia, sin FOMO, sin descuentos."}

GENERA {num_variants} VARIANTES DE CAPTION — una por perfil objetivo:
{personas_text}

REGLAS OBLIGATORIAS:
- Máx 150 palabras por caption
- Primera línea = hook potente (afirmación, metáfora o dato concreto)
- 1 detalle sensorial obligatorio por caption (aroma, luz, sabor, sonido o textura)
- Última línea = CTA suave (nunca "reserva ahora", nunca "oferta limitada")
- Sin emojis en el cuerpo del texto
- Termina con 3-5 hashtags relevantes para el cliente y el sector

Responde SOLO con este JSON (ningún texto fuera del JSON):
[
  {{"variant": 1, "persona": "...", "caption": "..."}},
  {{"variant": 2, "persona": "...", "caption": "..."}}
]"""}]
    )

    try:
        variants = _json.loads(resp.content[0].text.strip())
    except Exception:
        variants = [{"variant": 1, "persona": "General", "caption": resp.content[0].text.strip()}]

    return {"ok": True, "variants": variants, "num_variants": len(variants)}


@app.patch("/api/assets/{asset_id}")
async def update_asset(asset_id: str, body: dict):
    """Aggiorna tag e note di un asset."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}
    try:
        payload = {}
        if "tags"  in body: payload["tags"]  = body["tags"]
        if "notes" in body: payload["notes"] = body["notes"]
        if not payload:
            return {"ok": False, "error": "Nessun campo da aggiornare"}
        sb.table("client_assets").update(payload).eq("id", asset_id).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.delete("/api/assets/{asset_id}")
async def delete_asset(asset_id: str):
    """Elimina un asset da Storage e dal DB."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        return {"ok": False, "error": "Supabase non disponibile"}
    try:
        # Recupera path per eliminare da Storage
        resp = sb.table("client_assets").select("storage_path").eq("id", asset_id).limit(1).execute()
        if resp.data:
            path = resp.data[0].get("storage_path", "")
            if path:
                try:
                    sb.storage.from_("bravo-content").remove([path])
                except Exception:
                    pass  # Se già eliminato da Storage, continua
        sb.table("client_assets").delete().eq("id", asset_id).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── PIANIFICAZIONE PROGETTO CON OPUS ─────────────────────────────────────────

class ProjectPlanRequest(_BaseModel):
    client_id: str
    project_id: Optional[str] = None   # UUID del progetto in client_projects
    project_title: str
    project_description: str
    deliverable_format: str   # "feed" | "story" | "reel" | "carousel"
    deliverable_count: int
    start_date: str           # ISO "2026-05-01"
    shooting_date: Optional[str] = None  # Data del sopralluogo col cliente
    publish_days: list = ["monday", "wednesday", "friday"]
    team: list = []           # [{ name, role, mode: "human"|"ai" }]

TEAM_BRAVO = [
    {"name": "Carlos Lage",      "role": "Fotógrafo & Filmmaker",    "available_days": ["monday","wednesday","thursday"]},
    {"name": "Andrea Valdivia",  "role": "Social Media Manager",     "available_days": ["monday","tuesday","wednesday","thursday","friday"]},
    {"name": "Mari Almendros",   "role": "Brand Designer — solo identidad de marca, diseño gráfico y brand kit (NO gestión social, NO publicación, NO revisión de contenido social)", "available_days": ["monday","tuesday","wednesday","thursday","friday"]},
    {"name": "Vicente Palazzolo","role": "CEO & Sales",              "available_days": ["monday","wednesday","friday"]},
]

PRODUCTION_STEPS = {
    # ── Contenido social ────────────────────────────────────────────────────
    "feed":       [("Shooting",    3, "Carlos Lage"),     ("Copy",       1, "Andrea Valdivia"), ("Revisión",  1, "Vicente Palazzolo")],
    "story":      [("Shooting",    3, "Carlos Lage"),     ("Copy",       1, "Andrea Valdivia"), ("Revisión",  1, "Vicente Palazzolo")],
    "reel":       [("Rodaje",      5, "Carlos Lage"),     ("Montaje",    2, "Carlos Lage"),     ("Copy",      1, "Andrea Valdivia"), ("Revisión", 1, "Vicente Palazzolo")],
    "carousel":   [("Shooting",    3, "Carlos Lage"),     ("Diseño",     2, "Mari Almendros"),  ("Copy",      1, "Andrea Valdivia"), ("Revisión", 1, "Vicente Palazzolo")],
    # ── Trabajo de diseño / brand ────────────────────────────────────────────
    "brand_kit":  [("Research",    2, "Mari Almendros"),  ("Diseño",     5, "Mari Almendros"),  ("Revisión",  2, "Vicente Palazzolo"), ("Entrega", 1, "Mari Almendros")],
    "logo":       [("Briefing",    1, "Vicente Palazzolo"),("Bocetos",   3, "Mari Almendros"),  ("Refinado",  3, "Mari Almendros"),   ("Revisión", 1, "Vicente Palazzolo"), ("Entrega", 1, "Mari Almendros")],
    "tipografia": [("Research",    2, "Mari Almendros"),  ("Selección",  2, "Mari Almendros"),  ("Manual",    2, "Mari Almendros"),   ("Revisión", 1, "Vicente Palazzolo")],
    "paleta":     [("Moodboard",   2, "Mari Almendros"),  ("Diseño",     3, "Mari Almendros"),  ("Revisión",  1, "Vicente Palazzolo"), ("Manual",  1, "Mari Almendros")],
    "manual":     [("Estructura",  1, "Mari Almendros"),  ("Redacción",  4, "Mari Almendros"),  ("Maquetación",3,"Mari Almendros"),   ("Revisión", 1, "Vicente Palazzolo")],
    # ── Publicidad / SEO ────────────────────────────────────────────────────
    "ads":        [("Estrategia",  2, "Vicente Palazzolo"),("Copy",      2, "Andrea Valdivia"), ("Diseño",    2, "Mari Almendros"),   ("Lanzamiento",1,"Vicente Palazzolo"), ("Reporting",1,"Vicente Palazzolo")],
    "seo":        [("Auditoría",   3, "Vicente Palazzolo"),("Optimización",5,"Andrea Valdivia"),("Revisión",  1, "Vicente Palazzolo")],
    # ── Newsletter / email ──────────────────────────────────────────────────
    "newsletter": [("Estrategia",  1, "Andrea Valdivia"), ("Redacción",  2, "Andrea Valdivia"), ("Diseño",    1, "Mari Almendros"),   ("Envío",    1, "Andrea Valdivia")],
}

@app.post("/api/projects/suggest-plan")
async def suggest_project_plan(req: ProjectPlanRequest):
    """
    Opus legge briefing + deliverable + team e propone un piano di produzione
    completo con card, date, responsabili e sub-task.
    """
    import anthropic as _anthropic
    from tools.brand_store import _resolve_client_uuid
    from tools.supabase_client import get_client as get_sb

    client_uuid = _resolve_client_uuid(req.client_id)
    sb = get_sb()

    # Leggi briefing: prima distillato (brand_kit_opus), poi testo completo come fallback
    briefing_distilled = ""
    briefing_source = "none"
    _debug = {"client_id_raw": req.client_id, "client_uuid": client_uuid, "sb": bool(sb),
              "brand_found": False, "briefing_found": False}
    if sb:
        bk = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_uuid).limit(1).execute()
        _debug["brand_found"] = bool(bk.data)
        if bk.data:
            briefing_distilled = (bk.data[0].get("brand_kit_opus") or {}).get("briefing_distilled", "")
            if briefing_distilled:
                briefing_source = "distilled"
        if not briefing_distilled:
            # Fallback: usa briefing_text da client_briefings (max 3000 char)
            bf = sb.table("client_briefings").select("briefing_text").eq("client_id", client_uuid).limit(1).execute()
            _debug["briefing_found"] = bool(bf.data and bf.data[0].get("briefing_text"))
            if bf.data and bf.data[0].get("briefing_text"):
                briefing_distilled = bf.data[0]["briefing_text"][:3000]
                briefing_source = "full_truncated"
    print(f"[SUGGEST-PLAN DEBUG] {_debug}")

    steps = PRODUCTION_STEPS.get(req.deliverable_format, PRODUCTION_STEPS["feed"])

    # Usa il team personalizzato se fornito, altrimenti usa il default
    active_team = req.team if req.team else TEAM_BRAVO
    ai_active = any(
        (m.get("_agentKey") and not m.get("_disabled")) if isinstance(m, dict) else False
        for m in active_team
    )
    team_desc_lines = []
    for m in active_team:
        if not isinstance(m, dict): continue
        mode      = m.get("mode", "human")
        disabled  = m.get("_disabled", False)
        name      = m.get("name", "")
        role      = m.get("role", "")
        agent_key = m.get("_agentKey", "")
        if agent_key:
            if not disabled:
                team_desc_lines.append(f"  - 🤖 Agente AI ({role}): activo — gestiona copy, caption y publicación")
        elif mode == "ai":
            team_desc_lines.append(f"  - 🤖 AGENTE AI ({role}): sustituye a la persona en copy y publicación")
        else:
            avail = next((x.get("available_days", []) for x in TEAM_BRAVO if x["name"] == name), ["monday","tuesday","wednesday","thursday","friday"])
            team_desc_lines.append(f"  - {name} ({role}): disponible {', '.join(avail)}")
    team_desc = "\n".join(team_desc_lines)

    # Determina dinamicamente l'assegnato per ogni ruolo in base alla modalità scelta
    def _assignee_for(name, role_keywords):
        """Restituisce il nome se è in modalità human, altrimenti 'Agente AI'."""
        for m in active_team:
            if not isinstance(m, dict): continue
            if m.get("_agentKey"): continue  # skip agenti puri
            if m.get("name") == name:
                return name if m.get("mode", "human") == "human" else "Agente AI"
        return "Agente AI"

    shoot_assignee  = _assignee_for("Carlos Lage",       ["filmmaker"])
    copy_assignee   = _assignee_for("Andrea Valdivia",   ["social"]) if not ai_active else "Agente AI"
    design_assignee = _assignee_for("Mari Almendros",    ["brand", "diseño"])
    review_assignee = _assignee_for("Vicente Palazzolo", ["ceo", "sales"])
    pub_assignee    = copy_assignee  # chi gestisce il copy gestisce anche la pubblicazione

    # Filtra formati video se non c'è un filmmaker umano
    has_human_filmmaker = shoot_assignee != "Agente AI"
    media_constraint = "" if has_human_filmmaker else (
        "\nRESTRICCIÓN IMPORTANTE: No hay filmmaker humano en este proyecto. "
        "Usa ÚNICAMENTE formatos de fotografía (post_instagram, story_instagram, carousel, post_linkedin, post_facebook). "
        "NO sugerir reels, vídeos ni ningún formato que requiera grabación de vídeo."
    )

    steps_desc = "\n".join([f"  - {s[0]}: {s[1]} días antes" for s in steps])

    # Parte statica (cached): ruolo + briefing + schema output
    all_steps_desc = "\n".join([
        f"  feed/story: Shooting (3d), Copy (1d), Revisión (1d)",
        f"  reel: Rodaje (5d), Montaje (2d), Copy (1d), Revisión (1d)",
        f"  carousel: Shooting (3d), Diseño (2d), Copy (1d), Revisión (1d)",
        f"  brand_kit: Research (2d), Diseño (5d), Revisión (2d), Entrega (1d)",
        f"  ads: Estrategia (2d), Copy (2d), Diseño (2d), Lanzamiento (1d), Reporting (1d)",
        f"  newsletter: Estrategia (1d), Redacción (2d), Diseño (1d), Envío (1d)",
    ])
    system_text = f"""Eres el planificador de producción de Studio Bravo, una agencia de marketing creativa especializada en contenido para redes sociales.

BRIEFING DEL CLIENTE (usa este contexto para títulos creativos, tips y creative_notes):
{briefing_distilled or "No disponible — usa información del proyecto y adapta el contenido al sector del cliente."}

FASES DE PRODUCCIÓN POR FORMATO:
{all_steps_desc}

FORMATO DE RESPUESTA (responde SOLO con JSON válido, sin texto adicional):
{{
  "cards": [
    {{
      "title": "...",
      "publish_date": "YYYY-MM-DD",
      "format": "...",
      "assignee": "...",
      "material_needed": "1 frase sobre qué material físico/visual se necesita, o 'Digital — no requiere rodaje'",
      "creative_note": "1 frase sensorial/evocadora basada en el briefing",
      "subtasks": [
        {{"name": "...", "date": "YYYY-MM-DD", "assignee": "...", "tip": "2-3 frases concretas: qué hacer, qué destacar, qué evitar"}}
      ]
    }}
  ]
}}"""

    # Parte dinamica (per progetto): dettagli specifici del piano
    user_prompt = f"""PROYECTO: {req.project_title}
DESCRIPCIÓN: {req.project_description}
DELIVERABLE: {req.deliverable_count} {req.deliverable_format}s
FECHA DE INICIO: {req.start_date}
DÍAS DE PUBLICACIÓN: {', '.join(req.publish_days)}

EQUIPO DISPONIBLE:
{team_desc}

REGLAS DE ASIGNACIÓN (obligatorias — respétalas exactamente):
- Shooting / Rodaje / Fotografía → {shoot_assignee}
- Copy / Caption / Redacción → {copy_assignee}
- Diseño gráfico (solo si el formato lo requiere) → {design_assignee}
- Revisión / Aprobación → {review_assignee}
- Publicación → {pub_assignee}

FASES PARA "{req.deliverable_format}":
{steps_desc}

Genera exactamente {req.deliverable_count} cards distribuidas desde {req.start_date} respetando {', '.join(req.publish_days)}.{media_constraint}"""

    try:
        client = _anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=16000,
            system=[{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_prompt}]
        )
        raw = msg.content[0].text.strip()
        # Estrai JSON — prova prima il testo completo, poi cerca il blocco JSON
        import re as _re
        json_str = None
        # 1. Prova direttamente
        try:
            plan = json.loads(raw)
            return {"ok": True, "plan": plan}
        except Exception:
            pass
        # 2. Cerca blocco JSON tra ```json ... ``` o { ... }
        md_match = _re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
        if md_match:
            json_str = md_match.group(1).strip()
        else:
            brace_match = _re.search(r'\{[\s\S]*\}', raw)
            if brace_match:
                json_str = brace_match.group()
        if not json_str:
            raise ValueError("Nessun JSON trovato nella risposta")
        # 3. Rimuovi caratteri di controllo problematici nei valori stringa
        json_str = _re.sub(r'[\x00-\x1f\x7f](?=[^"]*"(?:[^"]*"[^"]*")*[^"]*$)', ' ', json_str)
        plan = json.loads(json_str)
        # Salva production_plan e shooting_date in client_projects (zero token extra)
        if req.project_id and sb:
            try:
                sb.table("client_projects").update({
                    "production_plan": plan,
                    "shooting_date":   req.shooting_date or None,
                }).eq("id", req.project_id).execute()
            except Exception:
                pass  # non bloccante
        return {"ok": True, "plan": plan, "briefing_source": briefing_source, "_debug": _debug}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore pianificazione: {e}")


# ── BRIEFING DE RODAJE ────────────────────────────────────────────────────────

class BriefingRodajeRequest(_BaseModel):
    client_id: str
    project_title: str = ""
    cards: list          # Las cards ya generadas con title, format, material_needed, subtasks
    team: list = []      # El equipo activo con name, role, mode
    shoot_assignee: str = "Carlos Lage"
    interviewer_assignee: str = "Vicente Palazzolo"

@app.post("/api/projects/briefing-rodaje")
async def generate_briefing_rodaje(req: BriefingRodajeRequest):
    """
    Opus recibe las cards ya generadas y produce un briefing de rodaje
    organizado por rol (filmmaker, fotógrafo, entrevistador).
    Llamada separada para no sobrecargar el suggest-plan.
    """
    import anthropic as _anthropic
    from tools.brand_store import _resolve_client_uuid
    from tools.supabase_client import get_client as get_sb

    client_uuid = _resolve_client_uuid(req.client_id)
    sb = get_sb()

    briefing_distilled = ""
    if sb:
        bk = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_uuid).limit(1).execute()
        if bk.data:
            briefing_distilled = (bk.data[0].get("brand_kit_opus") or {}).get("briefing_distilled", "")
        if not briefing_distilled:
            bf = sb.table("client_briefings").select("briefing_text").eq("client_id", client_uuid).limit(1).execute()
            if bf.data and bf.data[0].get("briefing_text"):
                briefing_distilled = bf.data[0]["briefing_text"][:3000]

    # Costruisce la lista card per il prompt
    cards_summary = []
    for i, c in enumerate(req.cards, 1):
        cards_summary.append(
            f"{i}. \"{c.get('title','')}\" — {c.get('format','')} — {c.get('publish_date','')} — "
            f"Material: {c.get('material_needed','no especificado')}"
        )
    cards_text = "\n".join(cards_summary)

    prompt = f"""Eres el director de producción de Studio Bravo, agencia de marketing.
Tu tarea es preparar el BRIEFING DE RODAJE para una visita al cliente.

CLIENTE: {req.client_id}
PROYECTO: {req.project_title}

BRIEFING DEL CLIENTE:
{briefing_distilled or "No disponible — infiere del contexto del proyecto"}

CARDS DEL PLAN DE PRODUCCIÓN (ya generadas):
{cards_text}

CONTEXTO OPERATIVO:
El equipo visita al cliente UNA SOLA VEZ al mes. En esa sesión deben capturar TODO el material visual y de entrevista que necesitan para TODO el mes de publicaciones.
El rodaje/entrevista es la materia prima. Sin este material no pueden producir los contenidos.

ROLES EN LA SESIÓN:
- {req.shoot_assignee} (Filmmaker/Fotógrafo): captura planos, fotos y b-roll
- {req.interviewer_assignee} (Entrevistador): conduce las entrevistas con los responsables del cliente

TU TAREA:
Genera un briefing de rodaje completo y práctico, listo para imprimir y llevar al campo.

Para el FILMMAKER ({req.shoot_assignee}):
- Lista consolidada de planos/fotos necesarios para cubrir TODAS las cards del mes
- Sin duplicados — si dos cards necesitan el mismo tipo de plano, indícalo con "sirve para: card1, card2"
- Para cada elemento: tipo (plano, foto, b-roll), descripción exacta de qué capturar, notas técnicas (encuadre, luz, movimiento, duración)

Para el ENTREVISTADOR ({req.interviewer_assignee}):
- Contextualización breve: cómo presentarse y qué ambiente crear
- Lista de preguntas organizadas por ángulo editorial. Los ángulos deben reflejar los puntos de vista estratégicos del cliente (basado en el briefing):
  * Técnico: cómo funciona, qué hace diferente su tecnología/producto
  * Provocador: desafía creencias del sector, opinión polémica pero fundamentada
  * Humano: historia personal, momentos difíciles, el "por qué" detrás del negocio
  * Aspiracional: visión de futuro, impacto que quieren tener
- Cada pregunta indica: a qué card alimenta y qué tipo de respuesta se busca
- Incluye 2-3 preguntas de seguimiento genéricas ("¿Puedes darme un ejemplo concreto?")

Responde SOLO con JSON válido, sin texto adicional:
{{
  "briefing_rodaje": {{
    "fecha_sugerida": "YYYY-MM-DD",
    "duracion_estimada": "X horas",
    "lugar": "descripción del lugar de rodaje inferido del briefing",
    "filmmaker": [
      {{
        "tipo": "plano|foto|broll|entrevista",
        "descripcion": "qué capturar exactamente",
        "sirve_para": ["título card 1", "título card 2"],
        "notas": "técnica, encuadre, luz, duración sugerida"
      }}
    ],
    "entrevistador": {{
      "intro": "cómo presentar la sesión al cliente — tono y objetivo",
      "preguntas": [
        {{
          "angulo": "técnico|provocador|humano|aspiracional|seguimiento",
          "pregunta": "texto completo de la pregunta",
          "sirve_para": "título del card que alimenta (o 'general')",
          "objetivo": "qué tipo de respuesta se busca y cómo se usará"
        }}
      ]
    }}
  }}
}}"""

    try:
        client = _anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = msg.content[0].text.strip()
        import re as _re
        try:
            result = json.loads(raw)
            return {"ok": True, **result}
        except Exception:
            pass
        md_match = _re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
        if md_match:
            json_str = md_match.group(1).strip()
        else:
            brace_match = _re.search(r'\{[\s\S]*\}', raw)
            json_str = brace_match.group() if brace_match else None
        if not json_str:
            raise ValueError("Nessun JSON trovato")
        result = json.loads(json_str)
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore briefing rodaje: {e}")


# ── EXECUTE STEP ───────────────────────────────────────────────────────────────

class ExecuteStepRequest(_BaseModel):
    client_id: str
    project_title: str = ""
    card_title: str = ""
    card_format: str = ""
    step_name: str
    step_phase: str = ""
    previous_outputs: list = []  # [{"step_name": "...", "output": "..."}]
    team: list = []
    rodaje_photos: list = []  # [{"filename": "...", "scene_description": "..."}]

@app.post("/api/projects/execute-step")
async def execute_plan_step(req: ExecuteStepRequest):
    """
    Esegue uno step AI del piano di produzione.
    Claude genera il contenuto appropriato per lo step (script, brief, caption, ecc.)
    e restituisce il testo grezzo, editabile dall'utente prima di confermare.
    """
    import anthropic as _anthropic
    from tools.brand_store import _resolve_client_uuid
    from tools.supabase_client import get_client as get_sb

    client_uuid = _resolve_client_uuid(req.client_id)
    sb = get_sb()

    briefing_distilled = ""
    if sb:
        bk = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_uuid).limit(1).execute()
        if bk.data:
            briefing_distilled = (bk.data[0].get("brand_kit_opus") or {}).get("briefing_distilled", "")
        if not briefing_distilled:
            bf = sb.table("client_briefings").select("briefing_text").eq("client_id", client_uuid).limit(1).execute()
            if bf.data and bf.data[0].get("briefing_text"):
                briefing_distilled = bf.data[0]["briefing_text"][:3000]

    # Contesto dai passi precedenti già confermati
    prev_ctx = ""
    if req.previous_outputs:
        prev_ctx = "\n\nOUTPUT DEI PASSI PRECEDENTI (già approvati):\n"
        for p in req.previous_outputs:
            prev_ctx += f"\n--- {p.get('step_name', '')} ---\n{p.get('output', '')}\n"

    step_lower = req.step_name.lower()

    if "script" in step_lower or "guión" in step_lower or "guion" in step_lower:
        task_desc = """Genera el SCRIPT Y GUIÓN para este contenido. Incluye:
- Hilo narrativo principal
- Mensajes clave a transmitir (máx. 3)
- Estructura de planos o secuencias sugerida
- Duración estimada y tono visual
Escríbelo en español, tono profesional pero cercano."""

    elif "brief" in step_lower and "film" in step_lower:
        # Detecta si es foto o video según el formato de la card
        video_formats = ["reel", "video", "tiktok"]
        is_photo = not any(vf in req.card_format.lower() for vf in video_formats)

        if is_photo:
            task_desc = """Este proyecto es de FOTOGRAFÍA (sin vídeo). Genera el BRIEF FOTOGRÁFICO. Incluye:

1. FOTOS NECESARIAS — lista detallada de cada foto a capturar o buscar:
   Para cada foto: descripción del sujeto, encuadre, luz, ambiente, qué historia cuenta

2. PROMPTS PARA BÚSQUEDA/GENERACIÓN — para cada foto de la lista, un prompt listo para usar en:
   - Búsqueda de stock (Unsplash, Pexels, Adobe Stock): palabras clave en inglés
   - Generación AI (Midjourney, DALL-E, Firefly): prompt descriptivo en inglés, estilo fotorrealista
   Formato del prompt: "professional photography, [subject], [setting], [light], [mood], [composition], high resolution, editorial style"

3. ESPECIFICACIONES TÉCNICAS — formato final (ratio, dimensiones según plataforma), orientación

Sé específico con el contexto del cliente y del proyecto. Las fotos deben reflejar el tono de marca."""
        else:
            task_desc = """Genera el BRIEF TÉCNICO PARA EL FILMMAKER (VÍDEO). Incluye:
- Lista de planos necesarios (tipo, encuadre, duración)
- Material técnico a llevar
- Localizaciones y personas a grabar
- Timing del día de rodaje (planificación por horas)
Formato claro, listo para imprimir y usar en campo."""

    elif "rodaje" in step_lower or "sesión" in step_lower or "sesion" in step_lower or "día de" in step_lower:
        video_formats = ["reel", "video", "tiktok"]
        is_photo = not any(vf in req.card_format.lower() for vf in video_formats)
        media_type = "fotografía" if is_photo else "vídeo"
        task_desc = f"""Es el día de {media_type}. Genera el RESUMEN DEL DÍA DE PRODUCCIÓN. Incluye:
- Qué material se necesita capturar hoy (lista priorizada)
- Orden recomendado de captura (de más a menos crítico)
- Checklist de verificación antes de terminar la sesión: ¿tenemos todo lo necesario para el mes?
{"- PROMPTS DE RESPALDO: si falta alguna foto, prompt listo para buscar en stock o generar con IA" if is_photo else "- Checklist de verificación de tomas: planos principales, b-roll, entrevistas"}
Formato operativo, para usar durante la sesión."""

    elif "logística" in step_lower or "logistica" in step_lower or "confirmación" in step_lower:
        task_desc = """Genera el CHECKLIST DE CONFIRMACIÓN LOGÍSTICA. Incluye:
- Confirmación con el cliente (fecha, hora, lugar, personas)
- Checklist día anterior
- Contactos clave
- Mensaje de confirmación listo para enviar al cliente
Formato checklist, conciso y accionable."""

    elif "caption" in step_lower or "redacción" in step_lower or "redaccion" in step_lower:
        # ── Delega al ContentDesignerAgent (Copywriter → ArtDirector) ──
        try:
            from agents.content_designer import ContentDesignerAgent
            from models.content import GenerateContentRequest, Platform, ContentFormat

            _fmt_map = {
                "feed": ContentFormat.POST,  "post_instagram": ContentFormat.POST,
                "story": ContentFormat.STORY, "story_instagram": ContentFormat.STORY,
                "carousel": ContentFormat.CAROUSEL, "reel": ContentFormat.REEL_COVER,
            }
            _plat_map = {
                "post_linkedin": Platform.LINKEDIN, "post_facebook": Platform.FACEBOOK,
            }
            fmt  = _fmt_map.get(req.card_format.lower(),  ContentFormat.POST)
            plat = _plat_map.get(req.card_format.lower(), Platform.INSTAGRAM)

            brief_ctx = req.card_title
            if req.project_title:
                brief_ctx += f" — proyecto: {req.project_title}"
            if req.previous_outputs:
                brief_ctx += "\n\nCONTEXTO DE PASOS ANTERIORES:\n" + "\n".join(
                    f"[{p.get('step_name','')}]: {p.get('output','')[:400]}"
                    for p in req.previous_outputs
                )
            if req.rodaje_photos:
                brief_ctx += "\n\nFOTOS DEL RODAJE:\n" + "\n".join(
                    f"- {p.get('filename','')}: {p.get('scene_description','')}"
                    for p in req.rodaje_photos
                )

            agent   = ContentDesignerAgent(api_key=os.getenv("ANTHROPIC_API_KEY"))
            c_req   = GenerateContentRequest(brief=brief_ctx, client_id=req.client_id, platform=plat, format=fmt)
            result  = agent.run(c_req)
            content = result.contents[0]

            output_text = (
                f"HEADLINE: {content.overlay.headline}\n\n"
                f"CAPTION:\n{content.caption}\n\n"
                f"VISUAL PROMPT (Ideogram): {content.visual_prompt}\n\n"
                f"LAYOUT: {content.overlay.layout_variant.value} | FORMATO: {content.format.value}"
            )
            return {"ok": True, "output": output_text, "suggested_photo": None}
        except Exception as e:
            # Fallback al prompt generico se la pipeline fallisce
            task_desc = f"Redacta la caption para este contenido. Hook inicial potente, CTA, 5-10 hashtags. (fallback: {e})"

    elif "diseño" in step_lower or "diseno" in step_lower or "diseño del post" in step_lower:
        # ── ArtDirector: usa la caption già approvata + foto rodaje ──
        try:
            from agents.content_designer import ContentDesignerAgent, _ART_DIRECTOR_SYSTEM, _extract_json_payload
            import anthropic as _anth, json as _json

            prev_caption = ""
            prev_headline = ""
            for p in (req.previous_outputs or []):
                out = p.get("output", "")
                if "CAPTION:" in out:
                    prev_caption  = out.split("CAPTION:")[-1].split("VISUAL PROMPT")[0].strip()[:600]
                if "HEADLINE:" in out:
                    prev_headline = out.split("HEADLINE:")[-1].split("\n")[0].strip()

            photo_ctx = ""
            if req.rodaje_photos:
                photo_ctx = "\nFOTO DEL RODAJE: " + " | ".join(
                    f"{p.get('filename','')}: {p.get('scene_description','')[:150]}"
                    for p in req.rodaje_photos
                )

            art_user = (
                f"BRIEF: {req.card_title} — {req.project_title}\n"
                f"HEADLINE: {prev_headline}\n"
                f"CAPTION: {prev_caption}\n"
                f"CLIENTE: {req.client_id}{photo_ctx}"
            )
            cli  = _anth.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            resp = cli.messages.create(
                model="claude-haiku-4-5-20251001", max_tokens=600,
                system=_ART_DIRECTOR_SYSTEM,
                messages=[{"role": "user", "content": art_user}]
            )
            raw_art = resp.content[0].text
            art     = _json.loads(_extract_json_payload(raw_art))

            output_text = (
                f"LAYOUT: {art.get('layout_variant','bottom-left')}\n"
                f"FORMATO: {art.get('format','Post 1:1')}\n"
                f"TIPO DE CONTENIDO: {art.get('content_type','Post')}\n\n"
                f"VISUAL PROMPT (Ideogram):\n{art.get('visual_prompt','')}\n\n"
                f"INSTRUCCIÓN PARA DISEÑADOR:\n"
                f"Aplicar layout '{art.get('layout_variant','')}' con el headline y caption aprobados. "
                f"Usar la foto del rodaje sugerida. Respetar brand kit del cliente."
            )
            return {"ok": True, "output": output_text, "suggested_photo": None}
        except Exception as e:
            task_desc = f"Define el diseño visual del post según el brand kit. (fallback: {e})"

    elif "preparar" in step_lower or "publicación" in step_lower or "publicacion" in step_lower or "programar" in step_lower:
        task_desc = """Eres el Agente Publicador de Studio Bravo. Revisa todos los outputs anteriores y genera el PAQUETE DE PUBLICACIÓN:

1. CAPTION FINAL — texto listo para copiar y pegar (con saltos de línea, emojis, hashtags)
2. FOTO A USAR — nombre exacto del archivo del rodaje
3. DISEÑO — layout y formato confirmados por el Agente Designer
4. PLATAFORMAS — dónde y en qué orden publicar
5. FECHA Y HORA ÓPTIMA — según calendario del proyecto
6. CHECKLIST FINAL — 5 puntos antes de publicar

El humano publicará manualmente con este paquete."""

    else:
        task_desc = f"""Ejecuta el paso: {req.step_name}
Genera el output correspondiente, claro y estructurado, listo para que el siguiente paso del equipo pueda empezar sin fricción."""

    # Contesto foto del rodaje (solo per passi POST o caption)
    photos_ctx = ""
    if req.rodaje_photos:
        photos_ctx = "\n\nMATERIAL FOTOGRÁFICO DISPONIBLE DEL RODAJE:\n"
        for idx, ph in enumerate(req.rodaje_photos, 1):
            photos_ctx += f"\nFOTO {idx} — {ph.get('filename','')}\n{ph.get('scene_description','')}\n"
        photos_ctx += (
            "\nUsa estas descripciones para referenciar el material visual concreto en tu output."
            "\nAl final de tu respuesta añade EXACTAMENTE esta línea (sin nada más después):"
            "\nFOTO_SUGERIDA: [número de la foto que mejor encaja con este contenido]"
        )

    prompt = f"""Eres el sistema de producción de Studio Bravo, agencia de marketing digital.
Estás ejecutando un paso del flujo de producción de contenidos.

CLIENTE: {req.client_id}
PROYECTO: {req.project_title}
CARD: {req.card_title} ({req.card_format})
PASO ACTUAL: {req.step_name} (fase: {req.step_phase})

BRIEFING DEL CLIENTE:
{briefing_distilled or "No disponible — infiere del contexto"}
{prev_ctx}{photos_ctx}

TU TAREA:
{task_desc}

Responde directamente con el contenido generado, sin introducción ni metadatos. Solo el output del paso, en español."""

    try:
        client = _anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = msg.content[0].text.strip()

        # Estrai FOTO_SUGERIDA se presente
        suggested_photo = None
        lines = raw.splitlines()
        clean_lines = []
        for line in lines:
            if line.strip().startswith("FOTO_SUGERIDA:"):
                try:
                    idx = int(line.split(":", 1)[1].strip()) - 1
                    if 0 <= idx < len(req.rodaje_photos):
                        ph = req.rodaje_photos[idx]
                        suggested_photo = {
                            "index":             idx,
                            "filename":          ph.get("filename", ""),
                            "scene_description": ph.get("scene_description", ""),
                            "url":               ph.get("url", ""),
                        }
                except Exception:
                    pass
            else:
                clean_lines.append(line)

        output = "\n".join(clean_lines).strip()
        return {"ok": True, "output": output, "suggested_photo": suggested_photo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore execute-step: {e}")


# ── PLAN TASKS (vista Andrea) ──────────────────────────────────────────────────

class PlanTask(_BaseModel):
    client_id: str
    project_id: Optional[str] = None
    project_title: Optional[str] = None
    title: str
    assignee: Optional[str] = None
    publish_date: Optional[str] = None
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "Normal"
    format: Optional[str] = None
    creative_note: Optional[str] = None
    subtasks: list = []

class PlanTasksBatch(_BaseModel):
    tasks: List[PlanTask]

@app.post("/api/plan-tasks/save")
async def save_plan_tasks(batch: PlanTasksBatch):
    """Salva una lista di task del piano su Supabase (plan_tasks)."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase non disponibile")

    # Ricava il project_id dal primo task (tutti appartengono allo stesso progetto)
    project_id = batch.tasks[0].project_id if batch.tasks else None
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id mancante")

    rows = []
    for t in batch.tasks:
        rows.append({
            "client_id":     t.client_id,
            "project_id":    t.project_id,
            "project_title": t.project_title,
            "title":         t.title,
            "assignee":      t.assignee,
            "publish_date":  t.publish_date,
            "description":   t.description,
            "status":        t.status,
            "priority":      t.priority,
            "format":        t.format,
            "creative_note": t.creative_note,
            "subtasks":      t.subtasks if isinstance(t.subtasks, list) else [],
        })
    try:
        # Prima elimina i task esistenti per questo progetto (evita accumulo)
        sb.table("plan_tasks").delete().eq("project_id", project_id).execute()
        # Poi inserisce i nuovi
        resp = sb.table("plan_tasks").insert(rows).execute()
        return {"ok": True, "saved": len(resp.data or [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore salvataggio task: {e}")


@app.get("/api/plan-tasks")
async def get_plan_tasks(assignee: Optional[str] = None, client_id: Optional[str] = None, status: Optional[str] = None, project_id: Optional[str] = None):
    """Legge task dal piano. Filtri opzionali: assignee, client_id, status, project_id."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase non disponibile")
    try:
        q = sb.table("plan_tasks").select("*")
        if assignee:
            q = q.ilike("assignee", f"%{assignee}%")
        if client_id:
            q = q.eq("client_id", client_id)
        if status:
            q = q.eq("status", status)
        if project_id:
            q = q.eq("project_id", project_id)
        resp = q.order("publish_date", desc=False).execute()
        return {"ok": True, "tasks": resp.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore lettura task: {e}")


@app.patch("/api/plan-tasks/{task_id}")
async def update_plan_task(task_id: str, body: dict):
    """Aggiorna status o altri campi di un task."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase non disponibile")
    try:
        resp = sb.table("plan_tasks").update(body).eq("id", task_id).execute()
        return {"ok": True, "task": (resp.data or [{}])[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore aggiornamento task: {e}")


@app.delete("/api/plan-tasks/{task_id}")
async def delete_plan_task(task_id: str):
    """Elimina una singola card del piano da Supabase."""
    from tools.supabase_client import get_client as get_sb
    sb = get_sb()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase non disponibile")
    try:
        sb.table("plan_tasks").delete().eq("id", task_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore eliminazione task: {e}")
