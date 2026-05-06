# BRAVO v2 — Piano di Migrazione

**Data**: 6 maggio 2026
**Stato**: In corso
**Obiettivo**: Ristrutturare il sistema multi-agente BRAVO con ruoli definiti, flusso chiaro, validazione brand e lettura diretta del briefing.

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
│   ├── A1  Editorial Planner      (piano mensile: 8 post + 12 stories)
│   ├── A2  Seasonality Engine      (lookup stagionale dal brand kit)
│   ├── A3  Persona Router          (assegna persona A/B per slot)
│   └── A4  Market Intelligence     (ricerca settore + competitor)
│
├── CREATIVE LAYER
│   ├── A5  Brief Composer          (slot → brief creativo strutturato)
│   ├── A6  Copy Agent              (headline + caption)
│   ├── A7  Art Director            (decisione visual: layout, filtro, crop)
│   ├── A8  Photo Analyzer          (analisi foto PIL + colore + luce)
│   ├── A9  Review Interpreter      (recensioni → copy brand-voice)
│   └── A10 Variation Selector      (sceglie migliore tra N varianti)
│
├── EXECUTION LAYER
│   ├── A11 Format Renderer         (compositing Pillow finale)
│   ├── A12 Hashtag Selector        (sceglie 2 hashtag da brand kit)
│   └── A13 Publishing Scheduler    (timing + coda + publish IG)
│
└── VALIDATION LAYER
    ├── A14 Brand Compliance        (check regole pass/fail)
    ├── A15 Tone Validator          (check semantico voce brand)
    ├── A16 Metrics Analyst         (report mensile + feedback loop)
    └── A17 UGC Curator             (raccolta UGC + permessi)
```

---

## 3. AUDIT — MAPPATURA CODICE ESISTENTE

### Agenti (backend/agents/)

| Blueprint | File attuale | Stato | Azione | Dettaglio |
|---|---|---|---|---|
| A0 Orchestrator | `orchestrator.py` (58 righe) | Vuoto, solo proxy | **RISCRIVERE** | Cervello centrale: inizializza agenti, espone metodi per ogni pipeline, gestisce escalation |
| A1 Editorial Planner | `strategist.py` (429 righe) | Copre ~60% | **RINOMINARE + ADATTARE** | Da 3 post/sett fissi a distribuzione mensile flessibile. Leggere pillar_identity e angle_identity dal brand kit JSON |
| A4 Market Intelligence | `market_researcher.py` (280 righe) | Copre ~30% | **RINOMINARE + ESTENDERE** | Aggiungere competitor specifici dal brand kit, output con differentiation_gaps |
| A6 Copy Agent | `content_designer.py` (538 righe) | Copre ~80% | **ESTRARRE + RINOMINARE** | Separare logica Copywriter in agente autonomo. Riscrivere prompt per vincoli per-angolo |
| A7 Art Director | Dentro `content_designer.py` | Copre ~50% | **ESTRARRE** | Separare decisione visual in agente autonomo. Leggere photo_filter specs dal brand kit |
| A8 Photo Analyzer | `tools/photo_analyzer.py` (163 righe) | Copre ~40% | **POTENZIARE** | Aggiungere: colore dominante, stima time-of-day, suggerimento pillar/angolo |
| A10 Variation Selector | `auto_selector.py` (127 righe) | Copre ~70% | **RINOMINARE** | Da auto_selector a variation_selector. Criteri di selezione dal brand kit |
| A11 Format Renderer | `agents/designer.py` (900+ righe) | Copre ~90% | **SPOSTARE** a tools/ | È esecuzione, non decisione. Aggiungere filtri foto (temp, sat, contrast) |
| A16 Metrics Analyst | `metrics_analyst.py` (340+ righe) | Copre ~85% | **MANTENERE** | Aggiungere attribuzione per angolo e calcolo KPI vs target |
| — Audio Transcriber | `audio_transcriber.py` (85 righe) | Funziona | **MANTENERE** | Resta com'è — tool di input, non cambia |

### Agenti DA CREARE

| Blueprint | Tipo | LLM? | Descrizione |
|---|---|---|---|
| A2 Seasonality Engine | `tools/seasonality.py` | No | Lookup table: mese → SeasonalContext dal brand kit seasonal_palette |
| A3 Persona Router | `tools/persona_router.py` | No | Affinità angolo→persona + bilanciamento 50/50 mensile |
| A5 Brief Composer | `agents/brief_composer.py` | No | Assembla CreativeBrief da slot + brand kit (deterministico) |
| A9 Review Interpreter | `agents/review_interpreter.py` | Sì (Haiku) | Recensione raw → headline + caption in brand voice |
| A12 Hashtag Selector | `tools/hashtag_selector.py` | No | Default pair dal brand kit + sostituzione stagionale. Cap = 2 |
| A13 Publishing Scheduler | Estensione `instagram_publisher.py` | No | Scheduling orario ottimale + coda con status |
| A14 Brand Compliance | `tools/brand_compliance.py` | No | Checklist pass/fail: esclamazioni, emoji, hashtag count, word count, etc. |
| A15 Tone Validator | `tools/tone_validator.py` | Sì (Haiku) | Confronto copy vs esempi correcto/incorrecto del brand kit |
| A17 UGC Curator | `tools/ugc_curator.py` | No | Pool UGC con quality score e permission status (manuale per ora) |

### Tools esistenti — NESSUNA MODIFICA

| Tool | Stato |
|---|---|
| `brand_store.py` | Mantenere — legge/scrive brand kit da Supabase |
| `briefing_store.py` | Mantenere — CRUD briefing |
| `editorial_store.py` | Mantenere — estendere per stories |
| `feedback_store.py` | Mantenere — feedback con decay e sintesi |
| `ideogram.py` | Mantenere — generazione immagini AI |
| `instagram_publisher.py` | Mantenere — base per A13 |
| `notifier.py` | Mantenere |
| `pdf_extractor.py` | Mantenere |
| `supabase_client.py` | Mantenere |
| `task_store.py` | Mantenere |

### Tools DA RISCRIVERE

| Tool | Motivo |
|---|---|
| `briefing_analyzer.py` | Da Opus che rielabora → parser Python + Haiku fallback che cataloga le sezioni |
| `briefing_distiller.py` | **ELIMINARE** — il briefing va letto intero, non compresso |
| `pipeline.py` | Riscrivere per nuova architettura (catena Planner → Brief → Copy → Art → Render → Validate) |

---

## 4. LETTURA DEL BRIEFING — NUOVO APPROCCIO

### Problema della v1
Opus legge il briefing e lo "distilla" — perde informazione. Il briefing è già strutturato in 10 sezioni perfette.

### Soluzione v2
Parser Python che legge le sezioni e le cataloga intere nei campi Supabase:

```
BRIEFING (10 sezioni)
│
├─ §01 Descripción    → clients (name, sector, description, positioning)
├─ §02 Scope          → client_brand.scope {posts: 8, stories: 12, excluded: [...]}
├─ §03 Identidad      → client_brand.tone_of_voice (INTERO) + rules_do + rules_dont
├─ §04 Público        → client_brand.personas [{name, age, profile, message}]
├─ §05 Pilares        → client_brand.pillar_identity [{name, %, description, formats}]
├─ §06 Ángulos        → client_brand.angle_identity [{name, frequency, energy, headline_style}]
├─ §07 Mensajes       → client_brand.key_messages {principal, persona_a, persona_b, hashtags}
├─ §08 KPIs           → client_brand.kpis [{name, target, channel, alert_threshold}]
├─ §09 Competidores   → client_brand.competitors [{name, positioning, threat}]
├─ §10 Estacionalidad → client_brand.seasonality {alta, media, baja, events[]}
```

### Implementazione
- **Parser Python puro** per briefing con formato standard (sezioni numerate con ━━━) — gratis, istantaneo
- **Haiku come fallback** per briefing con formato diverso — $0.25, 2 secondi
- **Opus non serve più** per questo step

### Il Brand Kit JSON
Il brand book di Belvedere ha già un JSON embedded con `pillar_identity`, `angle_identity`, `seasonal_palette`, `format_rules`. Questo JSON va salvato nel campo `brand_kit_opus` di `client_brand` in Supabase. Gli agenti lo leggono direttamente.

---

## 5. FLUSSO OPERATIVO v2

### Pipeline A — Pianificazione mensile
```
Mese inizia
  → A2 (Seasonality) genera SeasonalContext
  → A16 (Metrics) genera report mese precedente
  → A4 (Market Intel) aggiorna contesto competitivo
  → A1 (Planner) distribuisce 8 post + 12 stories
       ↳ legge: pillar_identity, angle_identity, scope, seasonality
       ↳ rispetta: frequency cap angoli, % pillar, bilanciamento persona
  → A3 (Persona Router) assegna persona A/B per slot
  → HUMAN CHECKPOINT: Bravo approva il piano
```

### Pipeline B — Generazione singolo post
```
Slot approvato dal piano
  → A5 (Brief Composer) assembla CreativeBrief
       ↳ pillar + angle + persona + season + photo_filter + headline_style + caption_length
  → A6 (Copy Agent, Sonnet) genera headline + caption
       ↳ vincoli dal brief: max parole headline, range parole caption, tone rules
  → A7 (Art Director, Haiku) decide layout + filtro + crop
       ↳ legge photo_filter specs per angolo, consulta A8
  → A8 (Photo Analyzer) analizza foto caricata
  → A11 (Renderer) compositing finale Pillow
  → A14 (Brand Compliance) check pass/fail
  → A15 (Tone Validator, Haiku) check tono
       ↳ Se fail → torna a A6 con istruzioni di correzione (max 2 retry)
  → HUMAN CHECKPOINT: Bravo approva
  → A13 (Publisher) scheduling + publish
```

### Pipeline C — Stories
```
Stessa catena di B, ma:
  - Canvas 1080×1920
  - Text density baja (max 5 parole headline)
  - Elementi interattivi: poll / quiz / slider / countdown
  - Emoji moderate (non vietate come nel feed)
```

### Pipeline D — Recensioni → Contenuto "Voz Real"
```
Recensione da Google/Booking
  → A9 (Review Interpreter, Haiku) reinterpreta con brand voice
  → A6 (Copy Agent) affina headline + caption
  → Pipeline B dal punto A7 in poi
```

---

## 6. SCHEMA client_brand — CAMPI DA AGGIUNGERE

Campi nuovi da aggiungere al JSON `brand_kit_opus` in Supabase:

```json
{
  "scope": {
    "feed_posts_per_month": 8,
    "stories_per_month": 12,
    "platforms": ["instagram"],
    "excluded": ["reels", "tiktok", "linkedin", "facebook", "email", "ads"]
  },
  "personas": [...],
  "pillar_identity": [...],
  "angle_identity": [...],
  "key_messages": {...},
  "kpis": [...],
  "competitors": [...],
  "seasonality": {...},
  "seasonal_palette": {...},
  "format_rules": {...},
  "rules_do": [...],
  "rules_dont": [...]
}
```

Nota: `pillar_identity`, `angle_identity`, `seasonal_palette` e `format_rules` esistono già nel Brand Kit JSON di Belvedere. Gli altri vanno estratti dal briefing.

---

## 7. ORDINE DI ESECUZIONE

### Step 1 — Fondamenta
- [x] Riscrivere `briefing_analyzer.py` (parser Python + Haiku fallback)
- [x] Definire schema completo `brand_kit_opus` con tutti i campi
- [x] Eliminare `briefing_distiller.py` (rinominato a .deprecated)
- [ ] Verificare che il brand kit JSON di Belvedere è già in Supabase

### Step 2 — Tools deterministici (zero LLM)
- [x] Creare `tools/seasonality.py`
- [x] Creare `tools/persona_router.py`
- [x] Creare `tools/hashtag_selector.py`
- [x] Creare `tools/brand_compliance.py`

### Step 3 — Agenti core (rinomina + adatta)
- [x] Creare `editorial_planner.py` (8 feed + 12 stories/mese, legge pillar/angle/scope)
- [x] Estrarre Copy Agent da `content_designer.py` → `copy_agent.py` (Sonnet)
- [x] Estrarre Art Director da `content_designer.py` → `art_director.py` (Haiku)
- [x] Creare `agents/brief_composer.py` (deterministico, assembla CreativeBrief)
- Nota: `strategist.py` mantenuto intatto per compatibilità — editorial_planner.py è il nuovo

### Step 4 — Agenti nuovi (LLM leggeri)
- [ ] Creare `agents/review_interpreter.py` (Haiku)
- [ ] Creare `tools/tone_validator.py` (Haiku)

### Step 5 — Orchestrator + Pipeline
- [x] Riscrivere `orchestrator.py` con tutti gli agenti
- [x] Creare `tools/pipeline_v2.py` per nuova catena (pipeline.py v1 mantenuta intatta)
- [x] Aggiungere scheduling a `instagram_publisher.py` (A13: schedule_post, process_due_posts, get_optimal_slot)

### Step 6 — Frontend
- [ ] Adattare `bravo-agent.js` alla nuova struttura
- [ ] Adattare `bravo.html` (tab, form, dropdown per nuovi agenti)
- [ ] Adattare `bravo.js` (team members, agenti rinominati)

### Step 7 — Potenziamenti
- [x] Potenziare `photo_analyzer.py` (dominant_color, time_of_day, suggested_angle)
- [x] Creare `tools/renderer.py` con filtri foto (temp, sat, contrast, brightness, blur)
- [x] pipeline_v2.py usa renderer.composite_v2 con filtri attivi
- [x] Creare `agents/market_intelligence.py` (rinomina + Sonnet + differentiation_gaps)
- [x] Rinominato `market_researcher.py` → `.deprecated`
- [x] Creare `tools/ugc_curator.py` (pool UGC + quality score + permission tracking)
- [ ] Migrare contenuto `agents/designer.py` → `tools/renderer.py` (Step 7 finale)

### Step 8 — Validazione
- [ ] Test end-to-end con brand kit Belvedere
- [ ] Test end-to-end con brand kit DaKady
- [ ] Verifica che tutti i KPI del blueprint sono tracciabili

---

## 8. MODELLI LLM PER AGENTE

| Agente | Modello | Motivo |
|---|---|---|
| A1 Editorial Planner | Sonnet | Pianificazione creativa con vincoli |
| A4 Market Intelligence | Sonnet | Analisi settore richiede ragionamento |
| A6 Copy Agent | Sonnet | Scrittura creativa con tono specifico |
| A7 Art Director | Haiku | Decisione strutturata (layout + filtro), veloce |
| A9 Review Interpreter | Haiku | Riformulazione semplice con vincoli |
| A10 Variation Selector | Haiku | Valutazione comparativa rapida |
| A15 Tone Validator | Haiku | Check binario contro esempi |
| A16 Metrics Analyst | Sonnet | Analisi dati + insight narrativi |

Tutti gli altri (A0, A2, A3, A5, A8, A11, A12, A13, A14, A17) sono **Python puro — zero LLM**.

---

## 9. FILE DA NON TOCCARE

- `bravo-db.js` — Supabase frontend
- `_redirects` — Netlify routing
- `backend/.env` — API keys
- `backend/models/` — data models (estendere, non riscrivere)
- Tutti i tools elencati come "MANTENERE" nella sezione 3

---

*Documento di riferimento per la migrazione BRAVO v1 → v2.*
*Aggiornare man mano che completiamo gli step.*
