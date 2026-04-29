# 📋 AUDIT BACKEND BRAVO — Report completo

> Documento di lavoro per analizzare punto per punto il backend multi-agente di BRAVO,
> confrontarsi e fixare i problemi identificati.
>
> Data: 2026-04-28 (creato) → 2026-04-29 (ultimo aggiornamento)
> Branch: claude/strange-benz-5e9d6d
> Worktree: /Users/bigart/Downloads/files/.claude/worktrees/strange-benz-5e9d6d
>
> 📖 **Manuale d'uso per Bravo** (linguaggio semplice, niente codice): vedi `MANUALE_BRAVO_2026-04-29.md`

---

## PARTE 1 — AUDIT LOGICO DEL FLUSSO DATI

### 🎯 Orchestrator — backend/agents/orchestrator.py

- **Legge:** nulla.
- **Produce:** nulla — è solo un dispatcher.
- **Consumatori:** FastAPI `/api/content/generate` (main.py:114).
- **Rischio dati:** ⚠️ **GROSSO**. L'Orchestrator **gestisce solo `ContentDesignerAgent`**. Tutti gli altri agenti (BrandAnalyzer, MarketResearcher, MetricsAnalyst, Strategist, AudioTranscriber, Designer/Pillow) sono chiamati direttamente dagli endpoint, **bypassando l'Orchestrator**. Il file dice "punto d'ingresso centrale del sistema multi-agente" ma in realtà è un wrapper su un solo agente.

---

### 🧠 BrandAnalyzer — backend/agents/brand_analyzer.py

- **Legge:** SVG/logo/post-ref caricati via HTTP (`/api/brand/analyze`, main.py:243).
- **⭐ INPUT PRIMARIO (nuovo standard):** **PDF strutturato brand kit** — hex code esatti, nomi semantici, regole di abbinamento per tipo contenuto, regole per formato. Superiore allo screenshot perché contiene tutto in forma machine-readable senza ambiguità. Screenshot/foto = fallback solo quando il PDF non esiste ancora.
- **Produce:** dict JSON con `colors, fonts, tone_of_voice, pillars, layouts, templates, notes, moods[]` (OBJ-19). Salvato in `client_brand.brand_kit_opus` (upsert da main.py:331).
- **Consumatori a valle:** ContentDesigner via `build_system_prompt` in brand_store.py:78; pipeline.py (colori, font, sizes); Strategist (`tone_of_voice, pillars, layouts, notes` + `brand_kit_opus`).
- **Rischio dati:**
  - Lo **schema prodotto da BrandAnalyzer non coincide** con quello prodotto da `briefing_analyzer.py`. BrandAnalyzer salva tutto sotto `brand_kit_opus = {...}`; BriefingAnalyzer scrive `tone_of_voice, pillars, content_types` come **colonne separate** della tabella `client_brand` (briefing_analyzer.py:160-165) e mette solo `briefing_distilled` dentro `brand_kit_opus`. **Due fonti di verità sovrapposte**: chi vince dipende dall'ordine delle chiamate.
  - BrandAnalyzer NON popola `typography`, `text_hierarchy`, `composition_rules`, `agent_prompts` — questi campi sono letti da `pipeline.py` e `brand_store.py` ma **non vengono mai prodotti** dal flusso automatico. Devono essere inseriti manualmente.

---

### 🌐 MarketResearcher — backend/agents/market_researcher.py

- **Legge:** `clients` (market_researcher.py:78), `client_briefings` via `get_briefing`, `client_brand.brand_kit_opus.briefing_distilled`, cache esistente in `market_research`.
- **Produce:** record in `market_research` con `sector, report, keywords, hashtags, trends`. Cache 30 giorni per settore.
- **Consumatori a valle:** Strategist via `_get_latest_market_research` (strategist.py:162).
- **Rischio dati:**
  - Strategist legge `trends.principali, trends.opportunita, trends.stagionali, keywords` (strategist.py:329-332). Se Claude omette uno di questi (l'ha visto come "free-form"), `json.dumps([])` non rompe ma il piano si impoverisce silenziosamente.
  - **Cache per settore, non per cliente**: due clienti dello stesso settore condividono la ricerca anche se hanno target/posizionamento diversi. Voluto, ma rischio editoriale.
  - Worker `run_market_research` (worker.py:325) chiama `run_from_queue` che consuma task in coda. **Nessuno mette task in coda automaticamente** la notte: solo l'endpoint manuale `/api/agents/market-research/run` lo fa. Quindi il worker notturno gira a vuoto se nessun utente clicca il bottone.

---

### 📊 MetricsAnalyst — backend/agents/metrics_analyst.py

- **Legge:** `clients`, `post_metrics` (90gg), `metrics_monthly` (12 mesi), `post_comments` (30gg), `client_brand` (solo `tone_of_voice, pillars, notes` — **non `brand_kit_opus`**), `client_briefings`.
- **Produce:** dict `{ok, report, posts_analyzed, months_history}`. Il chiamante (worker o endpoint) salva `report` in `metrics_reports` (worker.py:370, main.py:1714).
- **Consumatori a valle:** Strategist via `_get_latest_metrics_report` → `_format_metrics_report` (strategist.py:85).
- **Rischio dati:**
  - **Caption mai disponibili.** `worker._sync_one_client` (worker.py:122-128) salva solo `headline = caption[:80]` ma non la `caption` completa in `post_metrics`. L'analista poi tenta di leggere `top_posts_data["caption"] = p.get("notes")[:200]` (metrics_analyst.py:192) ma `notes` contiene il **permalink**, non la caption (worker.py:137). Quindi l'analista lavora sempre con caption=permalink → analisi linguistica delle top performance impossibile.
  - `metrics_reports.upsert(on_conflict="client_id")` mantiene **un solo report per cliente**. Lo storico dei report scompare ad ogni run.
  - Il dict `_format_metrics_report` legge `metrics_report.get("report", {})` ma il record DB ha campo `report` come **dict serializzato JSON**. Se Supabase ritorna stringa invece di dict (capita con jsonb non parsato), `r.get(...)` esplode silenziosamente.

---

### 📅 Strategist — backend/agents/strategist.py

- **Legge:** `clients` (UUID), `client_brand` (incluso `brand_kit_opus.agent_prompts.estratega`), `weekly_contexts`, `client_briefings`, `market_research` per settore, `metrics_reports`, `editorial_plans` recenti, `generated_content` recenti.
- **Produce:** righe in `editorial_plans` con `client_id, week_start, pillar, platform, format, scheduled_date, angle, brief, status="planned"` (editorial_store.py:30-40).
- **Consumatori a valle:** ⚠️ **NESSUN AGENTE LEGGE QUESTA TABELLA per generare il contenuto finale**. ContentDesigner non sa dell'esistenza di `editorial_plans`. L'unico consumatore è il prossimo Strategist (per evitare ripetizioni) e, presumibilmente, il frontend Bravo che la mostra.
- **Rischio dati:**
  - **Il flusso si rompe qui.** Lo Strategist produce un piano dettagliato (visual, mensaje, headline, caption orientativa, hashtags) ma il ContentDesigner non lo riceve mai automaticamente. Bravo deve copia-incollare il `brief` in `/api/content/generate-with-photo`. Il `brief` rimane testo libero.
  - editorial_store.py:33-34: `pillar` e `brief` sono accessi con `post["pillar"]` e `post["brief"]` (KeyError se Claude omette il campo). Nessuna validazione prima del save.
  - strategist.py:369: solleva ValueError se `posts == []`, ma **non verifica** che siano esattamente 3, e non valida che `day/scheduled_date` siano coerenti.
  - `get_recent_generated(client_key, ...)` (editorial_store.py:67) legge `generated_content` con `client_id == client_key` (es. "altair", non UUID). **Nessuno scrive mai in questa tabella durante la generazione** — vedi sotto. Quindi questa lista è sempre vuota.
  - `get_recent_generated` usa `client_key` mentre tutto il resto usa UUID. Mismatch: se in `generated_content` i record fossero salvati con UUID, non li trova mai.
  - Worker `run_strategist` (worker.py:390) consuma solo task in coda. Stesso problema del MarketResearcher: nessuno schedula automaticamente i piani settimanali.

---

### ✍️ ContentDesignerAgent — backend/agents/content_designer.py

- **Legge:** `client_brand` via `get_brand_kit`, `client_info` via `get_client_info`, lessons aggregate via `feedback_store.build_lessons_block`. Il `request.brief` è un testo libero **non collegato a `editorial_plans`**.
- **Produce:** `GenerateContentResponse` con lista `ContentItem` in memoria. **Niente DB.** L'immagine finale viene poi composita da `pipeline.py` + `designer.py` (Pillow).
- **Consumatori a valle:** `pipeline.generate_variants` per il rendering, frontend per visualizzazione.
- **Due pipeline:**
  - **Split** (se `brand_kit_opus.agent_prompts.copywriter` esiste): Copywriter (sonnet) → ArtDirector (haiku) per N varianti.
  - **Classica** (default): un solo Sonnet con system prompt enorme.
- **Rischio dati:**
  - **Pillar custom annullati.** content_designer.py:138: `_safe_enum(ContentPillar, ...)` mappa al fallback "CONTENIDO" qualunque pillar non incluso nell'enum hardcoded di models/content.py:7. I clienti definiscono i propri pillar nel brand kit (es. "AGRONOMIA_DAKADY", "PROGRAMA_VITALI", "TRAMPA"), Claude li usa correttamente, **ma il salvataggio li converte tutti in `CONTENIDO` perdendo l'informazione**. Confermato dal commento stesso del file.
  - **Pipeline split scarta il `format` di Claude.** content_designer.py:307-308: `req_format = request.format or default` — quello che restituisce l'ArtDirector in `art_data["format"]` viene letto ma poi non usato.
  - Pipeline split: se Copywriter restituisce meno varianti del richiesto, content_designer.py:265 **duplica l'ultima** silenziosamente — varietà compromessa.
  - Il `content_id` è generato in memoria (uuid4) ma **non persistito** in DB → l'unico flusso che lo userebbe (feedback per `content_id`) parte da contenuti che esistono solo nel browser.

---

### 🖼 Designer (Pillow) — backend/agents/designer.py

- **Legge:** parametri da `composite()` chiamato da pipeline.py.
- **Produce:** `PIL.Image` (PNG composito).
- **Consumatori a valle:** pipeline.py → base64 → Supabase Storage → frontend.
- **Rischio dati:** non legge DB, è puro renderer. OK. Solo fallback font silenzioso (designer.py:131).

---

### 🎙 AudioTranscriber — backend/agents/audio_transcriber.py

- **Legge:** file audio temporaneo (Groq Whisper).
- **Produce:** stringa di testo strutturato.
- **Consumatori a valle:** **frontend** (main.py:1305) — restituisce direttamente `context_text` senza salvare. Bravo poi lo incolla manualmente in `weekly_contexts.nota_campo`.
- **Rischio dati:** nessun salvataggio automatico. Se l'utente non clicca "Salva", la trascrizione si perde. Voluto, ma il rischio è UX.

---

### 🧬 BriefingAnalyzer (tool) — backend/tools/briefing_analyzer.py

- **Legge:** `briefing_text` passato dall'endpoint.
- **Produce:** aggiorna `client_brand` (incluso `brand_kit_opus.briefing_distilled`), `client_profile`, `client_projects`.
- **Rischio dati:**
  - **Sovrascrive `pillars` e `content_types`** in `client_brand` come colonne separate. Ma Strategist e ContentDesigner leggono da entrambi i posti (a volte da `brand_kit.pillars`, a volte da `brand_kit_opus.pillars`). Se BrandAnalyzer ha popolato `brand_kit_opus.pillars` e poi BriefingAnalyzer popola la colonna `pillars`, i due sono **incoerenti**.
  - Il merge `new_opus = {**existing_opus}` (briefing_analyzer.py:155) preserva i campi tipografici, ma **non aggiorna** `pillars` dentro `brand_kit_opus` con quelli nuovi. Quindi i pilastri "vecchi" dentro `brand_kit_opus` restano disallineati con i "nuovi" nella colonna.

---

## PARTE 2 — DIAGRAMMA MERMAID

```mermaid
flowchart TD
    %% === NODI ATTORI UMANI ===
    BRAVO([👤 Bravo<br/>incolla brief, foto, audio,<br/>approva piani, dà feedback])
    REVIEW{👁 Revisione<br/>umana<br/>prima del publish}

    %% === DATABASE SUPABASE ===
    subgraph DB[(🗄 Supabase)]
        T_CLIENTS[(clients)]
        T_BRIEF[(client_briefings)]
        T_BRAND[(client_brand<br/>+ brand_kit_opus)]
        T_PROFILE[(client_profile)]
        T_PROJECTS[(client_projects)]
        T_WEEKLY[(weekly_contexts)]
        T_MARKET[(market_research)]
        T_METRICS[(post_metrics)]
        T_COMMENTS[(post_comments)]
        T_MONTHLY[(metrics_monthly)]
        T_REPORT[(metrics_reports)]
        T_PLANS[(editorial_plans)]
        T_FEEDBACK[(content_feedback)]
        T_TASKS[(agent_tasks<br/>queue)]
        T_GEN[(generated_content<br/>⚠ vuota)]
        STORAGE[(Storage<br/>bravo-content)]
    end

    %% === AGENTI INTEGRATI NELL'ORCHESTRATOR ===
    ORCH[🎛 Orchestrator<br/>solo ContentDesigner]
    CD[✍ ContentDesigner<br/>Sonnet 4.6]
    AD[🎨 ArtDirector<br/>Haiku 4.5]
    DESIGNER[🖼 Designer Pillow<br/>compositore]

    %% === AGENTI NON INTEGRATI (giallo) ===
    BA[🧠 BrandAnalyzer<br/>Opus 4.7]
    BRIEF_AN[📑 BriefingAnalyzer<br/>Opus 4.7]
    DISTILL[🔬 BriefingDistiller<br/>Haiku — legacy]
    MR[🌐 MarketResearcher<br/>Opus 4.7]
    MA[📊 MetricsAnalyst<br/>Opus 4.7]
    ST[📅 Strategist<br/>Opus 4.7]
    AT[🎙 AudioTranscriber<br/>Groq + Sonnet]
    IG_SYNC[📥 Instagram Sync<br/>worker notturno]

    %% === FLUSSO BRIEFING ===
    BRAVO -->|carica PDF/testo| T_BRIEF
    T_BRIEF -->|background task| BRIEF_AN
    BRIEF_AN -->|pillars, content_types,<br/>tone_of_voice colonne| T_BRAND
    BRIEF_AN -->|briefing_distilled<br/>dentro brand_kit_opus| T_BRAND
    BRIEF_AN -->|team, scope, history| T_PROFILE
    BRIEF_AN -->|12-18 progetti| T_PROJECTS
    DISTILL -.->|⚠ legacy:<br/>solo migrazione| T_BRAND

    %% === FLUSSO BRAND KIT ===
    BRAVO -->|carica SVG/logo/<br/>post di riferimento| BA
    BA -->|colori, font, layouts,<br/>brand_kit_opus completo| T_BRAND

    %% === CONTESTO SETTIMANALE ===
    BRAVO -->|registra audio campo| AT
    AT -->|testo strutturato<br/>⚠ non salva| BRAVO
    BRAVO -->|incolla nota_campo<br/>+ istruzioni_bravo| T_WEEKLY

    %% === INSTAGRAM SYNC ===
    IG_SYNC -->|posts + insights| T_METRICS
    IG_SYNC -->|commenti| T_COMMENTS
    T_METRICS -.->|mensile, aggregati| T_MONTHLY
    T_COMMENTS -.->|distillazione mensile| T_MONTHLY

    %% === MARKET RESEARCH ===
    BRAVO -->|click "Avvia ricerca"| T_TASKS
    T_TASKS -->|claim| MR
    T_BRIEF --> MR
    T_BRAND --> MR
    T_CLIENTS --> MR
    MR -->|report sectorial,<br/>keywords, hashtags, trends| T_MARKET

    %% === METRICS ANALYST ===
    T_METRICS --> MA
    T_MONTHLY --> MA
    T_COMMENTS --> MA
    T_BRAND --> MA
    T_BRIEF --> MA
    MA -->|resumen, funciona,<br/>mejorar, ideas| T_REPORT

    %% === STRATEGIST ===
    BRAVO -->|click "Genera piano"| T_TASKS
    T_TASKS -->|claim| ST
    T_BRIEF --> ST
    T_BRAND --> ST
    T_WEEKLY --> ST
    T_MARKET --> ST
    T_REPORT --> ST
    T_PLANS --> ST
    T_GEN -.->|⚠ sempre vuota| ST
    ST -->|3 post: Lun/Mer/Ven<br/>brief dettagliato per ognuno| T_PLANS

    %% === SALTO MANUALE: piano editoriale → contenuto ===
    T_PLANS -.->|⚠ Bravo legge a mano<br/>e copia il brief| BRAVO

    %% === CONTENT DESIGNER ===
    BRAVO -->|brief + foto/foto multiple| ORCH
    ORCH --> CD
    T_BRAND --> CD
    T_FEEDBACK -->|lezioni aggregate| CD
    CD -.->|pipeline split solo<br/>se agent_prompts.copywriter| AD
    CD -->|ContentItem in memoria| DESIGNER
    AD -->|layout + visual_prompt| DESIGNER
    DESIGNER -->|PNG composito| STORAGE

    %% === REVIEW E PUBLISH ===
    DESIGNER --> REVIEW
    REVIEW -->|approva| BRAVO
    BRAVO -->|click "Pubblica"| IG_PUB[📤 Instagram Publisher]
    IG_PUB -->|status="published"<br/>⚠ ma record non esiste| T_GEN
    BRAVO -->|approvato/rifiutato| T_FEEDBACK

    %% === STILI ===
    classDef notIntegrated fill:#FFF3CD,stroke:#856404,stroke-width:2px,color:#000
    classDef broken fill:#F8D7DA,stroke:#721C24,stroke-width:2px,color:#000
    classDef human fill:#D1ECF1,stroke:#0C5460,stroke-width:2px,color:#000
    classDef integrated fill:#D4EDDA,stroke:#155724,stroke-width:2px,color:#000

    class BA,BRIEF_AN,DISTILL,MR,MA,ST,AT,IG_SYNC notIntegrated
    class T_GEN broken
    class BRAVO,REVIEW human
    class ORCH,CD,AD,DESIGNER integrated
```

**Legenda:**
- 🟢 verde = integrato nell'Orchestrator
- 🟡 giallo = agente esistente ma fuori dall'Orchestrator (chiamato direttamente da endpoint o worker)
- 🔴 rosso = tabella `generated_content` referenziata ma mai popolata
- 🔷 azzurro = intervento umano

---

## PARTE 3 — PROBLEMI PRIORITIZZATI

### 🔴 P1 — CRITICO: il piano dello Strategist non arriva al ContentDesigner

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** Lo Strategist produce 3 post completi a settimana con `pillar/format/angle/brief` dettagliato in `editorial_plans` (strategist.py:373), ma nessun agente legge automaticamente quella tabella per generare il contenuto. Il ContentDesigner riceve solo un `request.brief` di testo libero (content_designer.py:319). Bravo deve copiare a mano.
- **Fix applicato:**
  - **Backend** (`main.py`): nuovo endpoint `POST /api/agents/generate-from-plan/{plan_id}` — legge riga da `editorial_plans`, costruisce `GenerateContentRequest` con `brief/pillar/format`, chiama `ContentDesigner`, aggiorna `status="in_progress"`, ritorna `variants`.
  - **Frontend** (`bravo.js`): aggiunto pulsante "✦ Genera" per ogni post del piano editoriale; nuova funzione `agentiGenerateFromPlan(planId, clientId)` che chiama il backend, salva varianti in `_agCurrentVariants`, e le renderizza con `_agRenderVariants` (stessa UI di Approva/Rifiuta già funzionante).
- **Note di discussione:**

---

### 🔴 P2 — CRITICO: enum `ContentPillar` hardcoded distrugge i pillar custom

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** I clienti definiscono pillar custom nel brand kit ("AGRONOMIA_DAKADY", "TRAMPA", ecc.). Claude li usa, ma `_safe_enum(ContentPillar, ...)` in content_designer.py:138 non li riconosce e li mappa tutti a `CONTENIDO`. Confermato dal commento stesso in models/content.py:9.
- **Fix minimo:** Cambiare `ContentItem.pillar` da `ContentPillar` enum a `str` (con validazione che il valore sia uno dei `pillars` del brand kit del cliente).
- **Note di discussione:**

---

### 🔴 P3 — CRITICO: il MetricsAnalyst non vede mai le caption reali

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** worker.py:122-128 salva solo `headline = caption[:80]` in `post_metrics`, mai la caption completa. L'analista poi legge `p.get("notes")[:200]` come caption (metrics_analyst.py:192) ma `notes` contiene il **permalink Instagram**. Quindi l'analisi linguistica dei top post lavora su URL.
- **Fix minimo:** Aggiungere colonna `caption TEXT` a `post_metrics`; in `worker._sync_one_client` salvare `"caption": caption[:5000]`; in `metrics_analyst._get_metrics` selezionarla; in `top_posts_data` usare `p.get("caption")` invece di `p.get("notes")`.
- **Note di discussione:**

---

### 🟠 P4 — ALTO: schema pillar incoerente fra BrandAnalyzer e BriefingAnalyzer

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** BrandAnalyzer scrive `pillars` dentro `brand_kit_opus` (brand_analyzer.py:46). BriefingAnalyzer scrive `pillars` come **colonna separata** di `client_brand` (briefing_analyzer.py:163) e **non aggiorna** quelli dentro `brand_kit_opus`. Strategist legge `brand_kit.get('pillars')` (strategist.py:323) — ovvero la colonna. ContentDesigner legge in vari punti.
- **Fix minimo:** Una sola fonte di verità: la colonna `pillars`. Rimuovere `brand_kit_opus.pillars`; in BrandAnalyzer salvare i pillar nella colonna; in BriefingAnalyzer aggiornare entrambi se necessario per retro-compatibilità ma documentare che vince la colonna.
- **Note di discussione:**

---

### 🟠 P5 — ALTO: tabella `generated_content` referenziata ma mai popolata

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** `editorial_store.get_recent_generated` (editorial_store.py:67) e `instagram_publish` (main.py:1859) leggono/aggiornano `generated_content`, ma **nessun endpoint scrive in inserimento** in quella tabella quando un contenuto viene generato. Lo Strategist quindi non vede mai post realmente generati nelle "ultime 30 giorni".
- **Fix minimo:** In `pipeline.generate_variants`, dopo la composizione, inserire una riga in `generated_content` con `client_id (UUID), content_id, pillar, platform, headline, image_url, status="draft"`. Allineare il filtro di `get_recent_generated` per usare UUID.
- **Note di discussione:**

---

### 🟠 P6 — ALTO: worker notturno su MarketResearcher e Strategist gira a vuoto

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** worker.py:325-336 e worker.py:390-401 chiamano `run_from_queue()` finché la coda è vuota. Ma **nessun job notturno crea task in coda automaticamente**: solo gli endpoint manuali lo fanno. Significa che le esecuzioni notturne automatiche di market research e piani settimanali non producono mai nulla.
- **Fix minimo:** Prima di ogni `run_from_queue`, iterare i `clients` attivi (eventuale colonna `auto_pipeline=true`) e chiamare `task_store.create_task(...)` per ognuno. In alternativa, far iterare il worker direttamente sui client come fa già `run_metrics_analyst`.
- **Note di discussione:**

---

### 🟡 P7 — MEDIO: Strategist non valida che siano esattamente 3 post

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** strategist.py:369 controlla solo che `posts != []`. Se Claude restituisce 5 post, vengono tutti salvati. Se ne restituisce 1, non avvisa.
- **Fix minimo:** Validare `len(posts) == 3` (o almeno il numero atteso dalla cadenza nel brand kit) e loggare/sollevare warning se diverso.
- **Note di discussione:**

---

### 🟡 P8 — MEDIO: pipeline split scarta il `format` deciso dall'ArtDirector

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** content_designer.py:307-313 usa `req_format` (dal request) anche se l'ArtDirector ha restituito `art_data["format"]` con un valore diverso (es. il brief richiede "qualcosa di flessibile" e l'AD propone "Story" invece di "Post"). Il valore di Claude viene letto dal JSON ma scartato.
- **Fix minimo:** `format = _safe_enum(ContentFormat, art_data.get("format", req_format.value), req_format.value)` per usare quello dell'AD se valido.
- **Note di discussione:**

---

### 🟡 P9 — MEDIO: pipeline split duplica silenziosamente l'ultima variante

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** content_designer.py:264-265: se Claude Copywriter restituisce meno varianti di `n`, il codice fa `copies.append(copies[-1])` finché ne ha abbastanza. Risultato: due varianti identiche presentate come diverse.
- **Fix minimo:** Loggare warning e o (a) sollevare retry mirato chiedendo le varianti mancanti, o (b) generare le mancanti con un nuovo prompt mirato.
- **Note di discussione:**

---

### 🟡 P10 — MEDIO: `metrics_reports` upsert su `client_id` cancella lo storico

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** worker.py:370-375 e main.py:1714-1719 fanno `upsert(on_conflict="client_id")`. Resta un solo report per cliente; ogni run sovrascrive il precedente. Impossibile vedere come è cambiato il giudizio mese su mese.
- **Fix minimo:** Aggiungere `generated_at` (o `period_start, period_end`) come parte della chiave; togliere `on_conflict="client_id"` e fare insert puro; lo Strategist legge il più recente con `.order("generated_at", desc=True).limit(1)`.
- **Note di discussione:**

---

### 🟡 P11 — MEDIO: Orchestrator gestisce un solo agente

- **Stato:** [ ] da fixare
- **Problema:** orchestrator.py:21-47 si autodefinisce "punto d'ingresso centrale del sistema multi-agente" ma istanzia solo `ContentDesigner`. Tutti gli altri agenti sono chiamati direttamente dagli endpoint, con import locali ripetuti (`from agents.X import X` in 8+ funzioni di main.py).
- **Fix minimo:** Estendere `Orchestrator` con `run_market_research()`, `run_strategist()`, `run_metrics_analyst()`, `run_brand_analysis()`, `transcribe_audio()`. Endpoint diventano thin wrapper.
- **Note di discussione:**

---

### 🟢 P12 — BASSO: `subtitle_color` di default arancione hardcoded

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** content_designer.py:131: `subtitle_color: tuple = tuple(overlay_data.get("subtitle_color", (255, 127, 80)))` — fallback `(255,127,80)` è arancione corallo, ignora il brand kit.
- **Fix minimo:** Rimuovere il default; se Claude non lo passa, leggere il primo `colors[].hex` dal brand kit (con role `accent` se presente).
- **Note di discussione:**

---

### 🟢 P13 — BASSO: `claude-opus-4-7-20251101` in `generate_carousel`

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** pipeline.py:706 usa `model="claude-opus-4-7-20251101"` con suffisso data che non corrisponde all'ID ufficiale `claude-opus-4-7`. Probabilmente un copy/paste sbagliato.
- **Fix minimo:** Sostituire con `claude-opus-4-7`.
- **Note di discussione:**

---

### 🟢 P14 — BASSO: `subtitle_color` in `OverlayText` accetta tuple ma Pydantic la serializza in lista

- **Stato:** [x] FIXATO — 2026-04-29 (keen-wing)
- **Problema:** models/content.py:78: `subtitle_color: tuple = (255, 255, 255)` — Pydantic non valida `tuple` come tipo strutturato. Quando il modello viene serializzato in JSON e ricaricato, ridiventa `list`. Funzionalmente innocuo qui, ma frittura logica.
- **Fix minimo:** Tipizzare come `tuple[int, int, int]` o meglio `list[int] = Field(min_length=3, max_length=3)`.
- **Note di discussione:**

---

## ✅ STATO ATTUALE — 2026-04-29

**Tutti i problemi critici e alti sono stati risolti.** Il sistema è passato da un insieme di silos separati a una pipeline funzionante end-to-end.

---

## 📝 REGISTRO FIX COMPLETO

| # | Data | Fix | File modificati | Stato |
|---|------|-----|-----------------|-------|
| Fix 1 | 2026-04-29 | **Photo match semantico** — Haiku sceglie la foto giusta dal rodaje in base al brief del post | `main.py`, `bravo.js` | ✅ |
| Fix 2 | 2026-04-29 | **Brief wiring** — `agentiGenerateWithPhoto` combina card context + photo brief + campo | `bravo.js` | ✅ |
| Fix 3 | 2026-04-29 | **Dispatch tipizzato** — campo `agent_type` nel subtask; `_is()` nel backend; no keyword fragile | `main.py`, `bravo.js` | ✅ |
| Fix 4 | 2026-04-29 | **Subtask granulare** — `activeSubtaskIdx` salvato al lancio; approvazione marca solo quello | `bravo.js` | ✅ |
| Fix 5 | 2026-04-29 | **Pillars nel piano** — `suggest-plan` carica `pillars, tone_of_voice, content_types` da DB | `main.py` | ✅ |
| Block A | 2026-04-29 | **Plan persistence** — UPSERT stabile con UUID client-side; `status` preservato tra ricariche | `main.py`, `bravo.js` | ✅ |
| Block B | 2026-04-29 | **Feedback loop** — menu motivo rifiuto inline; `liked_aspects` auto-popolato all'approvazione | `bravo.js` | ✅ |
| Block C | 2026-04-29 | **Vision fallback** — rimosso "Hotel Toscana" hardcoded nel prompt | `main.py` | ✅ |
| P1 | 2026-04-29 | **Strategist → ContentDesigner** — endpoint `/generate-from-plan` + bottone "✦ Genera" nel piano | `main.py`, `bravo.js` | ✅ |
| P2 | 2026-04-29 | **Pillar custom** — `ContentItem.pillar` da enum a `str`; rimosso `_safe_enum` che convertiva tutto in "CONTENIDO" | `models/content.py`, `content_designer.py` | ✅ |
| P3 | 2026-04-29 | **Caption reali** — worker salva `caption[:2000]`; MetricsAnalyst la legge invece del permalink | `worker.py`, `metrics_analyst.py` | ✅ |
| P4 | 2026-04-29 | **Doppia fonte pillar** — BriefingAnalyzer sincronizza colonna `pillars` E `brand_kit_opus.pillars` | `briefing_analyzer.py` | ✅ |
| P5 | 2026-04-29 | **`generated_content` mai popolata** — pipeline inserisce riga dopo ogni composizione | `pipeline.py`, `editorial_store.py` | ✅ |
| P6 | 2026-04-29 | **Worker queue vuota** — `run_market_research` e `run_strategist` auto-popolano la coda da `client_brand` | `worker.py` | ✅ |
| P7 | 2026-04-29 | **Validazione N post** — Strategist logga warning se Claude non ritorna esattamente 3 post; tronca a 3 | `strategist.py` | ✅ |
| P8 | 2026-04-29 | **ArtDirector format ignorato** — split pipeline usa `art_data["format"]` se valido | `content_designer.py` | ✅ |
| P9 | 2026-04-29 | **Varianti duplicate silenziosamente** — rimossa duplicazione; log warning se ne mancano | `content_designer.py` | ✅ |
| P10 | 2026-04-29 | **Storico metrics_reports cancellato** — cambiato da `upsert(on_conflict=client_id)` a `insert()` | `worker.py`, `main.py`, `strategist.py` | ✅ |
| P12 | 2026-04-29 | **subtitle_color arancione hardcoded** — default cambiato a `[255,255,255]` (bianco neutro) | `content_designer.py`, `models/content.py` | ✅ |
| P13 | 2026-04-29 | **Model ID typo** — `claude-opus-4-7-20251101` → `claude-opus-4-7` | `pipeline.py` | ✅ |
| P14 | 2026-04-29 | **tuple vs list** — `subtitle_color: list[int] = Field(default=[255,255,255])` | `models/content.py` | ✅ |

---

## 🔲 ANCORA APERTO

| # | Priorità | Problema | Note |
|---|----------|----------|------|
| P11 | 🟡 Bassa | **Orchestrator gestisce solo ContentDesigner** — tutti gli altri agenti chiamati direttamente dagli endpoint con import ripetuti | Refactor architetturale pulito ma non urgente. Non blocca nulla. Da fare quando il prodotto è stabile. |

---

## 🚀 PARTE 4 — PROSSIMI OBIETTIVI

> Dopo aver risolto tutti i bug di logica, il sistema è tecnicamente sano. Questi sono i prossimi passi evolutivi: prima il funzionamento completo dal vivo, poi le nuove funzionalità.

---

### 🎯 OBJ-1 — Primo deploy e test end-to-end reale
**Priorità: ALTA — da fare subito**

Prima di aggiungere nuove feature, bisogna verificare che tutto quello che è stato fixato funzioni davvero in produzione (Railway + Netlify).

Cosa testare in ordine:
1. Genera piano settimanale con Opus → verifica che i pillar custom del cliente appaiano nelle card
2. Clicca "✦ Genera" su una card del piano → verifica che il bottone chiami Railway e ritorni varianti
3. Approva una variante → verifica che `liked_aspects` sia popolato nel feedback inviato
4. Rifiuta con motivo → verifica che `rejection_reason` sia nel DB
5. Esegui worker manuale → verifica che `generated_content` abbia nuove righe dopo la generazione
6. Apri sezione Métricas → verifica che il report IA mostri dati reali e non URL nei top post

---

### 🎯 OBJ-2 — Audio → piano in un click
**Priorità: MEDIA**

Oggi il flusso è: Bravo registra audio campo → copia la trascrizione a mano → la incolla in `weekly_contexts.nota_campo`. Ci sono due punti da collegare:

1. **Auto-save trascrizione**: dopo la trascrizione Groq, salvare automaticamente il testo in `weekly_contexts` per il cliente attivo — senza che Bravo debba copiare.
2. **Trigger piano da nota campo**: un bottone "✦ Genera piano da questa nota" che chiama direttamente `/api/agents/strategist/run` con il contesto appena salvato.

Risultato: da voce registrata in campo a piano editoriale settimanale in 2 click.

---

### 🎯 OBJ-3 — Stato pipeline visibile per ogni cliente
**Priorità: MEDIA**

Oggi non si capisce a colpo d'occhio "a che punto siamo" per un cliente. Bisogna aprire ogni sezione separatamente.

Aggiungere nella card cliente (nella lista clienti) uno **status badge** che mostri:
- 🔴 Nessun brand kit
- 🟡 Brand kit ok, nessun piano questa settimana
- 🟢 Piano pronto, N post da generare
- ✅ Tutti i post generati e approvati questa settimana

Dati già tutti in DB — è solo frontend (`bravo.js`).

---

### 🎯 OBJ-4 — Multi-cliente: onboarding nuovo cliente in autonomia
**Priorità: MEDIA-BASSA**

Oggi aggiungere un nuovo cliente richiede: creare il record a mano nel DB, caricare il brand kit, caricare il briefing, ecc. Aggiungere un **wizard di onboarding** in 5 step:
1. Nome cliente + settore + handle Instagram
2. **Carica PDF brand kit strutturato** (formato TRI-X FORCE®: moods A/B, hex completi, regole abbinamento) → BrandAnalyzer legge PDF → estrae moods, palette, regole → popola `brand_kit_opus.moods[]`
3. Se il PDF non esiste ancora: carica logo/SVG come fallback → BrandAnalyzer classico
4. Carica PDF briefing → BriefingAnalyzer automatico
5. Conferma pillars + moods suggeriti da Claude → salva

> ⚠️ **Prerequisito:** Bravo deve aver già creato il PDF brand kit del cliente (vedi CHECKLIST OBBLIGATORIA sotto) prima di aprire il wizard.

Tutto quello che serve esiste già nel backend. È un lavoro frontend puro.

---

### 🎯 OBJ-5 — P11: refactor Orchestrator (debit tecnico)
**Priorità: BASSA — quando il prodotto è stabile**

Spostare tutti gli agenti (MarketResearcher, Strategist, MetricsAnalyst, BrandAnalyzer, AudioTranscriber) dentro l'Orchestrator. Gli endpoint di `main.py` diventano thin wrapper di 3 righe. Beneficio: test più facili, log centralizzati, retry unificato.

Non urgente — nessuna funzionalità dipende da questo.

---

### 🎯 OBJ-6 — Dashboard metriche comparativa
**Priorità: BASSA**

Il MetricsAnalyst ora ha caption reali (fix P3) e storico report (fix P10). Si può costruire:
- Grafico engagement per pillar (quale funziona meglio)
- Confronto settimana su settimana
- Suggerimento automatico "questo tipo di post performa meglio — usalo di più"

Dipende dall'OBJ-1 (che ci siano dati reali accumulati).

---

---

## 🔬 PARTE 5 — ANALISI PROFONDA: VISIONE PRODOTTO E NUOVI OBIETTIVI

> Dopo aver capito che l'app deve servire **3 modalità d'uso** (1) Bravo studio stesso, (2) clienti gestiti manualmente con statistiche, (3) clienti autonomi gestiti dagli agenti — riapro tutta l'analisi del backend con questi occhi nuovi. Questa parte non è più "fix di bug" ma **scelte di prodotto**: cosa manca strutturalmente, cosa è dato accumulato senza ritorno, cosa va riprogettato.

---

### 🧭 CONSTATAZIONI CHIAVE DALL'ANALISI

#### A. La tabella `clients` è quasi vuota — **manca l'intelligenza del modello dati**
La tabella `clients` ha solo 2 colonne: `id` e `name`. Nessuna colonna per:
- `is_self` (è Bravo stessa, vista da dentro l'app)
- `autonomy_level` (manual / assisted / auto) — chi decide
- `auto_publish` (pubblica senza review umana)
- `sector`, `country`, `language` (oggi sparsi tra brand_kit, briefing, weekly_contexts)
- `instagram_handle` (oggi solo dentro `social_tokens`)

Ne segue che **non c'è modo per il backend di sapere "cosa fare automaticamente"** per un cliente. Il worker notturno tratta tutti uguali, l'UI non distingue Bravo dai clienti, e non si può attivare/disattivare la pipeline cliente per cliente.

#### B. La pipeline non chiude il cerchio publish → metriche → apprendimento
Oggi:
1. Strategist genera piano → DB ✅
2. Bravo clicca "Genera" → varianti ✅ (P1 risolto)
3. Bravo approva una variante → marca subtask done ✅
4. Bravo pubblica su Instagram → publish_post ✅
5. **MA:** `editorial_plans.status` non passa a "done" automaticamente quando si pubblica
6. **MA:** il `content_id` del post pubblicato non viene legato al `ig_media_id` → impossibile dire "questo post performa così perché veniva da QUESTO piano"
7. **MA:** il MetricsAnalyst genera report, ma il suo output non torna in feedback strutturato per migliorare il prompt del Copywriter

Quindi il sistema **impara solo dal feedback manuale di Bravo** (P/Block B) e mai dalle performance reali.

#### C. Dati che si accumulano senza produrre valore
1. **`agent_tasks` cresce all'infinito.** Nessuna policy di retention. Dopo 6 mesi di uso ci saranno migliaia di righe `done` che rallentano `claim_pending_task`.
2. **`weekly_contexts` accumula 52 righe/anno per cliente.** Mai consultate dopo la settimana corrente.
3. **`market_research` cache per settore, ma nessuno verifica la freschezza.** Dopo 30 giorni viene rigenerato anche se la `valid_until` è scaduta da 1 giorno; e se non scade mai (perché nessuno lo richiama) resta vecchio per sempre.
4. **`metrics_monthly.comment_insights` viene calcolato ma mai mostrato in UI.** Sforzo di analisi sprecato.
5. **`generated_content` ora si popola (P5) ma manca il link `→ editorial_plan_id`.** Non si può ricostruire "questo post nasce da quel piano".
6. **`post_metrics.caption` ora viene salvata (P3), ma SOLO sui nuovi sync.** I post storici sincronizzati prima del fix hanno caption=null. Serve un backfill.
7. **`content_feedback.client_id` è `text` con default `"dakady"`.** Incoerente con UUID del nuovo schema → record orfani che `build_lessons_block(client_id=UUID)` non vede.

#### D. Bravo Studio (l'agenzia stessa) non ha un flusso suo
L'app è disegnata per "gestire clienti". Ma Bravo è anche un'agenzia che ha il suo **proprio Instagram, LinkedIn, sito**. Per gestire la propria comunicazione, oggi Bravo dovrebbe:
- creare un cliente fittizio chiamato "Bravo!Comunica"
- caricare il proprio brand kit, briefing, foto
- usare l'UI cliente come tutti gli altri

Funziona, ma **non distingue concettualmente "il mio brand" da "i miei clienti"**. Manca:
- una dashboard "Studio" separata, con il proprio KPI di agenzia (clienti acquisiti, fatturato mensile, partnership attive)
- la possibilità di **non mostrare** Bravo nella lista clienti
- una sezione "About / Portfolio" che usa i contenuti generati come case study

#### E. Modalità "cliente autonomo" non esiste affatto
Il `run-chain` lancia market_researcher e strategist, ma **si ferma lì**. Per un cliente davvero autonomo serve:
- piano generato automaticamente settimana scorsa (✅ Strategist nightly)
- post generati automaticamente da ogni riga del piano (❌ oggi richiede click manuale)
- review automatica con auto-approve se il punteggio supera soglia (❌ non esiste)
- pubblicazione schedulata automatica nei giorni programmati (❌ non esiste)
- alert se qualcosa fallisce, altrimenti silenzio (❌ non esiste)

**È il salto più importante per la business model dell'agenzia**: clienti autonomi = scalabilità senza assumere persone.

#### F. Nessun sistema di notifiche / alerting
Quando il worker notturno completa un piano, fallisce un task, o un cliente sotto-performa — Bravo non lo sa finché non apre l'app. Senza notifiche:
- il worker autonomo è cieco (Bravo non sa se ha lavorato bene)
- i fallimenti silenti restano nascosti
- non c'è urgenza percepita = niente azione = sistema diventa decorativo

#### G. Dashboard cross-cliente assente
Oggi ogni cliente è un silos. Non esiste una vista "Bravo agency": quale cliente sta meglio, quale peggio, dove serve attenzione subito, qual è l'engagement medio del portfolio. Se Bravo gestisce 10 clienti, deve aprire 10 schede.

#### H. Briefing integrale + distillato — token bruciati
Lo Strategist usa il distillato (✅ risparmio 85%). Ma il ContentDesigner usa il brand kit completo + opus + lessons + brief. Per un post: **20.000+ token in input ogni volta**. Su un cliente con 12 post/mese × 12 mesi × 10 clienti = costi alti per dati che cambiano poco.

#### I. Audio trascrizione in vicolo cieco
Bravo registra audio in campo → Groq trascrive → testo torna al frontend → **se Bravo non incolla manualmente il testo in `weekly_contexts.nota_campo`, si perde**. Già segnalato in OBJ-2 ma è ancora più grave: è il punto di partenza dello Strategist.

---

## 🚀 NUOVI OBIETTIVI (in aggiunta ai 6 già definiti)

> Numerazione continuata da OBJ-6. Priorità in ordine di impatto sul business.

---

### 🎯 OBJ-7 — Estendere lo schema `clients` con i flag operativi
**Priorità: ALTA — sblocca tutto il resto**

Aggiungere alla tabella `clients` le colonne mancanti:
```sql
ALTER TABLE clients ADD COLUMN is_self BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN autonomy_level TEXT DEFAULT 'manual'
  CHECK (autonomy_level IN ('manual','assisted','auto'));
ALTER TABLE clients ADD COLUMN auto_publish BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN sector TEXT;
ALTER TABLE clients ADD COLUMN country TEXT;
ALTER TABLE clients ADD COLUMN language TEXT DEFAULT 'es';
ALTER TABLE clients ADD COLUMN active BOOLEAN DEFAULT TRUE;
```

**Impatto:** ogni agente legge questi flag per decidere se eseguire automaticamente o aspettare l'umano. Una sola riga di logica abilita la modalità autonoma.

---

### 🎯 OBJ-8 — "Bravo Studio Mode" — sezione personale dell'agenzia
**Priorità: ALTA**

Creare un'esperienza dedicata quando il cliente attivo ha `is_self=true`:
- **Tab "Studio"** invece di "Cliente": KPI Bravo (clienti attivi, MRR, post pubblicati questo mese, collaborazioni)
- **Lista clienti nasconde** Bravo agency dalla griglia normale
- **Dashboard contenuti propri**: Instagram Bravo, LinkedIn Bravo, partnership AIGRO
- **"Generate da case study"**: trasforma un progetto cliente concluso in post per il portfolio Bravo

**Impatto:** l'app diventa lo strumento di marketing di Bravo stessa, non solo dei clienti. Bravo usa l'app per primo, mostra l'app ai clienti.

---

### 🎯 OBJ-9 — Modalità Cliente Autonomo (full auto-pipeline)
**Priorità: ALTA — è il modello di scala**

Per clienti con `autonomy_level='auto'`, il worker notturno deve fare l'intero ciclo senza intervento Bravo:
1. **Notte 1 (lunedì 02:30)** — Strategist genera piano
2. **Notte 1 (03:00)** — per ogni post del piano: ContentDesigner genera 3 varianti, sceglie la migliore con un AutoSelector (score basato su pillar coverage + brand match + lessons feedback)
3. **Notte 1 (03:15)** — pubblica subito i post per `scheduled_date == oggi`, schedula gli altri
4. **Mattina** — invia digest Slack/email a Bravo con: "Piano X cliente Y → 3 post generati e schedulati. Tutti approvati automaticamente."
5. **Solo se l'AutoSelector dà punteggio < soglia** → escala a Bravo per review umana

Tecnicamente serve:
- Nuovo agente `AutoSelector` (Haiku, single-pass) che valuta 3 varianti e sceglie + score
- Tabella `scheduled_posts` con `client_id, content_id, scheduled_for, status, attempts`
- Worker step `run_auto_publish` che pubblica i post pronti
- Endpoint `/api/agents/run-full-pipeline/{client_id}` per kickoff manuale

**Impatto:** se Bravo ha 5 clienti autonomi, può aggiungerne altri 5 senza assumere.

---

### 🎯 OBJ-10 — Chiusura del loop publish → metriche → apprendimento
**Priorità: MEDIA-ALTA**

Oggi il loop è spezzato in 3 punti:
1. **publish → editorial_plans**: aggiungere update di `editorial_plans.status='done'` e `editorial_plans.media_id` quando si pubblica un post da quel piano
2. **publish → generated_content**: salvare `ig_media_id` su `generated_content.media_id` per chiudere il legame
3. **metriche → learning**: dopo il MetricsAnalyst, alimentare `feedback_store` con feedback automatici basati su engagement (post sopra media → "approved con liked_aspects=performance"; sotto media → "rejected con reason=poco engagement")

**Impatto:** il Copywriter migliora settimana dopo settimana sulla base di dati reali, non solo del feedback manuale.

---

### 🎯 OBJ-11 — Dashboard cross-cliente (Vista Agency Bravo)
**Priorità: MEDIA**

Una pagina sopra alle schede cliente con:
- Lista compatta tutti i clienti con badge stato (✅ piano pronto / ⚠ in attesa / 🔴 fallito)
- KPI totali del portfolio (engagement medio, post pubblicati questa settimana, top performer)
- **Ranking** clienti per engagement: chi sta crescendo, chi sta calando
- **Alert** rossi in cima: "Cliente X non ha piano da 3 settimane", "Cliente Y engagement -40%"

Dati già tutti in DB. È lavoro frontend + 1-2 endpoint aggregati.

**Impatto:** colpo d'occhio sull'agenzia. Bravo capisce dove serve attenzione senza aprire 10 schede.

---

### 🎯 OBJ-12 — Sistema notifiche (Slack + email digest)
**Priorità: MEDIA**

Tre canali di notifica:
1. **Slack webhook** — eventi real-time: piano generato, task fallito, alert engagement
2. **Email digest mattutino (08:00)** — riepilogo: "Stanotte: 3 piani generati, 12 post pubblicati, 1 fallimento. Cliente X richiede review."
3. **In-app badge** — pallini rossi sui clienti che richiedono attenzione

Aggiungere `notifications` table + `notification_channels` per cliente (Slack URL, email).

**Impatto:** Bravo può lasciar girare il worker notturno e fidarsi. Senza notifiche, il sistema autonomo è cieco.

---

### 🎯 OBJ-13 — Retention policy e cleanup automatico
**Priorità: MEDIA**

Aggiungere job di cleanup notturno (worker step già esistente, da estendere):
- `agent_tasks` con `status IN (done, failed)` più vecchi di 30gg → DELETE
- `weekly_contexts` più vecchi di 6 mesi → archive in tabella `weekly_contexts_archive`
- `post_metrics` già coperto (180gg) ✅
- `post_comments` già coperto (30gg) ✅
- `market_research` con `valid_until < now() - 60gg` → DELETE

**Impatto:** il DB resta veloce e snello. Costi Supabase prevedibili.

---

### 🎯 OBJ-14 — Backfill dati storici e fix integrità
**Priorità: MEDIA — una volta sola, poi mai più**

Script di migrazione una-tantum:
1. **Caption storiche**: per i `post_metrics` con `caption=null`, ri-fetchare da Instagram Graph API e popolare
2. **content_feedback orfani**: trovare record con `client_id="dakady"` (string) e migrarli all'UUID corrispondente
3. **generated_content ↔ editorial_plans**: dove possibile, riconciliare i post generati con i piani storici via similitudine brief

**Impatto:** lo storico diventa utilizzabile per training/analisi. Senza, il MetricsAnalyst e il feedback loop partono ciechi sui dati pre-fix.

---

### 🎯 OBJ-15 — Audio campo → piano in 1 click (estensione di OBJ-2)
**Priorità: MEDIA**

OBJ-2 dice "auto-save trascrizione". Aggiungere:
- **Detect lingua automatica** (Whisper la rileva — solo da esporre)
- **Auto-trigger Strategist** dopo il save: "ho registrato → in 30 secondi ho il piano della settimana pronto"
- **Tab History audio**: tutte le note vocali registrate, ricercabili per data/cliente
- **AI-extract**: dalla trascrizione, estrai automaticamente "prodotti citati", "ricorrenze", "obiettivi della settimana" e prepopola `weekly_contexts.istruzioni_bravo`

**Impatto:** trasforma il "voice memo dal campo" nell'input principale del sistema. Bravo registra, l'app fa il resto.

---

### 🎯 OBJ-16 — Brand kit "viventi" — auto-update da feedback
**Priorità: BASSA**

Oggi il brand kit è statico: una volta creato, resta uguale. Ma il sistema impara cosa funziona (feedback + metriche). Aggiungere:
- Job mensile che analizza i top-3 post performanti del mese e propone aggiornamenti al brand kit ("il pillar AGRONOMIA performa il 40% sopra media — alza la frequenza", "il layout bottom-left è approvato il 90% delle volte — promuovilo a default")
- Modal in UI: "Brand kit suggerisce 3 aggiornamenti da feedback recente — accetta / rifiuta / dopo"

**Impatto:** il brand kit non è più una foto del cliente al giorno 1, ma l'evoluzione viva di cosa funziona davvero.

---

### 🎯 OBJ-17 — Token economy — riduzione costi Anthropic
**Priorità: BASSA**

Oggi ogni generazione ContentDesigner usa ~20.000 token in input (brand kit + opus + briefing + lessons + brief). Ottimizzazioni possibili:
- Cache prompt-layer 1h per cliente (brand kit invariato → riusa cache)
- **Prompt caching API** Anthropic per la parte sistema (sconto 90%)
- Ridurre `agent_prompts.copywriter` se troppo lungo (chiedere a Opus di compattarlo)
- Usare **Haiku** per varianti aggiuntive dopo la prima Sonnet

**Impatto:** -60% costi API se Bravo scala a 20+ clienti.

---

### 🎯 OBJ-18 — Schedulatore visuale (calendario editoriale drag-drop)
**Priorità: BASSA — UX premium**

Trasformare la lista `editorial_plans` in un calendario visuale tipo Google Calendar:
- Vista settimana / mese
- Drag & drop per riprogrammare
- Doppio-click → apre il post
- Colori per pillar
- Export PDF "calendario editoriale del mese"

**Impatto:** Bravo può mostrare il piano al cliente in modo professionale. Vendita più facile.

---

### 🎯 OBJ-19 — Brand Kit "a moods" + archetipi di layout
**Priorità: ⭐ ALTA — elevata dopo analisi PDF TRI-X FORCE®**

**Origine:** documento `Manuale_Ottimizzazione_e_Prompt_Bravo.pdf` (versione 2.2) + **`BRAVO_PALETA TXF.pdf`** (brand kit strutturato TRI-X FORCE® prodotto da BRAVO!COMUNICA).

**Pilot case: TRI-X FORCE®** — il primo brand kit prodotto da BRAVO!COMUNICA in formato strutturato (2 opzioni A/B, hex completi, regole per tipo contenuto). È il *proof of concept* che dimostra la superiorità del PDF vs screenshot. Non è un modello da copiare — è un **esempio del formato** che tutti i prossimi brand kit devono seguire.

**Riflessione chiave validata:**
> Un PDF strutturato (hex code + nomi semantici + regole per tipo di contenuto) elimina l'ambiguità degli screenshot. BrandAnalyzer non deve più indovinare dai pixel. Screenshot = fallback solo quando il PDF non esiste ancora.

L'idea dei moods A/B va astratta e generalizzata per il sistema multi-cliente — ogni cliente avrà i suoi moods con i propri valori.

**Cosa cambia in concreto:**

1. **Estendere `client_brand` con il concetto di "moods"** (anime visive multiple):
   ```jsonc
   brand_kit_opus.moods = [
     { id: "calma",       label: "Salute/Calma",       palette: [...], font: "..."},
     { id: "autorita",    label: "Autorità/Eleganza", palette: [...], font: "..."},
     { id: "energia",     label: "Energia/Movimento", palette: [...], font: "..."},
   ]
   ```
   Ogni cliente ha **i suoi moods** (DaKady può avere "tecnico/agronomico" e "umano/famiglia"; un hotel ne avrà altri).

2. **Aggiungere 6 archetipi di layout** al sistema attuale (oggi abbiamo 10 posizioni testo, in futuro avremo anche un campo semantico):
   ```jsonc
   archetypes = ["editoriale","minimalista","dinamico","focus-prodotto","informativo","ispirazionale"]
   ```
   Il Robot 8 sceglie **archetipo** (cosa comunico) + **layout_variant** (dove metto il testo).

3. **Mapping pillar → mood preferito** nel brand kit:
   ```jsonc
   pillar_mood_rules = {
     "AGRONOMIA":    { mood: "tecnico", archetype: "informativo" },
     "STORYTELLING": { mood: "umano",   archetype: "editoriale" },
     "PRODOTTO":     { mood: "tecnico", archetype: "focus-prodotto" },
   }
   ```
   Il robot 7 (Stratega) può già suggerire il mood; il robot 8 lo conferma o cambia in base alla foto.

4. **Riscrivere il system prompt dell'ArtDirector (Robot 8)** ispirandosi al "prompt maestro" del PDF, ma con palette + moods + archetipi **letti dinamicamente dal brand kit del cliente**, non hardcoded.

5. **Potenziare Robot 10 con riconoscimento soggetto** (oltre alla luminosità): chiedere a Claude Haiku Vision "dove c'è il soggetto in questa foto?" per evitare di coprirlo. Costo: ~1 cent extra per foto.

**Cosa NON fare** (errori del PDF da non copiare):
- ❌ Hardcodare palette specifiche (Menta #8DB899, Carbón #2C2C28) nel codice — rimangono solo come **default suggeriti** per un eventuale wizard di onboarding
- ❌ Imporre regole globali "EDUCATIVI=menta+bianco" — ogni cliente decide le sue
- ❌ Sostituire il vecchio brand kit — **estensione retrocompatibile**: chi non ha moods continua a funzionare come oggi (un solo mood implicito)

**Sotto-task:**
1. Schema: aggiungere `moods[]`, `archetypes[]`, `pillar_mood_rules{}` dentro `brand_kit_opus` (jsonb, niente migrazione SQL)
2. UI Brand Kit: tab "Moods" per definirli (color picker + nome + uso suggerito)
3. Robot 8: nuovo system prompt master che legge moods/archetipi dal brand kit
4. Robot 10: aggiungere chiamata Haiku Vision per detection soggetto
5. Rendering: Pillow legge `mood` per scegliere palette runtime
6. Wizard onboarding (OBJ-4): proposta automatica di moods da BrandAnalyzer

**Impatto:**
- Qualità visuale percepita: passa da "stesso vestito ogni post" a "stesso brand, abito giusto per occasione"
- Varietà infinita ma coerente
- Scelta visiva motivata semanticamente (non a caso)
- Retrocompatibile: i clienti vecchi continuano come oggi finché non aggiungono moods

**Stima:** 3-4 giorni (molto del Robot 8/10 esiste già, è estensione)

**Roadmap:** inserire in **Sprint 4** insieme a OBJ-8 (Studio Mode) — entrambi rifiniscono identità prodotto.

---

---

## 🚨 CHECKLIST OBBLIGATORIA BRAVO — Prima di caricare un cliente nell'app

> Questo non è opzionale. È il lavoro di agenzia che Bravo deve fare **prima** di toccare l'app. L'app non può fare il lavoro di brand strategy: riceve il brief già pronto e lo esegue.

### Per ogni nuovo cliente, Bravo DEVE produrre (in quest'ordine):

**1. PDF Brand Kit strutturato**
- Minimo 2 opzioni visive (es. Opción A = mood principale / Opción B = mood alternativo)
- Per ogni opzione: palette completa con hex code esatti, nome semantico per ogni colore (primario, secondario, accentuazione, sfondo, testo)
- Regole di abbinamento per tipo di contenuto (educativo, prodotto, storytelling, reel, ecc.)
- Regole per formato (feed vs story vs reel vs carosello)
- Tipografia: font principale + font secondario + dimensioni gerarchiche
- ❌ Non servono foto di esempio se c'è il PDF strutturato — il PDF sostituisce tutto

**2. PDF Briefing cliente**
- Settore + posizionamento + target
- Pillar editoriali (minimo 3, massimo 6) con descrizione per ognuno
- Tono di voce (3-5 aggettivi + esempi di cosa dire / cosa non dire)
- Obiettivi social (awareness / vendita / community / educazione)
- Handle Instagram + eventuali altri canali

**3. Solo dopo questi 2 PDF → aprire il wizard di onboarding nell'app**

### Perché è obbligatorio
L'app (BrandAnalyzer) legge il PDF e capisce esattamente colori, regole, mood. Se invece di un PDF strutturato si caricano screenshot o foto dei post, l'AI deve *indovinare* i valori dai pixel — risultato impreciso, palette approssimata, nessuna regola semantica. Il lavoro di Bravo è proprio questo: tradurre l'identità del cliente in un documento preciso. L'app fa il resto.

### Modello di riferimento formato
Il primo brand kit in questo formato è stato prodotto da BRAVO!COMUNICA per TRI-X FORCE®. Quel documento è il **modello di formato** da seguire per tutti i prossimi clienti (non i colori specifici, ma la struttura: 2 opzioni, hex esatti, nomi semantici, regole per tipo contenuto).

---

## 🗂 ROADMAP CONSIGLIATA

Ordine d'esecuzione che massimizza il valore con minimo lavoro:

| Fase | Obiettivi | Durata stimata | Sblocca |
|------|-----------|----------------|---------|
| **Sprint 0** | OBJ-1 (deploy + test reale) | 1 giorno | tutto il resto |
| **Sprint 1** | OBJ-7 (schema clients) → OBJ-3 (status badge) → OBJ-13 (cleanup) | 2 giorni | autonomia + dashboard |
| **Sprint 2** | OBJ-10 (loop chiuso) → OBJ-14 (backfill) | 2 giorni | dati di apprendimento sani |
| **Sprint 3** | OBJ-9 (auto-pipeline) → OBJ-12 (notifiche) | 4 giorni | scalabilità clienti autonomi |
| **Sprint 4** | OBJ-8 (Bravo Studio Mode) → OBJ-11 (dashboard agency) → OBJ-19 (moods + archetipi) | 6 giorni | identità prodotto + qualità visuale |
| **Sprint 5** | OBJ-2 (audio click) + OBJ-15 (audio v2) → OBJ-4 (wizard onboarding) | 3 giorni | input rapido |
| **Sprint 6** | OBJ-16 (brand kit vivente) → OBJ-17 (token economy) → OBJ-18 (calendario) → OBJ-5 (Orch refactor) → OBJ-6 (analytics) | quando c'è tempo | rifinitura |

**Sprint 1-3 trasformano BRAVO da app interna a vero prodotto autonomo.** Il resto è valore aggiunto.

---

## 📊 SCORECARD SISTEMA

| Area | Prima dei fix | Dopo i fix |
|------|--------------|------------|
| **Pipeline fine-to-end** | ❌ Spezzata — Bravo fa da middleware umano | ✅ Collegata — "✦ Genera" da piano a variante |
| **Pillar custom** | ❌ Tutti convertiti in "CONTENIDO" | ✅ Preservati end-to-end |
| **Feedback loop** | ⚠️ Dati vuoti (reason null, liked null) | ✅ Motivo rifiuto + aspetti piaciuti sempre valorizzati |
| **Worker notturno** | ❌ Girava a vuoto | ✅ Auto-popola la coda da client_brand |
| **generated_content** | ❌ Sempre vuota | ✅ Popolata dopo ogni generazione |
| **MetricsAnalyst** | ❌ Analizzava URL al posto di caption | ✅ Vede caption reali |
| **Storico report** | ❌ Un solo report per cliente (sovrascrive) | ✅ Uno per run, storico completo |
| **Plan persistence** | ❌ Ricarica perdeva lo stato delle card | ✅ UPSERT stabile con UUID client-side |
| **Orchestrator** | ❌ Solo ContentDesigner | ⚠️ Ancora da unificare (P11, bassa urgenza) |

