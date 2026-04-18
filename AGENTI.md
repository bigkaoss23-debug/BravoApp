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

## 🚧 FASE 1 — stato aggiornato (18 aprile 2026)

| # | Componente | Stato | Commit / Note |
|---|---|---|---|
| 0 | **Sistema Briefing cliente** (upload PDF → testo integrale in Supabase) | ✅ deployato | `1f09cb1` |
| 1 | **Tabelle Supabase** (`agent_tasks`, `market_research`, `editorial_plans`) | ✅ create | `69d6782` |
| 2 | **Ricercatore di Mercato** | ✅ funzionante e testato | `94303bb` |
| 3 | **Stratega Editoriale** | ✅ funzionante e testato | `209e5df` |
| 4 | **Coordinatore** | 🔜 prossimo passo | |
| 5 | **Designer — collegamento a `agent_tasks`** | 🔜 dopo Coordinatore | |
| 6 | **Cron notturno su Railway** | 🔜 dopo Coordinatore | |
| 7 | **UI Bravo: tab "Piano settimanale"** | 🔜 dopo cron | |

### Dipendenza tra gli agenti (chi chiama chi)

```
  Coordinatore
      │
      ├─► Ricercatore di Mercato   (solo se ricerca > 30 giorni o force=True)
      │
      ├─► Stratega Editoriale      (sempre — produce il piano della settimana)
      │
      └─► Designer                 (per ogni post nel piano editoriale)
```

---

## 📋 Ruoli dettagliati

### 1. Coordinatore (`backend/agents/coordinator.py`) — da costruire

**Compito:** ogni lunedì notte (o quando attivato manualmente), decide cosa serve fare per ogni cliente attivo.

**Input:**
- Lista clienti attivi
- Briefing di ogni cliente (`client_briefings.briefing_text`)
- Obiettivi della settimana (`strategy_objectives`)
- Data ultima ricerca di mercato (per capire se serve rigenerare)
- Data ultimo piano editoriale prodotto

**Output:**
- Task per Ricercatore (se ricerca scaduta o assente)
- Task per Stratega (sempre — uno per cliente)

**Regola:** non genera contenuto, **orchestra e basta**.

---

### 2. Ricercatore di Mercato (`backend/agents/market_researcher.py`) ✅

**Compito:** per ogni settore (agricoltura, ristorazione, fitness), produce un report aggiornato: trend, parole chiave, competitor, stagionalità, hashtag.

**Input:**
- Settore del cliente (`clients.sector`)
- Briefing integrale del cliente (`client_briefings.briefing_text`)
- Data ultima ricerca (per non rifare lavoro fresco)

**Output salvato in:** `market_research` (per settore, con `valid_until` = 30 giorni)

**Frequenza:** mensile per settore. Se due clienti operano nello stesso settore, la ricerca è condivisa.

**Modalità test:**
```
POST /api/agents/market-research/run
  client_id=<uuid>
  force=false   → riusa se valida (default)
  force=true    → rigenera sempre
```

**Risultato verificato (DaKady, 18 apr 2026):**
- 20 keyword tecniche del settore
- 35 hashtag Instagram/LinkedIn
- 4 trend principali + 6 opportunità di contenuto concrete
- Report narrativo > 600 parole in spagnolo
- Valido fino al 18 maggio 2026

---

### 3. Stratega Editoriale (`backend/agents/strategist.py`) ✅

**Compito:** trasforma briefing + brand kit + ricerca di mercato + storico post in un **piano editoriale concreto** per la settimana (3 post: Lun reel / Mer carrusel / Ven reel/story).

**Input:**
- `client_briefings.briefing_text` integrale
- `client_brand` (tono, pilastri, layout, note)
- `market_research` più recente valida per il settore
- `editorial_plans` ultimi 30 giorni (evita ripetizioni pilastri)
- `generated_content` ultimi 30 giorni (storico post già generati)

**Output salvato in:** `editorial_plans` — ogni riga è un post pianificato con:
- `pillar`, `platform`, `format`, `scheduled_date`
- `angle` — l'angolo specifico del post (1 riga)
- `brief` — brief completo per il Designer (visivo + messaggio + headline + caption + hashtag)

**Non genera immagini né testo finale** — produce il brief che passa al Designer.

**Modalità test:**
```
POST /api/agents/strategist/run
  client_id=<uuid>
  week_start=YYYY-MM-DD   → default: prossimo lunedì
  force=false              → salta se piano già esiste (default)
  force=true               → rigenera sempre
```

**Lettura piano:**
```
GET /api/agents/editorial-plan/<client_id>?week_start=YYYY-MM-DD
```

**Risultato verificato (DaKady, settimana 20-24 apr 2026):**
- Lun 20: CLIENTE / Reel — Visita a finca con Sistema Dakady completo
- Mer 22: EQUIPO / Carrusel — Diego e Camilo, la equación padre-hijo
- Ven 24: AGRONOMIA / Reel — Camilo diagnosticando en finca vs venditore

Ha correttamente evitato PRODUCTO (usato 4 volte di fila) e ha usato le opportunità dalla ricerca di mercato.

---

### 4. Designer (già esiste — doppio ingresso)

**Compito:** produce il post finale (immagine composita + headline + caption).

**Due modi di attivarlo — convivono:**

1. **Manuale (come oggi, NON tocchiamo):**
   Bravo → tab Agente → scrive brief → clicca "Genera" → risposta in tempo reale.
   Endpoints: `POST /api/content/generate` e `POST /api/content/generate-with-photo`

2. **Automatico (da implementare):**
   Lo Stratega inserisce un task in `agent_tasks` con `agent_name='designer'` → worker del Designer lo prende dalla coda.

---

## 🗄️ Tabelle Supabase — stato attuale

| Tabella | Contenuto | Stato |
|---|---|---|
| `clients` | Anagrafica clienti | ✅ 4 clienti (DaKady, Altair, L'Antorgia, La Dieci) |
| `client_briefings` | Testo integrale briefing | ✅ DaKady caricato (15.232 char, manuale integrale) |
| `client_brand` | Brand kit (colori, font, tono, pilastri, layout, logo) | ✅ DaKady completo, Altair parziale |
| `agent_tasks` | Coda di lavoro condivisa tra agenti | ✅ creata |
| `market_research` | Report mercato per settore (30 gg) | ✅ DaKady/Agricultura generato |
| `editorial_plans` | Piani settimanali (una riga = un post) | ✅ settimana 20-24 apr creata |
| `agent_logs` | Log azioni agenti | ✅ preesistente |
| `generated_content` | Post già generati | ✅ preesistente |
| `content_feedback` | Approvazioni/rifiuti Bravo | ✅ preesistente |

---

## 🔌 Endpoint agenti — riferimento rapido

```
# Ricercatore di Mercato
POST /api/agents/market-research/run
  client_id, force (bool)

# Stratega Editoriale
POST /api/agents/strategist/run
  client_id, week_start (YYYY-MM-DD), force (bool)

# Piano editoriale (lettura)
GET  /api/agents/editorial-plan/{client_id}?week_start=YYYY-MM-DD

# Status dashboard (tutti gli agenti per un cliente)
GET  /api/agents/status/{client_id}

# Coda task (debug)
GET  /api/agents/tasks/{client_id}

# Catena completa (test manuale)
POST /api/agents/run-chain
  client_id, agents (es. "market_researcher,strategist"), force (bool)
```

---

## 🔄 Loop di lavoro (come si passano la palla gli agenti)

```
1. Coordinatore → INSERT agent_tasks (market_researcher, client=dakady)  [se scaduta]
2. Coordinatore → INSERT agent_tasks (strategist, client=dakady)
3. Market Researcher worker prende task → lavora → salva market_research → done
4. Strategist worker prende task → legge briefing + brand kit + market research → salva editorial_plans → done
5. Per ogni post in editorial_plans → INSERT agent_tasks (designer)
6. Designer worker prende task → genera immagine + testo → salva generated_content → done
7. Tutto visibile in frontend Bravo al mattino
```

---

## ⏰ Scheduler (lavori notturni) — da implementare

- **Cron Railway**: ogni lunedì ore 02:00 UTC → sveglia il Coordinatore
- **Bottone manuale**: Bravo può lanciare un "giro" dalla UI della pagina cliente
- **API Batch Anthropic**: opzione futura per ridurre costi del 50% (risposta entro 24h)

---

## 🧪 Modalità test manuale (disponibile ora)

Ogni agente può essere lanciato singolarmente o in catena senza aspettare il cron:

```bash
# Test singolo agente
curl -X POST https://bravoapp-production.up.railway.app/api/agents/market-research/run \
  -F "client_id=cc000001-0000-0000-0000-000000000001" -F "force=true"

curl -X POST https://bravoapp-production.up.railway.app/api/agents/strategist/run \
  -F "client_id=cc000001-0000-0000-0000-000000000001" -F "force=true"

# Test catena completa
curl -X POST https://bravoapp-production.up.railway.app/api/agents/run-chain \
  -F "client_id=cc000001-0000-0000-0000-000000000001" \
  -F "agents=market_researcher,strategist" -F "force=true"

# Controlla stato
curl https://bravoapp-production.up.railway.app/api/agents/status/cc000001-0000-0000-0000-000000000001
```

---

## 🗺️ Roadmap

### Fase 1 — in corso
- [x] Sistema Briefing cliente (upload PDF → testo editabile) — ✅ `1f09cb1`
- [x] Tabelle `agent_tasks`, `market_research`, `editorial_plans` — ✅ `69d6782`
- [x] Ricercatore di Mercato — ✅ `94303bb` + `3f33969`
- [x] Stratega Editoriale — ✅ `209e5df`
- [x] Modalità test manuale (force + run-chain + status) — ✅ `3f33969`
- [ ] Coordinatore ← **prossimo passo**
- [ ] Collegare Designer a `agent_tasks` (mantenendo modalità manuale)
- [ ] Cron notturno su Railway (ogni lunedì 02:00 UTC)
- [ ] UI Bravo: tab "Piano settimanale" nella pagina cliente

### Fase 2 — dopo
- Analista Performance
- Copywriter specialista
- Publisher / Scheduler piattaforme

### Fase 3 — in pausa
- Ricercatore Interno BRAVO (agente per l'agenzia stessa)

---

*Aggiornato il 18 aprile 2026 — dopo test Ricercatore + Stratega su DaKady.*
*Questo documento è la base. Si aggiorna a ogni nuova decisione architetturale.*
