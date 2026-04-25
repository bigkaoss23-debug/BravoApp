# AGENTI.md — Architettura Multi-Agente BRAVO

Sistema di agenti AI che lavora come una vera agenzia di marketing, in modo asincrono e notturno, senza stress di tempo.

---

## 🎯 Filosofia di base

- **Zero fretta**: il lavoro pesante gira di notte, in batch. Anche 2 ore per un task non è un problema.
- **Massimo contesto**: agli agenti si passa TUTTO il contesto disponibile (briefing integrale, storico, performance, ricerca di mercato), non riassunti.
- **Loop autonomo**: ogni agente ha una coda di lavoro, legge, esegue, salva, dorme. Quando c'è nuovo lavoro, riprende.
- **Un solo punto di ingresso**: solo il **Coordinatore** viene svegliato da un timer. Lui decide chi coinvolgere.
- **Agenti generici**: un solo agente per ruolo, riusabile per tutti i clienti. Il "sapere del cliente" sta nei dati (briefing + brand kit), non nel codice.
- **Mai riassumere i documenti cliente**: il briefing e il manuale di marca vengono passati agli agenti in forma integrale — ogni frase è intenzionale.
- **Contesto settimanale = focus di tutti gli agenti**: se questa settimana si parla di un problema specifico in campo, TUTTI gli agenti (Stratega, Designer) devono lavorare su quello. Non temi diversi — una storia sola in tre formati.

---

## 🗂️ Organigramma completo (visione finale)

```
🎯 COORDINATORE
      │
      ├── 🧠 STRATEGIA
      │   ├── 📊 Ricercatore di Mercato
      │   ├── 📅 Stratega Editoriale
      │   └── 📈 Analista Performance          ← fase 2
      │
      ├── 🎨 CREATIVO
      │   ├── ✍️  Copywriter                    ← fase 2
      │   └── 🖼️  Designer                      ← già esiste
      │
      └── 🚀 OPERATIVO
          └── 📤 Publisher                      ← fase 2

🔍 Ricercatore Interno BRAVO                   ← fase 3 (in pausa)
```

---

## 🎙️ Flusso Contesto Settimanale (input reale dal campo)

Il contesto settimanale è la **materia prima di tutta la settimana**. Viene dal campo — non inventato.

### Come nasce il contenuto reale

1. Il cliente chiama Bravo e spiega: "questa settimana voglio spingere questo prodotto / c'è questo problema"
2. Bravo va sul campo con il videomaker + CEO/assistente Bravo
3. Si registra tutto: intervista con il cliente, conversazione con tecnici, visita in serra (anche 30 minuti)
4. Questo audio è la materia prima della settimana

### Pipeline audio → contesto

```
Audio (mp3/wav/m4a)
    │
    ▼
Whisper (Speech-to-Text)  ← in memoria, non salvato
    │
    ▼
Trascrizione grezza        ← non salvata
    │
    ▼
Claude estrae:
  - Problema/tema principale
  - Prodotti/soluzioni menzionati
  - Persone coinvolte
  - Angoli narrativi per le Stories
    │
    ▼
weekly_contexts (Supabase) ← solo il risultato estratto, compatto
    │
    ▼
Tutti gli agenti leggono weekly_contexts come punto di partenza
```

**Regola storage**: l'audio non si salva, la trascrizione grezza non si salva. Si salva solo il contesto estratto da Claude in `weekly_contexts`.

### Input alternativo (manuale)

Bravo può anche compilare il contesto settimanale direttamente in un textarea — utile quando non c'è audio disponibile o per correggere l'estrazione automatica.

---

## 🚧 STATO ATTUALE — 19 aprile 2026

### Sistema Clienti (frontend + backend)

| # | Feature | Stato | Note |
|---|---|---|---|
| ✅ | Upload PDF briefing → testo in Supabase | **deployato** | `client_briefings` |
| ✅ | Estrazione profilo cliente dal briefing (Claude Sonnet) | **deployato** | `POST /api/briefing/extract-profile/{client_id}` |
| ✅ | Tab "Estrategia" nel profilo cliente | **deployato** | legge `client_profile` |
| ✅ | Tab "Perfil" nel profilo cliente | **deployato** | legge `client_profile` |
| ✅ | Tab "Proyectos" — estrazione AI progetti dal briefing | **deployato oggi** | `POST /api/briefing/extract-projects/{client_id}` |
| ✅ | Approve / Rechazar proyectos | **deployato oggi** | `PATCH /api/briefing/projects/{project_id}` |
| ✅ | Auto-apertura tab Proyectos all'apertura cliente | **deployato oggi** | `_clienteActiveTab = 'proyectos'` |
| ✅ | Trigger automatico estrazione al salvataggio briefing | **deployato oggi** | in `briefingSave()` |
| ✅ | Estrazione team BRAVO dal briefing → auto-assign | **deployato** | `GET /api/team/auto-assign/{client_id}` |
| ✅ | Tab "Equipo" per ogni cliente con team assegnato | **deployato** | `renderClienteEquipoSection()` |
| ✅ | Task clienti (Nivel 1 manuale + Nivel 2 AI) | **deployato** | `team_tasks` Supabase |

### Sistema Agenti (pipeline AI)

| # | Componente | Stato | Note |
|---|---|---|---|
| ✅ | Ricercatore di Mercato | funzionante e testato | commit `94303bb` |
| ✅ | Stratega Editoriale | funzionante e testato | legge `weekly_contexts` |
| ✅ | Endpoint contesto settimanale (POST/GET) | deployato | |
| ✅ | Tab "Agentes" nel frontend | deployato | |
| 🔜 | Trascrizione audio (Whisper → Claude) | da costruire | |
| 🔜 | Coordinatore | da costruire | |
| 🔜 | Designer → agent_tasks (automatico) | da costruire | |
| 🔜 | Cron notturno Railway | da costruire | |

---

## 📱 ROADMAP FRONTEND — Proyectos (prossimi step da implementare)

Questa è la lista delle feature da costruire nel tab **Proyectos**, in ordine di priorità concordata con Bravo il 19 aprile 2026.

### #1 — Programar + Calendario Timeline ← **PROSSIMO**

**Cosa fa:**
- Bottone **"📅 Programar"** su ogni card progetto (accanto ad Aprobar/Rechazar)
- Click apre un modal con:
  - Fecha inicio (date picker)
  - Fecha fin (date picker)
  - Asignar a (dropdown con i 3 membri del team BRAVO: Carlos, Andrea, Mari)
  - Presupuesto € (solo se categoria = PUBLICIDAD)
- Al conferma: salva start_date, end_date, assigned_to, budget_eur in Supabase + status = 'aprobado'
- Il tab **Calendario** (oggi vuoto) mostra una **timeline / Gantt** con tutti i progetti programmati del cliente, disposti per mese target
- Vista mensile: ogni mese mostra i progetti attivi con barre colorate per categoria

**SQL già aggiunto in Supabase** (`client_projects`):
```sql
ALTER TABLE client_projects
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS assigned_to text,
ADD COLUMN IF NOT EXISTS budget_eur integer;
```

**File da modificare:** `bravo.js` (modal Programar + renderCalendarioSection), `bravo.html` (CSS modal + timeline)

---

### #2 — Workflow Estado Esteso

**Cosa fa:**
- Oggi: `propuesto → aprobado / rechazado`
- Aggiungere: `propuesto → aprobado → planificado → en progreso → en revisión → completado`
- Progress bar visibile sulla card
- Badge colorato per ogni stato: aprobado=verde, en progreso=arancione, completado=grigio
- Bottone per avanzare stato manualmente (freccia →)

**SQL:**
```sql
-- Nessuna modifica SQL — il campo status è già text in client_projects
```

---

### #3 — Asignación Team per Progetto

**Cosa fa:**
- Ogni progetto mostra avatar del membro assegnato (Carlos / Andrea / Mari)
- Se non assegnato: pulsante "Asignar"
- Nel tab Equipo (principale): ogni membro mostra quanti progetti ha attivi
- Auto-suggerimento in base al ruolo: categoria CONTENIDO → Mari, PUBLICIDAD → Carlos, ALIANZAS → Andrea

---

### #4 — Auto-link Proyectos → Agentes

**Cosa fa:**
- Su ogni card di tipo CONTENIDO: bottone **"⚡ Generar con Agentes"**
- Click apre il tab Agentes con il brief precompilato dal contesto del progetto (titolo + descrizione + entregable)
- Risparmia copy-paste manuale ogni volta

---

### #5 — Editar antes de Aprobar

**Cosa fa:**
- Bottone **"✏️ Editar"** su ogni card
- Click apre inline editing: titolo, descrizione, categoria, mes target modificabili
- Salva con PATCH su Supabase prima di approvare
- Utile quando l'AI propone qualcosa di giusto ma la descrizione va aggiustata

---

### #6 — Acciones Masivas + Filtros KPI

**Cosa fa:**
- Checkbox multi-selezione sulle card
- "Aprobar seleccionados" / "Programar seleccionados" in batch
- Filtro per mese target (oltre che per categoria già presente)
- Banner in alto: "5 proyectos para Mes 5 · 2 sin asignar · 1 en progreso"
- Ordinamento per: priorità, mese target, categoria

---

### #7 — Export Propuesta PDF per Cliente

**Cosa fa:**
- Bottone **"📄 Exportar propuesta"** in cima alla lista Proyectos
- Genera PDF brandizzato BRAVO con solo i progetti approvati
- Layout professionale: logo BRAVO + nome cliente + lista progetti con descrizione + mese target + budget
- Usabile come documento commerciale da inviare al cliente per validazione

**Backend:** endpoint `GET /api/briefing/projects/{client_id}/export-pdf` con `reportlab` o `weasyprint`

---

## 🗄️ Tabelle Supabase — stato completo

| Tabella | Contenuto | Stato |
|---|---|---|
| `clients` | Anagrafica clienti | ✅ 4 clienti (DaKady, Altair, L'Antorgia, La Dieci) |
| `client_briefings` | Testo integrale briefing PDF | ✅ DaKady + Altair caricati |
| `client_brand` | Brand kit (colori, font, tono, pilastri, layout, logo) | ✅ DaKady completo, Altair parziale |
| `client_profile` | Profilo estratto: team, contatti, storia, strategia, pilastri, scope, partner | ✅ creata + endpoint attivo |
| `client_projects` | Progetti marketing estratti dal briefing con status approve/reject | ✅ creata oggi + deploy |
| `agent_tasks` | Coda di lavoro condivisa tra agenti | ✅ creata |
| `market_research` | Report mercato per settore (30 gg) | ✅ DaKady/Agricultura generato |
| `editorial_plans` | Piani settimanali (una riga = un post) | ✅ settimana 20-24 apr creata |
| `weekly_contexts` | Contesto reale della settimana (tema, prodotti, chi in campo, note) | ✅ creata |
| `team_tasks` | Task assegnati ai membri del team per cliente | ✅ creata |
| `agent_logs` | Log azioni agenti | ✅ preesistente |
| `generated_content` | Post già generati | ✅ preesistente |
| `content_feedback` | Approvazioni/rifiuti Bravo | ✅ preesistente |

---

## 🔌 Endpoint — riferimento rapido

```
# ── BRIEFING ──
POST /api/briefing/{client_id}               → salva briefing
GET  /api/briefing/{client_id}               → legge briefing

# ── PROFILO CLIENTE (estratto da AI) ──
POST /api/briefing/extract-profile/{client_id}  → Claude estrae team/storia/strategia → client_profile
GET  /api/briefing/profile/{client_id}          → legge profilo da Supabase

# ── PROGETTI (estratti da AI) ──
POST /api/briefing/extract-projects/{client_id} → Claude propone 10-18 progetti → client_projects
GET  /api/briefing/projects/{client_id}         → legge progetti da Supabase
PATCH /api/briefing/projects/{project_id}       → aggiorna status (aprobado/rechazado/...)

# ── TEAM ──
GET  /api/team/auto-assign/{client_id}       → estrae nomi team dal briefing
POST /api/team/suggest-tasks                 → AI suggerisce task per membro

# ── AGENTI AI ──
POST /api/agents/market-research/run         → Ricercatore di Mercato
POST /api/agents/strategist/run              → Stratega Editoriale
GET  /api/agents/editorial-plan/{client_id}  → legge piano editoriale
POST /api/agents/weekly-context/{client_id}  → salva contesto settimanale manuale
GET  /api/agents/weekly-context/{client_id}  → legge contesto settimanale
GET  /api/agents/status/{client_id}          → stato tutti gli agenti
POST /api/agents/run-chain                   → catena completa (test)

# DA COSTRUIRE:
POST /api/agents/transcribe-audio            → Whisper → Claude → weekly_contexts
GET  /api/briefing/projects/{client_id}/export-pdf  → PDF proposta per cliente
```

---

## 🗺️ Roadmap completa

### Fase 1 — Sistema Clienti (quasi completo)
- [x] Upload + salvataggio briefing PDF
- [x] Estrazione profilo automatica (team, strategia, storia)
- [x] Tab Estrategia, Perfil, Equipo, Briefing, Agentes nel profilo cliente
- [x] Tab Proyectos — estrazione AI + Aprobar/Rechazar ← **deployato oggi**
- [ ] **#1 Programar + Calendario timeline** ← **PROSSIMO**
- [ ] **#2 Workflow estado esteso** (propuesto → completado)
- [ ] **#3 Asignación team per progetto**
- [ ] **#4 Auto-link Proyectos → Agentes**
- [ ] **#5 Editar antes de aprobar**
- [ ] **#6 Acciones masivas + filtros KPI**
- [ ] **#7 Export propuesta PDF**

### Fase 1 — Pipeline Agenti (in corso)
- [x] Ricercatore di Mercato
- [x] Stratega Editoriale
- [x] Endpoint contesto settimanale
- [ ] Trascrizione audio (Whisper → Claude → weekly_contexts)
- [ ] Coordinatore
- [ ] Designer → agent_tasks (automatico, mantenendo manuale)
- [ ] Cron notturno Railway (ogni lunedì 02:00 UTC)

### Fase 2 — dopo
- Analista Performance
- Copywriter specialista
- Publisher / Scheduler piattaforme

### Fase 3 — in pausa
- Ricercatore Interno BRAVO (agente per l'agenzia stessa)

---

*Aggiornato il 19 aprile 2026 — dopo deploy tab Proyectos + pianificazione 7 feature UX.*
*Riprendere da: implementazione #1 — Programar + Calendario Timeline.*
