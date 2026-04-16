"""
feedback_store.py — Persistenza e SINTESI dei feedback BRAVO.

I feedback vengono salvati in JSONL (una riga JSON per record) per portabilità.
Ma non vengono riiniettati raw nel prompt: vengono AGGREGATI in regole sintetiche
("evita layout X — rifiutato N volte per motivo Y") con decay temporale e cap di token.

File generato: 05_BACKEND/feedback_log.jsonl
"""

import json
import os
import re
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from models.content import ContentFeedback
from tools.supabase_client import get_client

FEEDBACK_FILE = Path(__file__).parent.parent / "feedback_log.jsonl"

# Cache in memoria: evita di riparsare il JSONL ad ogni chiamata.
# Invalida quando mtime del file cambia.
_CACHE: dict = {"mtime": None, "records": []}

# Quanti giorni prima che un feedback pesi di meno (half-life semplice).
_HALF_LIFE_DAYS = 30
# Cap massimo di record caricati in memoria per sintesi (taglio sui più recenti).
_MAX_RECORDS = 200


# =============================================================================
# Persistenza
# =============================================================================

def save_feedback(feedback: ContentFeedback) -> None:
    """Salva un feedback su JSONL locale e su Supabase (se configurato)."""
    record = feedback.model_dump()
    record["saved_at"] = datetime.now(timezone.utc).isoformat()

    # 1. Salva sempre in locale (fallback garantito)
    with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    # 2. Salva su Supabase (best-effort — non blocca se fallisce)
    try:
        client = get_client()
        if client:
            payload = {
                "content_id":       feedback.content_id,
                "client_id":        feedback.client_id,
                "status":           feedback.status,
                "rejection_reason": feedback.rejection_reason,
                "liked_aspects":    feedback.liked_aspects,
                "original_brief":   feedback.original_brief,
                "headline":         feedback.headline,
                "layout_variant":   feedback.layout_variant,
                "pillar":           feedback.pillar,
                "caption_preview":  feedback.caption_preview,
                "agent_notes":      feedback.agent_notes,
            }
            client.table("content_feedback").insert(payload).execute()
    except Exception as e:
        print(f"⚠️  Supabase feedback non salvato (locale OK): {e}")


def _load_all_records() -> list[dict]:
    """Carica (con cache) tutti i record dal file JSONL."""
    if not FEEDBACK_FILE.exists():
        return []

    mtime = FEEDBACK_FILE.stat().st_mtime
    if _CACHE["mtime"] == mtime:
        return _CACHE["records"]

    records = []
    with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    # Trattieni solo gli ultimi _MAX_RECORDS (i più recenti sono in fondo)
    records = records[-_MAX_RECORDS:]

    _CACHE["mtime"] = mtime
    _CACHE["records"] = records
    return records


def load_recent_rejections(client_id: str, max_items: int = 5) -> list[ContentFeedback]:
    """
    LEGACY — manteniuto per compatibilità.
    Preferire summarize_feedback() per un feedback aggregato.
    """
    records = _load_all_records()
    out: list[ContentFeedback] = []
    for record in records:
        if record.get("client_id") != client_id or record.get("status") != "rejected":
            continue
        try:
            out.append(ContentFeedback(**{
                k: v for k, v in record.items() if k != "saved_at"
            }))
        except Exception:
            continue
    return out[-max_items:]


# =============================================================================
# Aggregazione / sintesi
# =============================================================================

def _recency_weight(saved_at: Optional[str]) -> float:
    """
    Peso in [0.25, 1.0] basato sulla recency: un feedback di ieri pesa più di uno
    di 3 mesi fa. Half-life a _HALF_LIFE_DAYS giorni (decay esponenziale semplice).
    """
    if not saved_at:
        return 0.5
    try:
        ts = datetime.fromisoformat(saved_at.replace("Z", "+00:00"))
    except ValueError:
        return 0.5
    now = datetime.now(timezone.utc)
    age_days = max(0.0, (now - ts).total_seconds() / 86400.0)
    weight = 0.5 ** (age_days / _HALF_LIFE_DAYS)
    return max(0.25, min(1.0, weight))


_STOPWORDS = {
    "de", "la", "el", "en", "y", "a", "que", "un", "una", "los", "las",
    "es", "por", "con", "se", "para", "del", "al", "lo", "su", "muy",
    "il", "di", "e", "che", "per", "con", "da", "un", "una", "non",
    "the", "a", "is", "in", "of", "and", "to", "for", "it", "too",
}


def _normalize_reason(text: Optional[str], max_len: int = 80) -> Optional[str]:
    """
    Normalizza un rejection_reason o un liked_aspect per permettere il raggruppamento:
    - minuscolo
    - rimuove punteggiatura superflua
    - trim e tronca
    Ritorna None se il testo è vuoto o solo stopwords.
    """
    if not text:
        return None
    t = text.strip().lower()
    t = re.sub(r"[\"'`]", "", t)
    t = re.sub(r"\s+", " ", t)
    if not t:
        return None
    tokens = [w for w in re.findall(r"[\wàèéìòùáéíóúñ]+", t) if w not in _STOPWORDS]
    if not tokens:
        return None
    key = " ".join(tokens)[:max_len]
    return key


def summarize_feedback(client_id: str, max_items: int = 30) -> dict:
    """
    Aggrega i feedback recenti in pattern ricorrenti, pesati per recency.

    Ritorna un dict:
      {
        "avoid":   [(descrizione, score, count), ...]   # top pattern di rifiuto
        "prefer":  [(descrizione, score, count), ...]   # top pattern di approvazione
        "totals":  {"approved": N, "rejected": N},
      }
    Una "descrizione" è una coppia layout|motivo così che layout ricorrenti in
    rifiuti/approvazioni restino distinti dai motivi testuali.
    """
    records = _load_all_records()
    client_records = [r for r in records if r.get("client_id") == client_id]
    # Più recenti prima, poi cap
    client_records = list(reversed(client_records))[:max_items]

    avoid_score: Counter = Counter()
    avoid_count: Counter = Counter()
    prefer_score: Counter = Counter()
    prefer_count: Counter = Counter()
    totals = {"approved": 0, "rejected": 0, "revised": 0}

    for r in client_records:
        status = r.get("status")
        if status not in totals:
            continue
        totals[status] += 1
        weight = _recency_weight(r.get("saved_at"))
        layout = (r.get("layout_variant") or "").strip() or "unspecified"

        if status == "rejected":
            reason = _normalize_reason(r.get("rejection_reason"))
            if reason:
                key = f"layout={layout} | motivo={reason}"
                avoid_score[key] += weight
                avoid_count[key] += 1
        elif status == "approved":
            aspects = r.get("liked_aspects") or []
            if not aspects:
                # Se l'approvazione non specifica cosa è piaciuto, premiamo
                # almeno il layout come pattern positivo.
                key = f"layout={layout}"
                prefer_score[key] += weight
                prefer_count[key] += 1
            else:
                for aspect in aspects:
                    norm = _normalize_reason(aspect, max_len=60)
                    if not norm:
                        continue
                    key = f"layout={layout} | aspecto={norm}"
                    prefer_score[key] += weight
                    prefer_count[key] += 1

    def _top(scores: Counter, counts: Counter, n: int = 5) -> list[tuple[str, float, int]]:
        return [
            (k, round(scores[k], 2), counts[k])
            for k, _ in scores.most_common(n)
        ]

    return {
        "avoid": _top(avoid_score, avoid_count),
        "prefer": _top(prefer_score, prefer_count),
        "totals": totals,
    }


# =============================================================================
# Iniezione nel prompt
# =============================================================================

# Cap conservativo sul numero di caratteri iniettati nel prompt (≈ 500 token).
_MAX_BLOCK_CHARS = 2000


def build_lessons_block(client_id: str) -> str:
    """
    Costruisce il blocco da iniettare nel prompt utente.
    Restituisce stringa vuota se non ci sono feedback recenti.
    """
    summary = summarize_feedback(client_id, max_items=40)
    avoid = summary["avoid"]
    prefer = summary["prefer"]
    if not avoid and not prefer:
        return ""

    lines = ["=== LECCIONES APRENDIDAS (feedback BRAVO aggregato) ==="]

    if avoid:
        lines.append("")
        lines.append("EVITA questi pattern (apparsi in rifiuti recenti):")
        for key, score, count in avoid:
            lines.append(f"  - {key}  [rifiutato {count}x, peso {score}]")

    if prefer:
        lines.append("")
        lines.append("PREFERISCI questi pattern (hanno funzionato in approvazioni):")
        for key, score, count in prefer:
            lines.append(f"  - {key}  [approvato {count}x, peso {score}]")

    lines.append("")
    lines.append(
        "Usa questo segnale come priorità, ma non ripetere meccanicamente: "
        "se il brief richiede esplicitamente qualcosa presente in EVITA, segui il brief."
    )

    block = "\n".join(lines)
    if len(block) > _MAX_BLOCK_CHARS:
        block = block[:_MAX_BLOCK_CHARS] + "\n[...truncato per limite contesto]"
    return block


def clear_cache() -> None:
    """Utility per test / reload: azzera la cache in memoria."""
    _CACHE["mtime"] = None
    _CACHE["records"] = []
