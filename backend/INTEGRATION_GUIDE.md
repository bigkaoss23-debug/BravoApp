# 🔌 Guida Integrazione SDK in BRAVO

## Architettura Completa

```
┌─────────────────────────────────────────────────────────┐
│                    APP BRAVO (React/Vue/Flutter)        │
│                   (Interfaccia Utente)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SETTIMANA 1: Tema "Fase arranque"                      │
│  ├─ Upload FOTO via UI (foto_chema.jpg, radici.jpg)    │
│  ├─ Chat/Note (testi della settimana):                 │
│  │   "Chema ha detto che le radici sono forti..."       │
│  │   "Ieri applicato BRAVERIA alle 8 AM"               │
│  │   "Sensori AIGRO registrano 25°C"                   │
│  └─ Salva tutto in Database BRAVO                       │
│                                                         │
│ MARTEDÌ: Utente clicca "Genera 5 Post"                  │
│          ↓                                               │
├─────────────────────────────────────────────────────────┤
│  REST API Call: POST /api/generate-posts                │
│  {                                                      │
│    "context_id": "week_001",                            │
│    "photo_id": "photo_chema_123",                       │
│    "daily_brief": "Chema applica BRAVERIA oggi"         │
│  }                                                      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
        ┌──────────────────────┐
        │   IL NOSTRO SDK      │
        │ (Backend Python/Node)│
        └──────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
   ┌─────────────┐    ┌──────────────┐
   │ API BRAVO   │    │ ClaudeAPI    │
   │ (recupera)  │    │ (genera)     │
   └─────────────┘    └──────────────┘
        │                     │
        ├─ Foto              ├─ Contesto settimanale
        ├─ Testi             ├─ Foto (scaricata)
        └─ Context           ├─ Testi (recuperati)
                             └─ Genera 5 post
                   │
                   ↓
        ┌──────────────────────┐
        │  5 POST GENERATI     │
        │  (con immagini)      │
        └──────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│                    APP BRAVO                            │
│                                                         │
│  Mostra 5 opzioni:                                      │
│  ✓ Opzione 1: "CHEMA EN CAMPO: ARRANQUE DE PIMIENTO"   │
│  ✓ Opzione 2: "BRAVERIA: FUERZA DESDE EL DÍA 1"        │
│  ✓ Opzione 3: "3 SEÑALES DE QUE TU ARRANQUE VA MAL"    │
│  ✓ Opzione 4: "LO QUE SE MIDE, SE MEJORA"              │
│  ✓ Opzione 5: "¿SEGURO QUE TU ARRANQUE ES BUENO?"      │
│                                                         │
│  L'utente sceglie: "Mi piace Opzione 2" → PUBBLICA     │
│                                                         │
│  POST 2 → Instagram/Facebook/LinkedIn ✅ PUBBLICATO     │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Cosa Deve Fare BRAVO (Backend)

### 1. **Database Schema**

```sql
-- Contesto settimanale
CREATE TABLE weekly_contexts (
    context_id UUID PRIMARY KEY,
    week_start DATE NOT NULL,
    theme TEXT NOT NULL,
    technical_points JSONB,  -- ["punto 1", "punto 2", ...]
    narrative_angles JSONB,  -- ["angolo 1", "angolo 2", ...]
    featured_products JSONB, -- ["BRAVERIA", "AIGRO"]
    team_members JSONB,      -- ["Chema", "Camilo"]
    created_at TIMESTAMP
);

-- Foto caricate
CREATE TABLE photos (
    photo_id UUID PRIMARY KEY,
    context_id UUID REFERENCES weekly_contexts,
    photo_url TEXT NOT NULL,  -- S3, CloudStorage, ecc.
    photo_date DATE,
    description TEXT,
    position_in_photo VARCHAR(20),  -- "top-left", "center", ecc.
    uploaded_at TIMESTAMP
);

-- Testi/conversazioni
CREATE TABLE context_texts (
    text_id UUID PRIMARY KEY,
    context_id UUID REFERENCES weekly_contexts,
    content_type VARCHAR(50),  -- "chat_message", "voice_note", "report"
    text_content TEXT NOT NULL,
    author VARCHAR(100),  -- "Chema", "fotografo", ecc.
    text_date DATE,
    importance_level INT DEFAULT 3,  -- 1-5
    created_at TIMESTAMP
);

-- Post generati
CREATE TABLE generated_posts (
    post_id UUID PRIMARY KEY,
    context_id UUID REFERENCES weekly_contexts,
    photo_id UUID REFERENCES photos,
    headline TEXT NOT NULL,
    body TEXT,
    caption TEXT NOT NULL,
    layout_variant VARCHAR(50),
    created_at TIMESTAMP,
    status VARCHAR(20),  -- "pending", "approved", "published"
    published_url TEXT,  -- URL Instagram/Facebook dopo pubblicazione
    published_at TIMESTAMP
);
```

### 2. **REST API Endpoints**

#### GET `/api/v1/context/{context_id}`
```json
// Response 200
{
  "id": "week_001",
  "week_start": "2026-04-15",
  "theme": "Fase arranque con BRAVERIA",
  "technical_points": [
    "Le radici si sviluppano prima delle foglie",
    "Un tallo debole in arranque = raccolto debole",
    "La natura ha formule, noi le riplicamo"
  ],
  "narrative_angles": [
    "Hook provocatorio",
    "Caso di studio",
    "Educazione tecnica",
    "Confronto prima/dopo",
    "Consiglio pratico"
  ],
  "featured_products": ["BRAVERIA", "AIGRO"],
  "team_members": ["Chema", "Camilo", "María"]
}
```

#### GET `/api/v1/context/{context_id}/photos`
```json
// Response 200
{
  "items": [
    {
      "id": "photo_001",
      "url": "https://s3.bravo.com/photos/chema_applying_braveria.jpg",
      "date": "2026-04-16",
      "description": "Chema applica BRAVERIA su pimiento extragrande",
      "position": "center"
    },
    {
      "id": "photo_002",
      "url": "https://s3.bravo.com/photos/radici_forti.jpg",
      "date": "2026-04-17",
      "description": "Dettaglio radici dopo 10 giorni da arranque",
      "position": "top-left"
    }
  ]
}
```

#### GET `/api/v1/context/{context_id}/texts?min_importance=3`
```json
// Response 200
{
  "items": [
    {
      "id": "text_001",
      "type": "chat_message",
      "content": "Chema: Le radici sono incredibilmente forti questa stagione",
      "author": "Chema",
      "date": "2026-04-16",
      "importance": 5
    },
    {
      "id": "text_002",
      "type": "voice_note",
      "content": "Registrazione: Sensori AIGRO registrano temperature ottimali, umidità 65%",
      "author": "Tecnico",
      "date": "2026-04-16",
      "importance": 4
    },
    {
      "id": "text_003",
      "type": "field_report",
      "content": "Report giornaliero: Applicazione BRAVERIA completata ore 08:00. Tutti i settori trattati.",
      "author": "Fotografo",
      "date": "2026-04-16",
      "importance": 3
    }
  ]
}
```

#### POST `/api/v1/context/{context_id}/posts`
```json
// Request
{
  "posts": [
    {
      "headline": "CHEMA EN CAMPO: ARRANQUE DE PIMIENTO",
      "body": "Análisis radicular - BRAVERIA - sensores AIGRO - almería",
      "caption": "El arranque lo es todo. Lo que le das a la planta...",
      "layout_variant": "bottom-left",
      "photo_url": "https://s3.bravo.com/photos/chema_applying_braveria.jpg",
      "pillar": "EQUIPO"
    },
    // ... altri 4 post
  ]
}

// Response 201
{
  "status": "created",
  "post_ids": ["post_001", "post_002", "post_003", "post_004", "post_005"]
}
```

### 3. **Punto di Integrazione (Webhook/Button)**

Nel frontend BRAVO, quando l'utente clicca "Genera 5 Post":

```javascript
// Frontend BRAVO (React example)
async function generatePosts() {
  const contextId = getCurrentWeeklyContextId();  // Es: "week_001"
  const photoId = getSelectedPhotoId();           // Es: "photo_001"
  const dailyBrief = getUserInput();              // Es: "Chema applica BRAVERIA..."

  const response = await fetch('/api/v1/generate-posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context_id: contextId,
      photo_id: photoId,
      daily_brief: dailyBrief
    })
  });

  const { posts } = await response.json();
  
  // Mostra 5 varianti all'utente
  displayPostVariants(posts);
}
```

---

## 💻 Cosa Fa il NOSTRO SDK (Backend Python/Node)

```python
# backend/sdk_agent.py

from sdk_bravo_interface import BravoAPIInterface, GeneratedPost
from agents.content_designer import ContentDesignerAgent

class DaKadySDKAgent:
    def __init__(self, bravo_api: BravoAPIInterface, claude_api_key: str):
        self.bravo = bravo_api
        self.agent = ContentDesignerAgent(api_key=claude_api_key)

    def generate_posts(
        self,
        context_id: str,
        photo_id: str,
        daily_brief: str,
    ) -> List[GeneratedPost]:
        """
        WORKFLOW COMPLETO:
        1. Recupera contesto settimanale da BRAVO
        2. Recupera foto da BRAVO
        3. Recupera testi da BRAVO
        4. Combina tutto in un brief esteso per Claude
        5. Claude genera 5 post
        6. Salva i post in BRAVO
        7. Ritorna i 5 post
        """

        # Step 1: Carica contesto settimanale da BRAVO
        context = self.bravo.get_weekly_context(context_id)

        # Step 2: Carica foto da BRAVO
        photo = self._get_photo(photo_id)

        # Step 3: Carica testi da BRAVO (importanti, min 3/5)
        texts = self.bravo.get_texts_for_context(context_id, min_importance=3)

        # Step 4: Costruisci brief esteso per Claude
        extended_brief = self._build_extended_brief(
            context=context,
            photo=photo,
            texts=texts,
            daily_brief=daily_brief
        )

        # Step 5: Claude genera 5 post
        posts = self.agent.generate_posts(
            brief=extended_brief,
            photo_url=photo.photo_url,
            num_variants=5
        )

        # Step 6: Salva in BRAVO
        self.bravo.save_generated_posts(context_id, posts)

        # Step 7: Ritorna
        return posts

    def _build_extended_brief(self, context, photo, texts, daily_brief):
        """Combina contesto + foto + testi + daily brief"""
        return f"""
=== CONTESTO SETTIMANALE ===
Tema: {context.theme}
Prodotti: {', '.join(context.featured_products)}
Team: {', '.join(context.team_members)}

Punti tecnici:
{chr(10).join('- ' + p for p in context.technical_points)}

Angoli narrativi disponibili:
{chr(10).join('- ' + a for a in context.narrative_angles)}

=== TESTI DELLA SETTIMANA (dalle conversazioni) ===
{chr(10).join(f"[{t.author}] {t.text_content}" for t in texts)}

=== FOTO DI OGGI ===
Descrizione: {photo.photo_description}
Posizione soggetto: {photo.position_in_photo}

=== BRIEF QUOTIDIANO ===
{daily_brief}

Genera 5 post COERENTI che usino questi elementi.
"""
```

---

## 🔄 Flow Completo Settimana

### **LUNEDÌ**
1. Admin DaKady entra in BRAVO
2. Crea nuovo contesto settimanale:
   - Tema: "Fase arranque con BRAVERIA"
   - Prodotti evidenziati: BRAVERIA, AIGRO
   - 8 Angoli narrativi
   - Team: Chema, Camilo

### **MARTEDÌ**
1. Fotografo/Chema fa foto
2. Carica in BRAVO con descrizione
3. Scrive nota nel chat BRAVO: "Oggi abbiamo..."
4. Clicca "Genera 5 Post"
5. Nostro SDK recupera tutto e genera 5 varianti
6. BRAVO mostra i 5 post
7. Chema sceglie la migliore e la pubblica

### **MERCOLEDÌ-VENERDÌ**
- Ripete il flusso martedì
- **I 5 post generati ogni giorno rimangono COERENTI sul tema**

---

## 📦 Cosa Deve Implementare BRAVO

| Cosa | Chi | Come |
|------|-----|------|
| Database schema | Backend BRAVO | SQL migrations |
| REST API endpoints | Backend BRAVO | Express/FastAPI/Django |
| Upload UI foto | Frontend BRAVO | React/Vue form |
| Chat/note testi | Frontend BRAVO | Chat component |
| Bottone "Genera Post" | Frontend BRAVO | Button che chiama `/api/generate-posts` |
| Visualizzazione 5 post | Frontend BRAVO | Grid/carousel |
| Integrazione publishing | Backend BRAVO | Instagram API, Facebook API, ecc. |

---

## 🚀 Next Steps

1. **Documentiamo** le API REST che BRAVO deve esporre
2. **Creiamo** un client Python/Node che il backend BRAVO userà
3. **Testiamo** con un'app BRAVO di esempio
4. **Diamo a BRAVO** la documentazione completa per l'implementazione
