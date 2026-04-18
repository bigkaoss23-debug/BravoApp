# AGENTI.md — Architettura Multi-Agente BRAVO

Sistema di agenti AI che lavora come una vera agenzia di marketing, in modo asincrono e notturno, senza stress di tempo.

---

## 🎯 Filosofia di base

- **Zero fretta**: il lavoro pesante gira di notte, in batch. Anche 2 ore per un task non è un problema.
- **Massimo contesto**: agli agenti si passa TUTTO il contesto disponibile (briefing integrale, storico, performance, ricerca di mercato), non riassunti.
- **Loop autonomo**: ogni agente ha una coda di lavoro, legge, esegue, salva, dorme. Quando c'è nuovo lavoro, riprende.
- **Un solo punto di ingresso**: solo il **Coordinatore** viene svegliato da un timer. Lui decide chi coinvolgere.

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

## 🚧 FASE 1 — cosa costruiamo ora

| # | Agente | Stato |
|---|---|---|
| 1 | **Coordinatore** | da costruire |
| 2 | **Ricercatore di Mercato** | da costruire |
| 3 | **Stratega Editoriale** | da costruire |
| 4 | **Designer** | già esiste (`backend/agents/designer.py` + `content_designer.py`) |

### Dipendenza tra gli agenti (chi chiama chi)

```
  Coordinatore
      │
      ├─► Ricercatore di Mercato   (solo se la ricerca è vecchia > 30 giorni)
      │
      ├─► Stratega Editoriale      (sempre, produce il piano della settimana)
      │
      └─► Designer                 (per ogni post nel piano)
```

---

## 📋 Ruoli dettagliati

### 1. Coordinatore (`backend/agents/coordinator.py`)

**Compito:** ogni lunedì notte (o quando attivato manualmente), decide cosa serve fare per ogni cliente attivo.

**Input:**
- Lista clienti attivi
- Briefing di ogni cliente (`clients.briefing_text`)
- Obiettivi della settimana (`strategy_objectives`)
- Calendario (`calendar_events`)
- Ultimo piano editoriale prodotto

**Output:**
- Task per Stratega (uno per cliente)
- Eventualmente task per Ricercatore di Mercato (se la ricerca è scaduta)

**Regola:** non genera contenuto, **orchestra e basta**.

---

### 2. Ricercatore di Mercato (`backend/agents/market_researcher.py`)

**Compito:** per ogni categoria (agricoltura, ristorazione, fitness), produce un report di mercato aggiornato: trend, parole chiave, competitor, stagionalità, hashtag del momento.

**Input:**
- Categoria del cliente
- Briefing del cliente (per capire il posizionamento)
- Data ultima ricerca (per non rifare lavoro fresco)

**Output salvato in:** tabella `market_research` (per categoria, con `valid_until`)

**Frequenza:** mensile per categoria. Se uno stesso settore serve 2 clienti, la ricerca è condivisa.

---

### 3. Stratega Editoriale (`backend/agents/strategist.py`)

**Compito:** trasforma briefing + obiettivi + ricerca di mercato in un **piano editoriale concreto** (es. "3 post questa settimana: Mar PRODUCTO, Gio AGRONOMIA, Sab EQUIPO — con angolo X, messaggio Y").

**Input:**
- `client_briefing` integrale (non riassunto)
- Ultima `market_research` per la categoria del cliente
- Obiettivi attivi del cliente
- Ultimi 30 giorni di post pubblicati (per evitare ripetizioni)

**Output salvato in:** tabella `editorial_plans` → ogni riga è un post pianificato con tutti i dettagli (pilastro, data, angolo, brief dettagliato, piattaforma).

**Non genera immagini né testo finale** — produce il **brief** che passerà al Designer.

---

### 4. Designer (già esiste — doppio ingresso)

**Compito:** produce il post finale (immagine composita + headline + caption).

**Due modi di attivarlo — convivono:**

1. **Manuale (come oggi, NON tocchiamo):**
   Bravo va nella tab Agente, scrive il brief, clicca "Genera" → risposta in tempo reale.
   Endpoint: `POST /api/content/generate` e `POST /api/content/generate-with-photo`

2. **Automatico (nuovo):**
   Lo Stratega inserisce un task in `agent_tasks` con `agent_name='designer'` → un worker del Designer lo prende dalla coda e lavora.

**Regola importante:** il Designer deve funzionare **anche in autonomia**, per i test manuali di Bravo sull'evoluzione del sistema. La coda è un'aggiunta, non un sostituto.

---

## 🗄️ Nuove tabelle Supabase

| Tabella | Contenuto | Note |
|---|---|---|
| `client_briefings` | Testo integrale del briefing per cliente (editabile, con versioning) | Vedi sezione Briefing |
| `market_research` | Report mercato per categoria | Scadenza 30 giorni |
| `editorial_plans` | Piani settimanali prodotti dallo Stratega | Una riga per post pianificato |
| `agent_tasks` | Coda di lavoro condivisa tra agenti | Stati: pending, running, done, failed |
| `agent_logs` | Già esiste — log di ogni azione agente | Resta com'è |

### Schema `agent_tasks` (esempio)
```sql
id uuid primary key
agent_name text         -- 'strategist', 'designer', 'market_researcher'
client_id uuid
payload jsonb           -- input per l'agente
status text             -- pending | running | done | failed
result jsonb            -- output dell'agente
created_at timestamp
started_at timestamp
completed_at timestamp
```

---

## 📥 Briefing cliente (fondamento di tutto)

Il briefing è la **fonte di verità** per ogni cliente. Senza un briefing fatto bene, tutti gli agenti lavorano al buio.

### Come funziona
1. Bravo va nella **pagina cliente** → tab **Briefing**
2. Carica un PDF **oppure** scrive/incolla testo
3. Il backend estrae il **testo grezzo integrale** (nessun riassunto)
4. Il testo va in una textarea modificabile — Bravo può correggerlo a mano
5. Click "Salva" → `client_briefings.briefing_text`
6. Da quel momento ogni agente lo usa **come contesto puro**

### Perché testo integrale e non PDF
- Modificabile in qualsiasi momento senza ricaricare file
- Gli agenti ricevono il contenuto senza filtri intermedi
- Zero perdita di dettagli (Claude riassume solo quando glielo chiedi esplicitamente)

### Versioning
La tabella `client_briefings` tiene **uno storico** — ogni "Salva" crea una nuova versione. Gli agenti usano sempre l'ultima, ma Bravo può tornare indietro se serve.

---

## ⏰ Scheduler (lavori notturni)

- **Cron Railway**: ogni lunedì ore 02:00 UTC → sveglia il Coordinatore
- **Modalità batch Anthropic**: le chiamate a Claude degli agenti usano l'API Batch (50% più economica, risposta entro 24h — perfetto per uso notturno)
- **Bottone manuale**: Bravo può anche lanciare un "giro" su richiesta dalla UI (es. pulsante "Genera piano settimanale" nella pagina cliente)

---

## 🔄 Loop di lavoro (come si passano la palla gli agenti)

```
1. Coordinator → INSERT agent_tasks (strategist, client=dakady)
2. Strategist worker (loop) prende il task pending
3. Strategist lavora 20-40 minuti → salva plan + INSERT agent_tasks (designer × 3)
4. Designer worker prende i task → lavora → salva post
5. Tutto visibile in frontend Bravo al mattino
```

Ogni worker è un processo Python che:
- Legge `agent_tasks` dove `agent_name=lui` e `status=pending`
- Prende il task, marca `running`, fa il lavoro, salva `done` con `result`
- Ricomincia

---

## 🗺️ Roadmap

### Fase 1 — in corso
- [ ] Sistema Briefing cliente (upload PDF → testo editabile)
- [ ] Tabella `agent_tasks` + worker loop base
- [ ] Coordinatore
- [ ] Ricercatore di Mercato
- [ ] Stratega Editoriale
- [ ] Collegare Designer a `agent_tasks`
- [ ] Cron notturno su Railway
- [ ] UI Bravo: tab "Piano settimanale" nel cliente

### Fase 2 — dopo
- Analista Performance
- Copywriter specialista
- Publisher / Scheduler piattaforme

### Fase 3 — in pausa
- Ricercatore Interno BRAVO (agente per l'agenzia stessa)

---

*Questo documento è la base. Si aggiorna a ogni nuova decisione architetturale.*
