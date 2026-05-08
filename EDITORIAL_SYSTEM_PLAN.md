# Editorial System · Piano di sviluppo

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

### Fase 2 · Critico · taste scoring (FUTURO)

Da affrontare solo dopo che le fasi 1A-1D sono in produzione e producono post decenti.

**Cosa farà:**
- Riceve PNG finale + brief + decisioni
- Restituisce score quantitativi: `text_area_ratio`, `whitespace_ratio`, `gerarchia_score`, `oro_presente`, `editorial_vs_ad`
- Restituisce giudizio: `approved | needs_retry`

**Tempo stimato:** 1 giornata

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

## 9 · Cosa NON fare (regole di disciplina)

- ❌ Non chiedere "spiegazioni in italiano" agli agenti — solo JSON strutturato
- ❌ Non analizzare la decision log prima di 100+ post — i pattern non emergono
- ❌ Non far dipendere il sistema vivo dal logging — il log è output, non input
- ❌ Non costruire la memoria di gusto prima del Critico — memorizza spazzatura
- ❌ Non aggiungere altri archetipi finché i 4 base non sono solidi
- ❌ Non toccare il backend per "rifattorizzare" mentre si fa lo Step 1 — solo aggiungere
- ❌ Non aggiungere ombre, gradienti, overlay per "rendere più leggibile" — è quello che vogliamo evitare

---

## 10 · Mockup di riferimento

| File | Mostra |
|---|---|
| `mockup-editorial.html` | 4 archetipi sulla foto Belvedere · Ahora vs Editorial |
| `mockup-grammar.html` | 1 archetipo · 3 esiti diversi (grammatica vs stencil) |
| `system-flow.html` | Schema visivo completo del flusso |

I mockup HTML restano come **riferimento di design**: quando un parametro o un archetipo è ambiguo, si guardano questi.

---

## 11 · Punti di decisione aperti

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
- [ ] **Fase 1C frontend · UI 3 card di scelta** ← prossimo · vista proposte in app · click "scegli" → finalize → rendering finale · test end-to-end con foto reale
- [ ] Title Distiller (separazione caption→titolo) · ortogonale a 1C/1D · raffinamento qualità
- [ ] Fase 2 · Critico
- [ ] Fase 3 · Memoria di gusto

---

*Documento vivo. Aggiornare man mano che si avanza.*
