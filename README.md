# BRAVO — Centro de Mando

**Estudio Bravo / BRAVO!COMUNICA**  
Sistema di gestione progetti con backend Supabase e agenti AI.

---

## Stack

- **Frontend:** HTML + CSS + Vanilla JS
- **Backend:** Supabase (PostgreSQL + Real-time)
- **Deploy:** Netlify
- **Agenti AI:** Python + FastAPI (Fase 3)

## File principali

| File | Descrizione |
|---|---|
| `bravo.html` | App principale — interfaccia utente |
| `bravo.js` | Logica frontend |
| `bravo.css` | Stili |
| `bravo-db.js` | Connessione Supabase — **non toccare** |
| `bravo-supabase-schema.sql` | Schema database completo + seed data |
| `bravo-fix-rls.sql` | Fix permessi Supabase |

## Setup locale

```bash
# Avvia server locale
python3 -m http.server 3000

# Apri nel browser
http://localhost:3000/bravo.html
```

## Team

- Developer Backend — gestisce `bravo-db.js`, SQL, agenti
- Developer Frontend — gestisce `bravo.html`, `bravo.css`, `bravo.js`

## Regola fondamentale

> Il backend tocca solo `bravo-db.js` e i file SQL.  
> Il frontend tocca solo `bravo.html`, `bravo.css`, `bravo.js`.  
> Nessuno tocca i file dell'altro senza avvisare.

---

v0.1 — Aprile 2026
