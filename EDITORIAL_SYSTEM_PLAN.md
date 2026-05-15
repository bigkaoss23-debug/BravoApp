# Editorial System · Piano di sviluppo

---

> **Documento operativo.** Per i principi architetturali e filosofici permanenti,
> leggere `BRAVO_CONSTITUTION.md`.
>
> Questo piano implementa principalmente il **Layer 3 · Production** e parte del
> **Layer 4 · Learning** della Costituzione BRAVO. Il **Layer 2 · Strategic** è
> rimandato a quando ci saranno dati reali su cui ragionare (50+ post pubblicati).

---

> ## *Non stiamo ottimizzando distribuzione.*
> ## *Stiamo preservando la possibilità dell'ossessione.*
>
> — Bravo · 2026-05-08
>
> Questa frase è la guard-rail filosofica di tutto il progetto.
> Ogni volta che un agente, una regola, una metrica o un'idea
> spinge il sistema verso "varietà più intelligente" o "distribuzione
> più equilibrata" — fermarsi e rileggere queste due righe.
>
> Il gusto reale contiene incoerenze controllate, ossessioni, eccezioni,
> momenti strani, decisioni non ottimizzate. Un sistema che le elimina
> sistematicamente produce un nuovo tipo di AI smell — sofisticato, ma
> ancora percepibile. Il sistema osserva, propone, ricorda. La scelta è umana.

---

> Documento operativo per la trasformazione del sistema BRAVO da "generatore template" a "sistema editoriale grammaticale".
>
> **Cliente di riferimento:** Belvedere (Ronda)
> **Data inizio:** 2026-05-07
> **Stato:** approvato — pronto per fase 1A

---

## 1 · Visione

Il sistema attuale **esegue ma non sceglie**. Genera headline, le impagina, applica template. Ma non ha gusto: produce post con composizioni ripetitive, troppo testo, overlay aggressivi, ombre pesanti, tipografia non-brand.

L'obiettivo è trasformarlo in un sistema editoriale dove:

- gli agenti **modulano** parametri dentro vincoli precisi (non scelgono da menu rigidi)
- ogni post **respira** invece di urlare
- il brand kit (font, colori, gerarchia) è rispettato sempre
- il sistema **ricorda** cosa ha fatto per non ripetersi
- ogni decisione lascia traccia per analisi futura

### Due layer separati (decisione architetturale)

```
┌─────────────────────────┐    ┌─────────────────────────┐
│  SISTEMA DI PRODUZIONE  │    │  SISTEMA DI GUSTO       │
│  ───────────────────    │    │  ─────────────────      │
│  pipeline · render      │ ←→ │  critic · memoria       │
│  consistency · DB       │    │  taste scoring          │
│  → fasi 1A · 1B · 1C    │    │  → fasi 2 · 3           │
└─────────────────────────┘    └─────────────────────────┘
```

Costruire prima la produzione pulita, poi il giudizio. Mai mischiarli.

---

## 2 · Brand kit Belvedere

### Tipografia (solo due font, mai altri)

| Font | Ruolo | Uso |
|---|---|---|
| **Cormorant Garamond** | Serif elegante | Headline · parole-eroe · whisper italic |
| **Jost** | Sans-serif refined | Etichette · meta-data · logo · UI |

### Palette (gerarchia di uso)

| Colore | Hex | Ruolo | Frequenza target |
|---|---|---|---|
| Crema | `#F5F0E8` | Testo principale, neutro | quasi sempre |
| **Oro** | **`#C29547`** | **Accento principale, identità Belvedere** | **~50% dei post** |
| Bordeaux | `#8B1A1A` | Accento forte, momenti potenti | ~10-15% (raro) |
| Verde oliva | `#5C7A5C` | Naturalezza, stagionalità | occasionale |
| Blu nebbia | `#7A8FA6` | Atmosfera fredda, mattina | occasionale |
| Nero caldo | `#1C1714` | Testo su sfondi chiari | raro |

**Regola:** l'oro è il colore "voce" di Belvedere. Il bordeaux è uno strumento speciale, non un'opzione tra tante. Verde e blu nebbia entrano solo se la foto stessa li chiama.

---

## 3 · Regole tipografiche editoriali

### Punteggiatura finale (tre opzioni, ognuna con un mestiere)

| Segno | Effetto | Quando usarla |
|---|---|---|
| (niente) | **Afferma** | Frammento dichiarativo · etichetta · lista |
| `…` | **Sospende** | Atmosfera · silenzio · momento sospeso · evocazione |
| `.` | **Chiude** | Frase compiuta con verbo (rara) |

**Importante:** l'ellipsis è il carattere Unicode `…` (U+2026), **non** tre punti separati `...`. Il validator deve convertire automaticamente.

### Lunghezza headline (per archetipo, NON globale)

> **Aggiornato 2026-05-07** — il vincolo "max 6 parole globale" era troppo rigido e creava un loop di frammenti corti. La varietà nasce dalla scelta dell'archetipo, ognuno con la sua regola interna.

| Archetipo | Parole permesse |
|---|---|
| Una palabra (A) | esattamente 1 |
| **Frase narrativa (E · NUOVO)** | **5-12 parole · una voce sola** |
| Frase + sussurro (B) | 2-5 headline + 4-8 whisper |
| Etichetta + titolo (C) | 2-3 etichetta + 3-7 headline |
| Ritmo di tre (D) | esattamente 3 parole verticali |

Il Copy Agent riceve dal Layout Selector quale archetipo è stato scelto, e applica la regola di lunghezza corrispondente.

### Maiuscolo

Oggi tutto `.upper()` forzato. Va sbloccato:
- Sentence case (prima lettera maiuscola, resto minuscolo) → editorial default
- UPPERCASE → solo per etichette tipo `RONDA · 7:15`
- Mai uppercase su frasi intere

---

## 4 · I 5 archetipi (grammatiche, non template)

Ogni archetipo ha una **struttura fissa** e **parametri liberi** che gli agenti modulano ogni volta.

### A · Una palabra

**Fisso:** una sola parola dominante · Cormorant italic · **dimensionata per larghezza (60-75% canvas width)** — impatto editoriale vero, non etichetta.

**Libero:**
- Parola (Copy Agent)
- Posizione (upper-center / upper-left / upper-right / mid-left / center) — Art Director
- Larghezza target (50%-80% canvas width) — Art Director, in base allo spazio negativo
- Italic vs regular — Art Director
- Colore (oro / crema / bordeaux) — Art Director
- Ellipsis sì/no (Copy Agent in base a mood)
- Micro-elemento opzionale (data, etichetta) — Art Director

**Quando usarlo:** foto **astratte** (paesaggio puro, cielo, distese, atmosfera). NON usare su foto narrative ricche di soggetti — la parola sola non dialoga con i dettagli.

### B · Frase + sussurro

**Fisso:** headline 2-4 parole + whisper 4-6 parole italic sotto · Cormorant.

**Libero:**
- Headline e whisper (Copy Agent)
- Posizione blocco (upper-left / upper-right) — Art Director
- Colori headline/whisper (crema+oro o oro+crema) — Art Director
- Allineamento — Art Director

### C · Etichetta + titolo

**Fisso:** etichetta Jost in oro spaziata + headline Cormorant crema sotto.

**Libero:**
- Testo etichetta (Copy Agent — luogo/ora/categoria)
- Testo headline (Copy Agent)
- Posizione (bottom-left / bottom-right / mid) — Art Director
- Dimensione tipografica — Art Director

### D · Ritmo di tre

**Fisso:** esattamente 3 parole verticali · Cormorant · alternanza regular/italic e oro/crema.

**Libero:**
- Le 3 parole (Copy Agent)
- Posizione (left / right / center) — Art Director
- Pattern alternanza colori — Art Director
- Spaziatura tra le righe — Art Director

### E · Frase narrativa (NUOVO · 2026-05-07)

**Fisso:** una sola frase di 5-12 parole · Cormorant · una voce sola (no whisper, no label).

**Libero:**
- La frase (Copy Agent)
- Italic vs regular — Art Director
- Posizione (upper-left / upper-right / mid-left / mid-right / lower-left / lower-right) — Art Director
- Dimensione (3.5%-5.5% canvas height) — Art Director
- Colore (crema / oro) — Art Director
- Larghezza blocco testo (60%-80% canvas width) — Art Director

**Quando usarlo:** quando la foto è **narrativa** (ricca di dettagli, soggetti, oggetti) e una parola sola non basterebbe, ma due righe di headline + whisper sembrerebbero forzate. La frase narrativa dà respiro a un pensiero compiuto. Esempi:
- *"Hay una hora en que el Tajo todavía calla."*
- *"El café llega antes que la luz al fondo del valle."*
- *"Aquí la mañana se mide en niebla."*

**Differenza chiave con Frase + sussurro (B):** B ha due voci (headline + whisper), E ha una sola voce ma più articolata. B è tipografico, E è narrativo.

---

## 5 · Architettura del flusso

```
[0] Input · Foto + Brief (utente)
        ↓
[1] PhotoAnalyzer · Haiku Vision · esiste
        ↓ scene_description, luz, sujeto, espacio_negativo
        ↓
[2] BriefComposer · determinístico · esiste
        ↓ pillar, angle, mood, persona
        ↓
[3] Layout Selector · Haiku · NUOVO
        ↓ legge memoria rotazione · sceglie 1 dei 5 archetipi
        ↓ valuta tipo foto: astratta → A · narrativa → B/C/E · poetica → D
        ↓
[4] Copy Agent · Sonnet · esiste, da estendere
        ↓ headline ≤ 6 parole · whisper opzionale · regole punteggiatura
        ↓
[5] Art Director · Haiku · esiste, da estendere
        ↓ modula posizione, colore, dimensione, micro-elementi
        ↓
[6] Renderer · Pillow · esiste, da estendere
        ↓ flag: no_overlay, no_shadows, allow_lowercase, whisper, ellipsis
        ↓
[7] Critico · Haiku Vision · FUTURO (Step 2)
        ↓ giudica · aprueba o pide retry
        ↓
[∞] Publicación + scrittura decision log
```

### Costo per post

- 3 chiamate Haiku + 1 Sonnet
- ~$0.012 per post
- vs ~$0.05+ con generazione multipla "ingenua"
- Risparmio: ~75%

---

## 6 · Le tre memorie del sistema

| Memoria | Cosa salva | Quando | Costruire |
|---|---|---|---|
| **Decision log** | Ogni decisione di ogni agente, JSON strutturato, long-term | sempre, dopo publish | **Step 1D** |
| **Rotazione** | Vista sintetica della decision log: archetype, color, mood, key_word ultimi 14 giorni | derivata dalla decision log | **Step 1D** |
| **Gusto** | Post validati dal Critico come "buoni" → reference per nuovi post | solo dopo Step 2 | **Step 3** |

### Decision log — schema strutturato

Ogni agente, oltre al suo output, restituisce un `reasoning` JSON così:

```json
{
  "decision": "color = warm (oro)",
  "primary_factor": "mood_contemplativo + foto_luz_calida",
  "secondary_factors": [
    "anti_repeticion: bordeoux usado hace 3 dias",
    "gerarchia: oro è il colore voce di Belvedere"
  ],
  "rejected": [
    {"option": "burdeos", "reason": "ya usado recientemente"},
    {"option": "verde", "reason": "no dialoga con esta foto"}
  ],
  "confidence": 0.85
}
```

**Regola:** mai testo libero, sempre JSON strutturato. Le "spiegazioni in italiano" sono fluff post-hoc, inutili per l'analisi.

### Rotazione — come consultare

Funzione `get_recent_choices(client_id, days=14)` restituisce:

```python
{
  "archetypes_used": ["una_palabra", "ritmo_tres", "una_palabra"],
  "colors_used": ["warm", "warm", "burdeos", "cream"],
  "moods_used": ["contemplativo", "narrativo", "identitario"],
  "key_words": ["Calma", "Niebla", "Ronda"]
}
```

Consultata da:
- **Layout Selector** → evita archetipi recenti
- **Art Director** → rispetta percentuali brand (oro 50%, bordeaux 10-15%)
- **Copy Agent** → non riusa parole-chiave recenti

---

## 7 · Roadmap di costruzione

### Fase 1A · Renderer · primitive nuove

**Obiettivo:** sbloccare il renderer perché possa fare editorial.

**Dove:** `backend/agents/designer.py` + `backend/tools/renderer.py`

**Cosa:**
- Aggiungere flag: `no_overlay: bool`, `no_shadows: bool`, `allow_lowercase: bool`
- Aggiungere parametri whisper: `whisper_text`, `whisper_size`, `whisper_color`, `whisper_italic`
- Aggiungere parametro `ellipsis_glyph` (forza il carattere `…`)
- Sbloccare `.upper()` hardcoded (renderlo opzionale via flag)
- Implementare i 4 archetipi come funzioni renderer modulabili:
  - `_render_una_palabra(...)` con position, size, color, ellipsis
  - `_render_frase_susurro(...)` con headline + whisper
  - `_render_etiqueta_titulo(...)` con label + headline
  - `_render_ritmo_tres(...)` con 3 parole alternate
- Caricare `Cormorant Garamond` e `Jost` come font default per Belvedere

**Tempo stimato:** 4-6 ore

**Criterio di "fatto":**
- Posso chiamare `composite()` con `no_overlay=True, no_shadows=True, layout_variant="una_palabra"` e ottenere un post pulito
- Tutti e 4 gli archetipi producono PNG corretti su una foto di test

---

### Fase 1B · Copy Agent · voce editoriale

**Obiettivo:** ottenere headline editoriali (corte, senza punto, con ellipsis quando serve) — e con vera voce di brand, non solo etichette.

**Dove:** `backend/agents/copy_agent.py`

**Cosa (piano originale):**
- ~~Cambiare `MÁXIMO 12 PALABRAS` → **`MÁXIMO 6 PALABRAS`** (hard constraint)~~ → superato dal piano archetype-based (limiti per archetipo)
- Regola punteggiatura editoriale (frammento: mai punto · ellipsis se atmosferico · punto solo se frase con verbo)
- Few-shot examples editoriali nel prompt
- Campo output `whisper` (opzionale)
- Campo output `ellipsis_used` (bool)
- Campo output `_reasoning` strutturato
- Validatore Python: converte `...` → `…`

**Aggiunto in corso d'opera (2026-05-07/08) — non era nel piano originale:**

Dopo i primi test si è visto che il Copy Agent produceva post tecnicamente corretti
ma "vuoti, senza voce". La causa: il `brief_composer.py` estraeva solo il 30% della
sostanza che il `briefing_analyzer.py` salvava in `brand_kit_opus`. Il Copy Agent
scriveva a occhi bendati.

**Fix architetturale (Fase 1B+):**
- `brief_composer.py`: estrarre `angle.description` (era ignorato), `tone_voice_example` ("Esta mañana la niebla cubría el Tajo..."), `persona_profile` + `resonating_message`, `client_description`
- `to_prompt_block`: niente più troncamenti a 120/200 char — espone tutta la sostanza in blocchi narrativi
- `copy_agent.py` system prompt: snellito (~30%) e reso **neutro** — sparito ogni riferimento hardcoded a Tajo/sierra/sosiego/Ronda/Belvedere. La voce e il lessico arrivano dal brief di oggi, non dal prompt
- Few-shot: ridotti a 4 esempi neutri di FORMA (insegnano struttura, non contenuto)
- `_reasoning`: aggiunto campo `palabra_clave` (preparazione per Fase 1D rotation)

**Principio adottato:** la voce della marca arriva dal briefing, non dal system prompt.
Se il briefing è scritto bene, il Copy Agent ha già tutto quello che gli serve.

**Test:** `backend/test_belvedere_copy.py` valida 4 angoli × archetipi su Belvedere reale.

**Criterio di "fatto":**
- ✓ Con brief Belvedere produce post concreti (cerámica/mermelada/almendros/García)
- ✓ Lessico variabile per angolo, niente postcards generiche
- ✓ Sentence case, punteggiatura editoriale, output JSON con whisper + reasoning
- ✓ Validato dall'orecchio del cliente (2026-05-08)

---

### Fase 1C · Layout Selector + Art Director esteso

**Obiettivo:** scelta dell'archetipo + modulazione dei parametri liberi.

**Dove:**
- Nuovo file `backend/agents/layout_selector.py`
- Estensione `backend/agents/art_director.py`

**Cosa:**

**Layout Selector (nuovo):**
- Agente Haiku con prompt corto
- Input: brief + scene_description + recent_choices (memoria rotazione)
- Output: `{archetype: "una_palabra"|"frase_susurro"|"etiqueta_titulo"|"ritmo_tres", reasoning: {...}}`

**Art Director (esteso):**
- Output esteso con parametri liberi: `position`, `size`, `color_main`, `micro_element`, `whisper_position`
- Logica colori: rispetta gerarchia brand + memoria rotazione
- Logica posizione: usa `espacio_negativo` dal PhotoAnalyzer

**Tempo stimato:** 3-4 ore

**Criterio di "fatto":**
- Layout Selector sceglie un archetipo coerente con foto + mood
- Art Director produce parametri concreti che il Renderer sa eseguire

---

### Fase 1D · Decision log + memoria rotazione ✅ COMPLETATA (2026-05-08)

**Obiettivo:** infrastruttura di memoria per il sistema.

**Dove:**
- Migration Supabase `editorial_phase_1d_decision_log` (applicata)
- `backend/tools/decision_log.py` (nuovo file)
- `backend/tools/pipeline_v2.py` (integrazione write_decision)

**Discovery in corso d'opera (2026-05-08):**
Ispezionando Supabase, abbiamo trovato che la tabella `agent_logs` esisteva
già (vuota, ma con struttura giusta). Decisione: riusarla invece di creare
`agent_decisions`. Estese 7 colonne denormalizzate per query veloci di
rotazione + 3 indici composti.

**Cosa fatto:**
- Migration: rilassato `agent_id NOT NULL`, aggiunte colonne `agent_name`, `client_id`, `content_id`, `proposal_set_id`, `archetype`, `palabra_clave`, `selected`
- Indici: `(client_id, agent_name, created_at DESC)` per rotation per agente · `(client_id, archetype, created_at DESC)` per rotation archetypes · `proposal_set_id` per raggruppare i 3 finalisti (Fase 1C)
- Su `generated_content`: aggiunte `archetype` e `proposal_set_id` (preparazione Fase 1C)
- `decision_log.py`: API `write_decision`, `mark_selected`, `get_recent_choices`, `to_rotation_brief` (sintesi leggibile per system prompts)
- `pipeline_v2.py`: dopo ogni post, scrive 5 record (photo_analyzer, copy_agent, art_director, tone_validator, brand_compliance) con `selected=true` (in v2 lineare = sempre scelto)

**Note:**
- `agent_logs.status` accetta solo `success | error | pending` (constraint preesistente). Default impostato su `success`.
- `to_rotation_brief()` produce un blocco testo da incollare nei prompt agenti, tipo: *"Archetipos usados: mixed_type (2), frase_susurro · Palabras-clave usadas: quieto, mermelada · Evita repetir lo que ya está."*

**Criterio di "fatto":** ✓ tutti
- ✓ Ogni post pubblicato lascia 5 record in agent_logs
- ✓ `get_recent_choices` restituisce dati corretti (testato e2e)
- ✓ `mark_selected` aggiorna correttamente le righe del set
- ✓ Pronto come precondizione per Fase 1C

---

### Fase 1.7 · Failure Memory (NUOVO · derivata dalla Costituzione)

**Obiettivo:** salvare ciò che il sistema (o l'umano) **boccia**, non solo ciò che approva. Evita regressioni e riconosce pattern tossici prima che si consolidino.

**Motivazione:** dalla Costituzione (sez. 7) — *"Failure Memory: fondamentale. Output falliti, drift estetici, errori AI, cliché, contenuti bocciati."* È più utile sapere cosa NON ripetere che cosa ripetere.

**Dove:**
- Nuova tabella Supabase `failure_memory` (o estensione di `agent_logs` con `rejected_reason`)
- API in `tools/decision_log.py`: `write_failure(client_id, proposal_set_id, archetype, reason, notes)`
- Hook in Studio: quando l'umano sceglie 1 dei 3 finalisti, gli altri 2 lasciano traccia come "non scelti" con motivazione opzionale

**Cosa serve:**
- Schema: `client_id, archetype, palabra_clave, color_main, rejected_reason (enum: ai_smell | troppo_template | brutto | fuori_voce | gia_visto | altro), notes`
- `get_recent_failures(client_id, days=30)` → blocco testo per i system prompt agenti
- Integrazione nei prompt: Copy Agent / Layout Selector / Art Director vedono cosa è stato bocciato di recente

**Quando affrontarla:** dopo Fase 1.5 (parser briefing) e dopo i primi test e2e Belvedere. Serve aver pubblicato qualche post per avere fallimenti veri da memorizzare.

**Criterio di "fatto":**
- Ogni proposta non scelta nello Studio lascia traccia in `failure_memory`
- `get_recent_failures` restituisce un blocco testo leggibile per i prompt
- Almeno 1 agente (Layout Selector come primo candidato) consulta la failure memory

---

### Fase 2 · Critico · taste scoring (FUTURO)

Da affrontare solo dopo che le fasi 1A-1D sono in produzione e producono post decenti.

**Cosa farà:**
- Riceve PNG finale + brief + decisioni
- Restituisce score quantitativi: `text_area_ratio`, `whitespace_ratio`, `gerarchia_score`, `oro_presente`, `editorial_vs_ad`
- Restituisce giudizio: `approved | needs_retry`

**Tempo stimato:** 1 giornata

---

### Fase 2.5 · Orchestrator esplicito (NUOVO · derivata dalla Costituzione)

**Obiettivo:** promuovere a layer di prima classe ciò che oggi è implicito dentro `pipeline_v2_studio.py`. Avere un Orchestrator nominato chiarisce dove va aggiunta logica di routing/context/permission e dove no.

**Motivazione:** dalla Costituzione (sez. 8) — l'Orchestrator coordina, non crea, non giudica, non scrive. Oggi il file `pipeline_v2_studio.py` fa esattamente quel lavoro, ma il nome non lo dice e la responsabilità non è isolata. Quando aggiungeremo il Critico (Fase 2) o futuri agenti Strategic, serve un punto di routing chiaro.

**Dove:**
- Rinominare/ristrutturare `backend/tools/pipeline_v2_studio.py` → `backend/orchestrator/`
- Moduli: `routing.py` (chi chiama cosa), `state.py` (proposal/publish state), `permissions.py` (chi può scrivere cosa nelle decision)
- I file agenti restano dove sono — cambia solo chi li coordina

**Quando affrontarla:** dopo Fase 2 (Critico). Avere il Critico aggiunge un retry-loop che è esattamente il tipo di logica che oggi sporcherebbe `pipeline_v2_studio.py` — meglio affrontarla quando il bisogno è concreto.

**Criterio di "fatto":**
- `pipeline_v2_studio.py` non contiene più logica di business degli agenti, solo coordinazione
- Aggiungere un nuovo agente (es. Critic) non richiede di toccare il routing in 3 posti diversi
- Il file `permissions.py` rende esplicito chi NON può scrivere cosa (es. Renderer non può scrivere in `decision_log` come decisore)

---

### Fase 3 · Memoria di gusto (FUTURO)

Solo dopo Step 2. Quando il Critico ha validato 50+ post buoni, costruiamo:

- Tabella `taste_memory` con post approvati e parametri
- Reference che gli agenti consultano: "qui abbiamo già fatto qualcosa che funziona"
- Pattern di stile distillati nel tempo

---

## 8 · Riepilogo costi

| Voce | Costo |
|---|---|
| Sviluppo fasi 1A + 1B + 1C + 1D | ~2 giornate di lavoro |
| Costo runtime per post (4 chiamate API) | ~$0.012 |
| Costo storage decision log (60 mesi) | trascurabile |
| Costo aggiuntivo per `_reasoning` (~15% token output) | ~$0.001 per post |

---

## 9 · Responsabilità isolate (dalla Costituzione · sez. 10)

Ogni agente ha **una responsabilità unica**. Quando si tocca codice, questa tabella è la regola:

| Agente | Può fare | NON può fare |
|---|---|---|
| PhotoAnalyzer | analizzare luce, spazio negativo, soggetti | decidere copy, layout, stile |
| BriefComposer | estrarre mood, angle, persona, tone voice dal briefing | riassumere il briefing, riscrivere la voce |
| Layout Selector | scegliere l'archetipo | scrivere copy, decidere estetica dettagliata |
| Copy Agent | scrivere headline, whisper, parola-chiave | scegliere layout, modificare brand grammar |
| Art Director | modulare posizione, scala, colore, gerarchia | scegliere l'archetipo, creare nuove identità |
| Renderer | compositing, font, PNG export | prendere decisioni creative |
| Critic (Fase 2) | giudicare il risultato | generare contenuti |
| Orchestrator (Fase 2.5) | coordinare i layer | creare, giudicare, scrivere |

---

## 10 · Cosa NON fare (regole di disciplina)

- ❌ Non chiedere "spiegazioni in italiano" agli agenti — solo JSON strutturato
- ❌ Non analizzare la decision log prima di 100+ post — i pattern non emergono
- ❌ Non far dipendere il sistema vivo dal logging — il log è output, non input
- ❌ Non costruire la memoria di gusto prima del Critico — memorizza spazzatura
- ❌ Non aggiungere altri archetipi finché i 4 base non sono solidi
- ❌ Non toccare il backend per "rifattorizzare" mentre si fa lo Step 1 — solo aggiungere
- ❌ Non aggiungere ombre, gradienti, overlay per "rendere più leggibile" — è quello che vogliamo evitare

---

## 11 · Mockup di riferimento

| File | Mostra |
|---|---|
| `mockup-editorial.html` | 4 archetipi sulla foto Belvedere · Ahora vs Editorial |
| `mockup-grammar.html` | 1 archetipo · 3 esiti diversi (grammatica vs stencil) |
| `system-flow.html` | Schema visivo completo del flusso |

I mockup HTML restano come **riferimento di design**: quando un parametro o un archetipo è ambiguo, si guardano questi.

---

## 12 · Punti di decisione aperti

Queste cose le decidiamo strada facendo, non in anticipo:

- [ ] Quando un cliente ha meno di 14 giorni di storico, come gestiamo la rotazione? (Probabilmente: skip rule)
- [ ] Cosa fa il sistema se il Layout Selector non trova un archetipo adatto? (Default: `frase_susurro`)
- [ ] La whisper può andare anche **sopra** la headline o solo sotto? (Da testare)
- [ ] Ci serve un quinto archetipo per stories 9:16? (Da valutare dopo)

---

## Status sviluppo

- [x] **Fase 1A · Renderer** · 5 archetipi implementati in `tools/editorial_renderer.py` · dispatcher in `agents/designer.py` · Una palabra ricalibrata per larghezza · Frase narrativa aggiunta · Mixed type (Archetipo F · stile hotel deluxe) aggiunto (2026-05-07)
- [x] **Fase 1B · Copy Agent** · sentence case · punteggiatura editoriale · limiti per archetipo · whisper · ellipsis_used · _reasoning · validator `...→…` · pipeline_v2 aggiornata (2026-05-07)
- [x] **Fase 1B+ · Voce dal briefing** (non prevista nel piano originale) · brief_composer estrae angle.description + tone_voice_example + persona_profile + resonating_message · to_prompt_block riscritto senza troncamenti · system prompt copy_agent snellito e neutro · test_belvedere_copy.py validato dall'orecchio del cliente (2026-05-08)
- [x] **Fase 1D · Decision log + Rotazione** · riusata `agent_logs` esistente (no nuove tabelle) · estese 7 colonne (agent_name, client_id, content_id, proposal_set_id, archetype, palabra_clave, selected) + 3 indici · `tools/decision_log.py` con write_decision/get_recent_choices/mark_selected/to_rotation_brief · pipeline_v2 logga 5 agenti per post · test e2e su Supabase reale OK (2026-05-08)
- [x] **Fase 1C backend · Studio (3 finalisti)** · `agents/layout_selector.py` (Haiku · propone 3 archetipi diversi consultando rotazione) · `tone_validator.rank_proposals()` (Critic · ranking comparativo 1 chiamata) · `tools/pipeline_v2_studio.py` (propose_post + finalize_post) · API `/api/v2/post/propose` + `/api/v2/post/finalize` · Orchestrator esteso · test e2e Belvedere OK (2026-05-08)
- [x] **Fase 1C frontend · UI 3 card di scelta** · `bravo-studio.js` (logica isolata, riusa form Agente) · bottone "✦ Estudio" affianco a "Genera" · overlay con 3 card **pari grado** (rispetto manifesto: niente sort per critic_rank, niente highlight della "rank 1") · critic comment come post-it laterale · click "Elegir esta" → finalize → render finale · stile Cormorant + Jost + palette Belvedere (2026-05-08)
- [x] **Fase 1.5 · Parser briefing** · `briefing_docx_parser.py` (10 sezioni canoniche, errore esplicito se manca una sezione, zero distillazione) · superata dall'Onboarding canonico v2 (2026-05-15)
- [x] **Fase 1.6 · Onboarding canonico v2** · pipeline 4 step deterministici: parser DOCX → `briefing_sections` letterali → `client_team` (5 macro-agenti) → `project_extractor` (progetti da SCOPE con `source_quote`) · migration `client_projects` (+`project_type, volume, frequency, scope_literal`) · `editorial_planner` legge sez. 02 SCOPE · test e2e Belvedere: 5 progetti estratti, 6 vecchi opus puliti (commit 9ae520f, 3d656f9 · 2026-05-15)
- [x] **Test end-to-end Belvedere** · briefing → progetti → piano giugno 2026 (8 feed + 12 stories) → Studio v2 (5 round) → finalize → PNG su Storage · catena completa verificata (2026-05-15)
- [x] **Studio v2 · 4 bug fix alla radice** (commit 4597dda · 2026-05-15):
  - #1 memoria rotazione cieca → `get_recent_choices(only_selected=False)` in pipeline studio (0→27 decisioni viste)
  - #2 Critic vedeva caption tronche → `tone_validator` cap 300→500 char
  - #3 Copy Agent cieco al passato → riceve `recent_choices` + blocco "evita ripetere" (come Layout/Critic)
  - #4 label dentro headline (etiqueta_titulo) → Copy Agent produce `label` separata (output JSON + prompt riscritto + retry mirato); pipeline propaga label in `pipeline_decisions.copy_agent`
- [x] **Bug #5 · Format Profiles + scrim adattivo** (commit eb64e04 · 2026-05-15) · `FORMAT_PROFILES` (font su lato corto, ancore per aspect-ratio, safe-zone UI) · scrim da **criterio fisico** `_adaptive_scrim_alpha` (luminanza misurata dietro il testo, target buio 78 — niente più numeri a gusto) · parola d'oro (`accent_word`) · applicato a `etiqueta_titulo` come prototipo standard
- [x] **Generazione immagini · Ideogram → Higgsfield** (commit 808a2e3 · 2026-05-15) · `tools/ideogram.py` eliminato → `tools/image_gen.py` interfaccia astratta · MCP Higgsfield connesso (account ultimate, modello Soul Location) · prompt agenti ripuliti + vincolo "no text/labels in image" · foto-test Belvedere generata e validata (no allucinazioni) · cerchio chiuso: post finito vero su foto AI di qualità
- [x] **Fase B · Flusso foto batch + 2 cancelli umani · VALIDATO e2e** (2026-05-15) · migration `photo_requests` (staging WIP, scarti tracciati con motivo) · `agents/photo_needs.py` (PhotoNeedsAgent isolato, metodologia image-poster 5-passi, legge sez. 03+06 letterali, param `formats`) · `tools/photo_flow.py` (list/apply_prompt_gate/pending_generation/register_generation/apply_photo_gate · notifier su entrambi i cancelli) · test e2e Belvedere giugno: 8 prompt proposed → Cancello 1 (8 approved) → Higgsfield Soul Location (8 generated, ~1 credito) → Cancello 2 (6 confirmed in client_assets `origin=ai_test` + 2 rejected con motivo). Qualità foto validata "all'occhio" da Bravo
- [ ] **Fase 1.7 · Failure Memory** (NUOVO · derivata dalla Costituzione) · dopo i primi e2e Belvedere
- [ ] Title Distiller (separazione caption→titolo) · ortogonale · raffinamento qualità futuro
- [ ] Fase 2 · Critico (taste scoring quantitativo) · futuro
- [ ] **Fase 2.5 · Orchestrator esplicito** (NUOVO · derivata dalla Costituzione) · dopo Critico
- [ ] Fase 3 · Memoria di gusto · futuro (dopo 50+ post validati)
- [ ] **Layer 2 · Strategic** (Editorial Planner, Brand Consistency, ...) · futuro · solo con 50+ post pubblicati su ≥1 cliente

- [x] **Bug #5 esteso · TUTTI i 5 archetipi sullo standard** (2026-05-15) · `una_palabra`, `frase_susurro`, `ritmo_tres`, `frase_narrativa`, `etiqueta_titulo` rifattorizzati: Format Profiles (font su lato corto, ancore per aspect-ratio, clamp safe-zone) + scrim adattivo (criterio fisico) + parola d'oro · helper `_wrap_no_orphan` chiude il debito tipografico (parola orfana a fine riga) su frase_narrativa + frase_susurro · validati su Post 1:1 + Story 9:16 con foto del catalogo Belvedere

### Debito tecnico tracciato (2026-05-15)

- [x] ~~Fix tipografico: parola orfana~~ → chiuso con `_wrap_no_orphan`
- [x] ~~Estendere Format Profiles agli altri 4 archetipi~~ → fatto, 5/5
- [ ] Rinominare var interne `ideogram_key`/`IDEOGRAM_API_KEY` → `image_gen` (pipeline.py, orchestrator.py, content_designer.py) — con test
- [ ] Dismissione v1 futura: estrarre i pezzi buoni di `content_designer` (`_build_art_director_system`, visual_prompt builder) in moduli condivisi, poi rimuovere · quando Studio v2 sarà default per tutti i clienti
- [ ] CLI Higgsfield per clienti "full-AI" (preventivo costi → bot automatico) · valutare dopo che il flusso batch+gate è solido

---

## Audit di consistenza · fine sessione 2026-05-08

Abbiamo fatto 5 commit grossi in fila (1A, 1B, 1B+, 1D, 1C backend, 1C frontend, manifesto). Bravo ha chiesto giustamente di fermarsi e verificare che il backend sia coerente prima del pareggio col frontend.

### Risultato audit

| Cosa | Stato |
|---|---|
| Sintassi codice + import chain | ✓ OK |
| Migration `agent_logs` | ✓ live (testato e2e) |
| `brief_composer` con 5 nuovi campi | ✓ popolati |
| `ToneValidator.rank_proposals` (Critic) | ✓ funziona |
| `LayoutSelector` propone 3 archetipi diversi | ✓ funziona, consulta memoria |
| `pipeline_v2_studio` (propose + finalize) | ✓ test isolato OK |
| **`brand_kit_opus` Belvedere** | ⚠ riprocessato 2026-05-08, ma con perdite (vedi sotto) |
| `brand_kit_opus` DaKady / Altair | ✗ vuoti — non bloccante (gestiti dal team umano per ora) |
| Test e2e nel browser | ⏳ da fare dopo Fase 1.5 |

### Cose serie da sistemare ORA (pre-pareggio frontend)

| # | Cosa | Severità | Status |
|---|---|---|---|
| 1 | **Parser briefing usa Haiku fallback su Belvedere** — formato non riconosciuto dal parser Python → distilla via Haiku → `angle.description` arrivano riassunte invece di testuali, accenti spagnoli persi | 🔴 alto | ← Fase 1.5 in corso |
| 2 | Riprocesso Belvedere col parser fissato + verifica integrità | 🔴 alto | dopo #1 |

### Cose accettate come debito tecnico (NON toccare ora)

| # | Cosa | Quando affrontare |
|---|---|---|
| 3 | DaKady + Altair `brand_kit_opus` vuoti | Non bloccante — questi clienti sono gestiti dal team umano. Quando si decide di portarli sul sistema, riprocessare i loro briefing con il parser fissato. |
| 4 | Cache foto in memoria tra `/propose` e `/finalize` (`_PROPOSAL_PHOTO_CACHE` in `main.py`) | Da migrare a Supabase Storage **prima del go-live**. In dev funziona. |
| 5 | `_extract_render_params` accoppiato a `pipeline_v2.py` | Cosmetico. Non urgente. |
| 6 | ArtDirector "legacy" dentro `finalize_post()` (sceglie filtri foto + modulazione) | Funziona così. Refactor a "modula solo, mai sceglie layout" è nice-to-have. |
| 7 | `pipeline_v2.py` legacy convive con `pipeline_v2_studio.py` | Convive finché il sistema studio non è il default per tutti i clienti. |
| 8 | RLS Supabase disabilitato su 31 tabelle | **Sessione di sicurezza dedicata prima del go-live**, non oggi. |

---

## Fase 1.5 · Parser briefing — basta distillare il distillato

### Principio guida (memoria di progetto)

Già stabilito da Bravo in sessione precedente:
> *Il PDF è già un riassunto curato dallo Studio Bravo. Riassumerlo ulteriormente con un LLM perde il "calore umano" che giustifica l'investimento di scrittura. Le parole devono essere LE STESSE.*

Il fallback Haiku attuale **viola questo principio**. La sua esistenza nel codice è un anti-pattern: in silenzio degrada la qualità. Va o reso davvero capace di non distillare, o rimosso.

### Cosa fare (in ordine)

1. **Diagnosi del parser Python**
   - Testo del briefing Belvedere via `briefing_store.get_briefing()`
   - Capire perché `_split_sections()` non riconosce il formato (regex sezione, caratteri `━`, encoding)
   - Risultato atteso: identificare l'edge case che fa fallback a Haiku

2. **Fix mirato del parser Python**
   - Aggiustare il matching delle sezioni perché riconosca il formato Belvedere senza fallback
   - **Le `description` di pillar / angle / personas devono restare testuali** (no riassunti, no parafrasi)

3. **Fix accenti spagnoli**
   - Identificare dove si perdono (encoding del PDF→text, normalize ASCII, save SQL?)
   - Preservare `cálido`, `mañana`, `español` come scritti nel briefing originale

4. **Modificare il fallback Haiku**
   - Se il parser fallisce: errore esplicito ("formato briefing non riconosciuto") invece di distillare in silenzio
   - Oppure: fallback Haiku con prompt che vincola il modello a estrarre TESTUALMENTE, non riassumere

5. **Riprocesso Belvedere e verifica**
   - Confrontare le `angle.description` salvate con quelle del PDF originale: parola per parola
   - Confrontare `tone_voice_example` con la frase della Sezione 03 del PDF

### Criterio di "fatto"

- ✓ `_split_sections()` riconosce il formato Belvedere senza fallback
- ✓ `angle.description` salvata = testo del PDF (eventualmente con piccoli aggiustamenti tecnici come unione di line break)
- ✓ Accenti spagnoli preservati
- ✓ Riprocesso Belvedere produce un `brand_kit_opus` integralmente fedele al PDF
- ✓ Pronto per il pareggio col frontend (test e2e nel browser)

---

## Sessione 2026-05-15 · decisioni architetturali

**Higgsfield al posto di Ideogram.** Ideogram rimosso del tutto (abbonamento non voluto, qualità non gradita). Higgsfield (account ultimate, modello Soul Location) si integra via MCP/CLI — **non** API key, auth account-based. Conseguenza: la generazione immagini IA **non è un passo headless automatico** del backend. È on-demand. `tools/image_gen.py` è l'interfaccia astratta: tool intercambiabile, 1 file da cambiare se un domani si sostituisce.

**Generazione foto = sviluppo, non pubblicazione.** Belvedere è cliente-laboratorio: foto AI servono a far maturare gli agenti, non a pubblicare. Mitigazione contaminazione test→produzione: wipe totale del DB cliente a fine sviluppo + ripartenza con foto reali (decisione Bravo). Campo `origin` mantenuto per tracciabilità durante lo sviluppo.

**Flusso foto: batch + due cancelli umani (mai catena cieca).** Coerente col manifesto ("il sistema propone, la scelta è umana"). Agente propone lista-prompt → 🚦 umano approva i prompt (no spreco crediti) → genera Higgsfield a lotto → 🚦 umano conferma le foto → solo le confermate passano da `photo_requests` (staging WIP) a `client_assets` (catalogo finale). Trasparenza totale: niente cancellato, scarti con motivo.

**`content_designer`/v1 = legacy vivo, non morto.** Ancora cablato in worker, endpoint v1, pipeline carosello/varianti. Non si tocca, non si estende (sarebbe super-agent blob). I nuovi agenti (`photo_needs`) sono isolati e non ne dipendono. Recupero dei pezzi buoni → progetto futuro dedicato alla dismissione v1.

**Trasparenza inter-agente (requisito ricorrente Bravo).** Ogni passaggio tra agenti deve lasciare traccia consultabile (tabella + status), inclusi gli scarti col motivo. Principio del flusso, non dettaglio.

---

*Documento vivo. Aggiornare man mano che si avanza.*
