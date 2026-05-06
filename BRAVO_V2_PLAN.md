# BRAVO v2 — Piano di Migrazione

**Creato**: 6 maggio 2026
**Ultimo aggiornamento**: 6 maggio 2026
**Stato**: Backend completo ✅ — Frontend e test end-to-end in attesa
**Obiettivo**: Ristrutturare il sistema multi-agente BRAVO con ruoli definiti, flusso chiaro, validazione brand e lettura diretta del briefing.

---

## STATO ATTUALE (6 maggio 2026)

### ✅ Completato
- Step 1 — Fondamenta (briefing_analyzer, schema brand_kit_opus)
- Step 2 — Tools deterministici (seasonality, persona_router, hashtag_selector, brand_compliance)
- Step 3 — Agenti core (editorial_planner, copy_agent, art_director, brief_composer)
- Step 4 — Agenti LLM leggeri (review_interpreter, tone_validator)
- Step 5 — Orchestrator v2 + pipeline_v2 + scheduling A13
- Step 7 — Potenziamenti (photo_analyzer, renderer con filtri, market_intelligence, ugc_curator)
- main.py — 12 nuovi endpoint `/api/v2/*` deployati su Railway

### ⏳ In attesa
- Step 6 — Adattamento frontend (bravo-agent.js, bravo.html, bravo.js)
- Step 8 — Test end-to-end con Belvedere e DaKady

### 🔧 Prerequisito completato da Bravo
- Tabelle Supabase create: `publish_queue`, `ugc_pool`

---

## 1. PRINCIPI DELLA v2

- Ogni agente ha UN ruolo e UN solo lavoro
- Il brand kit JSON è il contratto tra briefing e agenti
- Il briefing non viene distillato — viene catalogato intero, sezione per sezione
- Il sistema è multi-client: stessa macchina, comportamento diverso per cliente
- Tutto ciò che è deterministico è una funzione Python, non un LLM
- LLM solo dove serve creatività o interpretazione

---

## 2. ARCHITETTURA TARGET

```
ORCHESTRATOR (A0)
│
├── STRATEGY LAYER
│   ├── A1  Editorial Planner      ✅  piano mensile: 8 post + 12 stories
│   ├── A2  Seasonality Engine     ✅  lookup stagionale dal brand kit
│   ├── A3  Persona Router         ✅  assegna persona A/B per slot
│   └── A4  Market Intelligence    ✅  ricerca settore + competitor
│
├── CREATIVE LAYER
│   ├── A5  Brief Composer         ✅  slot → brief creativo strutturato
│   ├── A6  Copy Agent             ✅  headline + caption (Sonnet)
│   ├── A7  Art Director           ✅  layout, filtro, crop (Haiku)
│   ├── A8  Photo Analyzer         ✅  analisi PIL + colore + luce + time-of-day
│   ├── A9  Review Interpreter     ✅  recensioni → copy brand-voice (Haiku)
│   └── A10 Variation Selector     —   (auto_selector.py esistente, da rinominare)
│
├── EXECUTION LAYER
│   ├── A11 Format Renderer        ✅  compositing Pillow + filtri foto
│   ├── A12 Hashtag Selector       ✅  sceglie 2 hashtag da brand kit
│   └── A13 Publishing Scheduler   ✅  timing ottimale + coda + publish IG
│
└── VALIDATION LAYER
    ├── A14 Brand Compliance        ✅  check regole pass/fail
    ├── A15 Tone Validator          ✅  check semantico voce brand (Haiku)
    ├── A16 Metrics Analyst         —   (metrics_analyst.py esistente, invariato)
    └── A17 UGC Curator             ✅  raccolta UGC + quality score + permessi
```

---

## 3. FILE CREATI / MODIFICATI

### Agenti nuovi
| File | Agente | Modello | Note |
|---|---|---|---|
| `agents/orchestrator.py` | A0 | — | Riscritto: inizializza tutti gli agenti v2, espone metodi per ogni pipeline |
| `agents/editorial_planner.py` | A1 | Sonnet | Piano mensile 8 feed + 12 stories, rispetta % pillar e frequency cap angoli |
| `agents/copy_agent.py` | A6 | Sonnet | Headline UPPERCASE + caption con hook/sviluppo/CTA soft |
| `agents/art_director.py` | A7 | Haiku | Decide layout + filtro foto leggendo pillar_identity e angle_identity |
| `agents/brief_composer.py` | A5 | zero LLM | Assembla CreativeBrief deterministico da slot + brand_kit_opus |
| `agents/review_interpreter.py` | A9 | Haiku | Recensione Google/Booking → headline + caption in brand voice |
| `agents/market_intelligence.py` | A4 | Sonnet | Ricerca mercato per settore, cache 30 giorni, aggiunge differentiation_gaps |

### Tools nuovi
| File | Agente | Modello | Note |
|---|---|---|---|
| `tools/seasonality.py` | A2 | zero LLM | Mese → SeasonalContext (alta/media/baja + mood + eventi) |
| `tools/persona_router.py` | A3 | zero LLM | Affinità angolo→persona + bilanciamento 50/50 mensile |
| `tools/hashtag_selector.py` | A12 | zero LLM | Hashtag dal brand kit, cap = 2, sostituzione stagionale |
| `tools/brand_compliance.py` | A14 | zero LLM | 6 check: esclamazioni, emoji, hashtag count, lunghezza headline, ecc. |
| `tools/tone_validator.py` | A15 | Haiku | Validazione semantica tono, retry loop max 2 con correction_prompt |
| `tools/pipeline_v2.py` | A5→A15 | — | Catena completa: BriefComposer→Copy→Art→Photo→Render→Compliance→Tone |
| `tools/renderer.py` | A11 | zero LLM | Wrapper su designer.composite() con filtri foto (temp, sat, contrast, blur) |
| `tools/ugc_curator.py` | A17 | zero LLM | Pool UGC: quality score automatico, stato permessi, stats |

### File modificati
| File | Modifica |
|---|---|
| `tools/briefing_analyzer.py` | Riscritto: parser Python sezioni §01-§10 + Haiku fallback, eliminata dipendenza da Opus |
| `tools/instagram_publisher.py` | Aggiunto A13: `schedule_post()`, `process_due_posts()`, `get_optimal_slot()` |
| `tools/photo_analyzer.py` | Aggiunto: `dominant_color`, `time_of_day`, `suggested_angle` alla PhotoAnalysis |
| `backend/main.py` | Aggiunto blocco `# AGENTI v2` con 12 endpoint `/api/v2/*` |

### File deprecati
| File originale | Sostituito da | Motivo |
|---|---|---|
| `agents/market_researcher.py` → `.deprecated` | `agents/market_intelligence.py` | Rinominato + modello Sonnet + differentiation_gaps |
| `tools/briefing_distiller.py` → `.deprecated` | — | Il briefing non si distilla più, si legge intero |

### File v1 mantenuti intatti
`pipeline.py`, `content_designer.py`, `strategist.py`, `designer.py`, `brand_store.py`, `briefing_store.py`, `editorial_store.py`, `feedback_store.py`, `instagram_publisher.py` (v1 functions), `ideogram.py`, `notifier.py`, `pdf_extractor.py`, `supabase_client.py`, `task_store.py`, `auto_selector.py`, `metrics_analyst.py`, `audio_transcriber.py`

---

## 4. ENDPOINT API v2

Tutti su `https://bravoapp-production.up.railway.app`

| Endpoint | Metodo | Agente | Descrizione |
|---|---|---|---|
| `/api/v2/editorial-plan/run` | POST | A1 | Genera piano mensile (background task) |
| `/api/v2/editorial-plan/{client_id}` | GET | A1 | Legge piano mensile da Supabase |
| `/api/v2/market-intelligence/run` | POST | A4 | Ricerca mercato per settore (background task) |
| `/api/v2/post/generate` | POST | A5→A15 | Pipeline completa: foto + slot → post renderizzato |
| `/api/v2/review/interpret` | POST | A9 | Recensione → copy editorial in brand voice |
| `/api/v2/validate/compliance` | POST | A14 | Checklist brand rules su copy esistente |
| `/api/v2/validate/tone` | POST | A15 | Validazione semantica tono contro brand kit |
| `/api/v2/schedule/post` | POST | A13 | Schedula post (slot 8:30 / 12:00 / 19:00 UTC) |
| `/api/v2/schedule/{client_id}` | GET | A13 | Legge coda di pubblicazione |
| `/api/v2/schedule/process` | POST | A13 | Pubblica post in scadenza dalla coda |
| `/api/v2/ugc/add` | POST | A17 | Aggiunge UGC al pool con quality score |
| `/api/v2/ugc/{client_id}` | GET | A17 | Lista UGC approvato / pending |
| `/api/v2/ugc/{item_id}/permission` | PATCH | A17 | Aggiorna stato permessi UGC |

Documentazione interattiva: `https://bravoapp-production.up.railway.app/docs`

---

## 5. TABELLE SUPABASE

### Tabelle esistenti (usate anche da v2)
`clients`, `client_brand` (campo `brand_kit_opus` JSONB), `editorial_plans`, `generated_content`, `market_research`, `social_tokens`, `tasks`, `post_metrics`, `feedback`

### Tabelle create per v2
| Tabella | Creata | Usata da |
|---|---|---|
| `publish_queue` | ✅ 6 maggio 2026 | A13 Publishing Scheduler |
| `ugc_pool` | ✅ 6 maggio 2026 | A17 UGC Curator |

---

## 6. FLUSSO OPERATIVO v2

### Pipeline A — Pianificazione mensile
```
Inizio mese
  → POST /api/v2/market-intelligence/run   (A4 — contesto settore)
  → POST /api/v2/editorial-plan/run        (A1 — piano 8 feed + 12 stories)
       ↳ legge: pillar_identity, angle_identity, scope, seasonality
       ↳ rispetta: frequency cap angoli, % pillar, bilanciamento persona A/B
  → GET  /api/v2/editorial-plan/{id}       (lettura piano)
  → HUMAN CHECKPOINT: Bravo approva il piano
```

### Pipeline B — Generazione singolo post
```
Slot approvato dal piano
  → POST /api/v2/post/generate (foto + slot JSON)
       ↳ A5  BriefComposer    — assembla CreativeBrief
       ↳ A8  PhotoAnalyzer    — analizza foto (layout, colore, time-of-day)
       ↳ A6  CopyAgent        — genera headline + caption (Sonnet)
       ↳ A7  ArtDirector      — decide layout + filtri foto (Haiku)
       ↳ A15 ToneValidator    — valida tono, max 2 retry con correction_prompt
       ↳ A14 BrandCompliance  — check pass/fail (esclamazioni, emoji, ecc.)
       ↳ A11 Renderer         — compositing Pillow con filtri foto
  → HUMAN CHECKPOINT: Bravo approva
  → POST /api/v2/schedule/post             (A13 — schedula con orario ottimale)
```

### Pipeline C — Stories
```
Stesso di B con:
  - Canvas 1080×1920 (format: "Story 9:16")
  - Headline max 5 parole
  - Elementi interattivi: poll / quiz / slider / countdown
```

### Pipeline D — Recensioni → "Voz Real"
```
Recensione da Google/Booking
  → POST /api/v2/review/interpret          (A9 — Haiku)
  → Risultato (headline + caption) → Pipeline B dal punto A7 in poi
```

---

## 7. ORDINE DI ESECUZIONE

### Step 1 — Fondamenta ✅
- [x] Riscrivere `briefing_analyzer.py` (parser Python §01-§10 + Haiku fallback)
- [x] Definire schema completo `brand_kit_opus` con tutti i campi
- [x] Eliminare `briefing_distiller.py` (→ .deprecated)
- [ ] Verificare brand kit JSON di Belvedere in Supabase *(da fare nel test)*

### Step 2 — Tools deterministici ✅
- [x] `tools/seasonality.py`
- [x] `tools/persona_router.py`
- [x] `tools/hashtag_selector.py`
- [x] `tools/brand_compliance.py`

### Step 3 — Agenti core ✅
- [x] `agents/editorial_planner.py`
- [x] `agents/copy_agent.py`
- [x] `agents/art_director.py`
- [x] `agents/brief_composer.py`
- Nota: `strategist.py` mantenuto per compatibilità v1

### Step 4 — Agenti LLM leggeri ✅
- [x] `agents/review_interpreter.py` (Haiku)
- [x] `tools/tone_validator.py` (Haiku)

### Step 5 — Orchestrator + Pipeline ✅
- [x] `agents/orchestrator.py` riscritto (6 agenti v2 + v1 compat)
- [x] `tools/pipeline_v2.py` (catena completa A5→A15)
- [x] `tools/instagram_publisher.py` — scheduling A13 aggiunto

### Step 6 — Frontend ⏳
- [ ] Adattare `bravo-agent.js` (nuovi endpoint v2, slot picker)
- [ ] Adattare `bravo.html` (tab Piano Editoriale, form recensioni, coda scheduling)
- [ ] Adattare `bravo.js` (agenti rinominati, routing v2)

### Step 7 — Potenziamenti ✅
- [x] `tools/photo_analyzer.py` — dominant_color, time_of_day, suggested_angle
- [x] `tools/renderer.py` — filtri foto (temp, sat, contrast, brightness, blur)
- [x] `agents/market_intelligence.py` — Sonnet + differentiation_gaps
- [x] `agents/market_researcher.py` → .deprecated
- [x] `tools/ugc_curator.py`
- [ ] Migrare `agents/designer.py` → `tools/renderer.py` *(bassa priorità)*

### Step 8 — Validazione ⏳
- [ ] Test end-to-end Pipeline A con Belvedere (piano mensile)
- [ ] Test end-to-end Pipeline B con Belvedere (post singolo con foto)
- [ ] Test Pipeline D con recensione reale
- [ ] Test end-to-end con DaKady
- [ ] Verifica KPI tracciabili nel metrics_analyst

---

## 8. MODELLI LLM PER AGENTE

| Agente | Modello | Motivo |
|---|---|---|
| A1 Editorial Planner | claude-sonnet-4-6 | Pianificazione creativa con vincoli complessi |
| A4 Market Intelligence | claude-sonnet-4-6 | Analisi settore + ragionamento competitivo |
| A6 Copy Agent | claude-sonnet-4-6 | Scrittura creativa con tono specifico per cliente |
| A7 Art Director | claude-haiku-4-5-20251001 | Decisione strutturata veloce (layout + filtro) |
| A9 Review Interpreter | claude-haiku-4-5-20251001 | Riformulazione con vincoli stretti |
| A10 Variation Selector | claude-haiku-4-5-20251001 | Valutazione comparativa rapida |
| A15 Tone Validator | claude-haiku-4-5-20251001 | Check binario contro esempi brand |
| A16 Metrics Analyst | claude-sonnet-4-6 | Analisi dati + insight narrativi mensili |

**Zero LLM**: A0, A2, A3, A5, A8, A11, A12, A13, A14, A17

---

## 9. FILE DA NON TOCCARE

- `bravo-db.js` — Supabase frontend
- `_redirects` — Netlify routing
- `backend/.env` — API keys (mai in git)
- `backend/models/` — data models (estendere, non riscrivere)
- `backend/tools/pipeline.py` — pipeline v1 (ancora usata dagli endpoint esistenti)
- `backend/agents/designer.py` — renderer v1 (ancora usato da pipeline.py)
- Tutti i tools elencati come "MANTENERE" nella sezione 3

---

## 10. PROSSIMI PASSI

1. **Test backend** — aprire `/docs` su Railway e testare nell'ordine:
   - `POST /api/v2/market-intelligence/run` con client Belvedere
   - `POST /api/v2/editorial-plan/run` con client Belvedere, mese 2026-05
   - `GET /api/v2/editorial-plan/{client_id}` per leggere il piano generato
   - `POST /api/v2/post/generate` con una foto di Belvedere

2. **Step 6 Frontend** — dopo la validazione backend:
   - Nuova tab "Piano" in bravo.html per vedere/approvare il piano mensile
   - Form recensioni nella tab Agente per Pipeline D
   - Coda di scheduling visibile nel pannello DB

---

*Documento di riferimento per la migrazione BRAVO v1 → v2.*
*Aggiornare man mano che completiamo gli step.*
