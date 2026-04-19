"""
BRAVO Agents — Backend FastAPI
Punto d'ingresso del server.

Avvio:
  uvicorn main:app --reload --port 8000
"""

import os
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
    client_id: str = Form("dakady"),
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
            client_id=client_id,
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

Rispondi SOLO con questo JSON (nessun testo fuori dal JSON):
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
async def extract_client_projects(client_id: str):
    """
    Lee el briefing del cliente y extrae proyectos de marketing propuestos.
    Guarda en Supabase tabla client_projects con status='propuesto'.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    from tools.briefing_store import get_briefing as _get_briefing
    from tools.brand_store import _resolve_client_uuid
    from tools.supabase_client import get_client as get_sb
    import anthropic as _anthropic, json as _json, re as _re

    client_uuid = _resolve_client_uuid(client_id)
    row = _get_briefing(client_uuid) or _get_briefing(client_id)
    briefing_text = (row or {}).get("briefing_text", "")
    if not briefing_text:
        raise HTTPException(status_code=404, detail="Nessun briefing trovato per questo cliente")

    prompt = f"""Eres consultor de marketing de una agencia. Lee este brief de agencia e identifica todos los proyectos de marketing que la agencia debería ejecutar o proponer al cliente.

Enfócate SOLO en acciones de marketing concretas (redes sociales, publicidad, contenido, alianzas, SEO local, conversión, campañas).

BRIEFING:
{briefing_text[:14000]}

Devuelve SOLO este JSON (sin texto fuera del JSON):
{{
  "projects": [
    {{
      "id": "proj_1",
      "title": "Título corto del proyecto (máx 6 palabras)",
      "category": "CONTENIDO|PUBLICIDAD|ALIANZAS|SEO_LOCAL|CONVERSION|CAMPANA",
      "priority": "alta|media|baja",
      "description": "Descripción concreta del proyecto en 2-3 líneas. Qué hay que hacer y por qué.",
      "deliverable": "Qué se entrega o activa concretamente (1 línea)",
      "month_target": "Inmediato|Mes 5|Mes 6|Mes 7|...",
      "why": "Referencia directa al briefing que justifica este proyecto (1 línea corta)"
    }}
  ]
}}

Importante:
- Incluye entre 10 y 18 proyectos
- Sé específico: usa nombres reales del briefing (marcas, personas, plataformas)
- Prioriza por impacto en captación y en los objetivos del cliente
- La categoría CAMPANA es para acciones puntuales con fecha (lanzamientos, eventos, estaciones)"""

    client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=5000,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()

    match = _re.search(r'\{.*\}', raw, _re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Risposta AI non valida")
    data = _json.loads(match.group(0))
    projects = data.get("projects", [])

    sb = get_sb()
    if sb:
        for proj in projects:
            sb.table("client_projects").upsert({
                "id": proj.get("id", "proj_" + proj.get("title","")[:10].replace(" ","_")),
                "client_id": client_uuid,
                "title": proj.get("title", ""),
                "category": proj.get("category", "CONTENIDO"),
                "priority": proj.get("priority", "media"),
                "description": proj.get("description", ""),
                "deliverable": proj.get("deliverable", ""),
                "month_target": proj.get("month_target", ""),
                "why": proj.get("why", ""),
                "status": "propuesto",
                "source": "briefing_extraction"
            }, on_conflict="id").execute()

    return {"ok": True, "projects": projects, "client_id": client_uuid}


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

    # Nomi del team conosciuti
    known_members = ["Carlos Lage", "Andrea Valdivia", "Mari Almendros"]

    prompt = f"""Analizza questo briefing e dimmi quali dei seguenti membri del team BRAVO sono menzionati come assegnati a questo cliente.

MEMBRI DA CERCARE: {', '.join(known_members)}

BRIEFING (prime 4000 caratteri):
{briefing_text[:4000]}

Rispondi SOLO con un array JSON dei nomi trovati, esattamente come scritti sopra.
Esempio: ["Carlos Lage", "Andrea Valdivia"]"""

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

    prompt = f"""Sei un coordinatore di agenzia creativa.
Analizza il ruolo di questo membro del team e il briefing del cliente, poi suggerisci esattamente 4 task concreti e specifici che questa persona dovrebbe fare per questo cliente.

MEMBRO: {req.member_name}
RUOLO: {req.member_role}
SPECIALITÀ: {req.member_detail}{briefing_block}

Rispondi SOLO con un array JSON di 4 stringhe brevi (max 12 parole ciascuna), senza testo aggiuntivo.
Esempio: ["Filmar visita técnica en campo esta semana", "Editar reel del equipo Dakady", ...]"""

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
