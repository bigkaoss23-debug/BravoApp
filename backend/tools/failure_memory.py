"""
failure_memory.py — Fase 1.7 · memoria dei rifiuti espliciti.

Due funzioni, due ruoli (modello validato con Bravo):
  - distill_failures(): l'AGENTE struttura il motivo umano (reason_raw)
    in reason_category + pattern_tag. NON inventa, NON giudica:
    struttura ciò che l'umano ha detto. Output en español.
  - get_active_failure_rules(): il SISTEMA espone le regole agli
    agenti di produzione (PhotoNeeds/Copy) perché non ripetano l'errore.

Regola d'oro: la tabella si nutre SOLO di rifiuti espliciti con motivo
(scritti da apply_photo_gate al Cancello 2), MAI di "non scelti".
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

import anthropic

from tools.supabase_client import get_client


TABLE = "failure_memory"

_CATEGORIES = ["composición", "paleta", "fuera-de-voz", "cliché",
               "formato", "encuadre", "otro"]

_SYSTEM = """Eres un estructurador de rechazos. Bravo (humano) ha rechazado
un trabajo y ha escrito EL MOTIVO. Tu única tarea: estructurar ese motivo
en una categoría y un patrón reutilizable. NO juzgas, NO inventas, NO
añades motivos que Bravo no dijo. Solo estructuras lo que él dijo.

TODO en ESPAÑOL.

reason_category — elige UNA de esta lista cerrada:
  composición · paleta · fuera-de-voz · cliché · formato · encuadre · otro

pattern_tag — un slug corto, reutilizable, en español con guiones,
que capture la regla a evitar. Ejemplos:
  "evitar-fachada-generica", "nada-cenital-en-9-16",
  "nada-sobresaturado", "evitar-postal-turistica"

regla_es — UNA frase imperativa breve en español, lista para inyectar
en el prompt de otro agente. Ej: "EVITAR: fachada genérica de edificio
(parece industrial, no boutique)".

OUTPUT — JSON exacto, sin texto fuera:
{"reason_category":"...","pattern_tag":"...","regla_es":"..."}"""


def _claude() -> anthropic.Anthropic:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY non configurata")
    return anthropic.Anthropic(api_key=key)


def distill_failures(client_id: Optional[str] = None, limit: int = 50) -> dict:
    """
    Struttura i rifiuti non ancora processati (distilled=false).
    Per ognuno: Sonnet → reason_category + pattern_tag + regla_es.
    Aggrega le occorrenze dello stesso pattern_tag (occurrences++).
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non disponibile")

    q = sb.table(TABLE).select("*").eq("distilled", False).limit(limit)
    if client_id:
        q = q.eq("client_id", client_id)
    rows = q.execute().data or []
    if not rows:
        return {"distilled": 0, "note": "niente da distillare"}

    cl = _claude()
    done = 0
    for r in rows:
        user = (
            f"DOMINIO: {r.get('domain')}\n"
            f"CONTEXTO: {json.dumps(r.get('context') or {}, ensure_ascii=False)}\n"
            f"TRABAJO RECHAZADO: {(r.get('rejected_text') or '')[:400]}\n"
            f"MOTIVO DE BRAVO (literal): {r.get('reason_raw')}\n\n"
            f"Estructura según el system. JSON exacto."
        )
        try:
            resp = cl.messages.create(
                model="claude-sonnet-4-6", max_tokens=400,
                system=_SYSTEM,
                messages=[{"role": "user", "content": user}],
            )
            raw = resp.content[0].text.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            s, e = raw.find("{"), raw.rfind("}") + 1
            data = json.loads(raw[s:e]) if s != -1 else {}
        except Exception as ex:
            print(f"   ⚠ distill fallito su {r['id']}: {ex}")
            continue

        cat = data.get("reason_category")
        if cat not in _CATEGORIES:
            cat = "otro"
        tag = (data.get("pattern_tag") or "").strip()
        regla = (data.get("regla_es") or "").strip()

        # Aggrega: se il pattern_tag esiste già per il cliente, incrementa
        prev = (
            sb.table(TABLE).select("id,occurrences")
            .eq("client_id", r["client_id"]).eq("pattern_tag", tag)
            .eq("distilled", True).limit(1).execute().data or []
        )
        occ = (prev[0]["occurrences"] + 1) if prev else 1

        sb.table(TABLE).update({
            "reason_category": cat,
            "pattern_tag": tag,
            "rejected_text": regla or r.get("rejected_text"),
            "occurrences": occ,
            "distilled": True,
            "updated_at": "now()",
        }).eq("id", r["id"]).execute()
        done += 1

    return {"distilled": done}


def get_active_failure_rules(
    client_id: str, domain: str, fmt: Optional[str] = None
) -> str:
    """
    Blocco testo (español) con le regole da NON violare, da iniettare
    nel prompt di PhotoNeeds / Copy Agent PRIMA di produrre.
    Ordinate per occurrences (le più ricorrenti pesano di più).
    Vuoto se non ci sono regole — nessun rumore nel prompt.
    """
    sb = get_client()
    if sb is None:
        return ""
    rows = (
        sb.table(TABLE).select("reason_category,pattern_tag,reason_raw,context,occurrences")
        .eq("client_id", client_id).eq("domain", domain)
        .eq("distilled", True)
        .order("occurrences", desc=True)
        .limit(20).execute().data or []
    )
    if fmt:
        rows = [r for r in rows
                if not (r.get("context") or {}).get("format")
                or (r.get("context") or {}).get("format") == fmt]
    if not rows:
        return ""

    lines = []
    seen = set()
    for r in rows:
        tag = r.get("pattern_tag") or ""
        if tag in seen:
            continue
        seen.add(tag)
        lines.append(f"  ✗ [{r.get('reason_category')}] "
                     f"{r.get('reason_raw')} (×{r.get('occurrences')})")

    return (
        "MEMORIA DE RECHAZOS — Bravo ya rechazó esto antes. NO repitas "
        "estos patrones:\n" + "\n".join(lines)
    )
