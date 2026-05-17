"""
produccion_aggregator.py — M1b · Control Tower (linguaggio interno).

SOLA LETTURA. Nessuna scrittura, nessuna tabella nuova, nessuna migrazione.
Aggrega ciò che esiste già (client_projects, editorial_plans,
photo_requests, failure_memory) e ne deriva lo stato di "Producción".

Una Producción è identificata da (client_uuid, macro, mes). In M1b NON è
persistita: l'id è un composito REVERSIBILE
    f"{client_uuid}::{macro}::{mes}"
perché senza tabella non potremmo risolvere un hash opaco. (Quando arriva
M1c con persistenza, l'id diventa una PK vera; gli endpoint non cambiano.)

Onestà: oggi solo il macro "contenidos" ha un modello-slot ricco
(editorial_plans). Per gli altri macro lo stato è minimale e marcato
`detalle_no_disponible: true` — non si inventano dati.
"""
from __future__ import annotations

from typing import Optional

from tools.supabase_client import get_client

# ── Config: macro → agente motore (fisso, NON AI) ──────────────────────────
MOTOR = {
    "contenidos":            "editorial_planner",
    "resenas":               "review_interpreter",
    "calendario":            "editorial_planner",
    "investigacion_mercado": "market_intelligence",
    "marketing":             "strategist",
}

# ── Config: rotta DAG fissa per macro (pasos in ordine) ────────────────────
# Liste annidate = pasos in parallelo.
FLUJO = {
    "contenidos": ["editorial_planner", "photoneeds",
                   ["disenador", "redactor"], "revisor", "programador"],
    "resenas":    ["review_interpreter", "redactor", "revisor", "programador"],
    "calendario": ["editorial_planner", "revisor"],
    "investigacion_mercado": ["market_intelligence"],
    "marketing":  ["strategist", "revisor"],
}

_SEP = "::"

# Agente PROPRIETARIO di ogni paso (≠ motore della produzione).
PASO_AGENTE = {
    "editorial_planner":    "editorial_planner",
    "photoneeds":           "photoneeds",
    "disenador":            "content_designer",
    "redactor":             "copy_agent",
    "revisor":              "revisor",
    "programador":          "scheduler",
    "review_interpreter":   "review_interpreter",
    "market_intelligence":  "market_intelligence",
    "strategist":           "strategist",
}

# Nome UMANO leggibile (il tecnico resta accanto, come riferimento).
HUMANO = {
    "photoneeds":          "Fotógrafo",
    "editorial_planner":   "Planificador editorial",
    "review_interpreter":  "Intérprete de reseñas",
    "copy_agent":          "Redactor",
    "content_designer":    "Diseñador",
    "revisor":             "Revisor",
    "scheduler":           "Programador",
    "market_intelligence": "Investigador de mercado",
    "strategist":          "Estratega",
}

MACRO_HUMANO = {
    "contenidos":            "Contenidos",
    "resenas":               "Reseñas",
    "calendario":            "Calendario",
    "investigacion_mercado": "Investigación de mercado",
    "marketing":             "Marketing",
}


def _humano(tec: str) -> str:
    return HUMANO.get(tec, tec)


# Mappa categoria reale (client_projects.category) → macro-dominio.
# Allineata ai valori VERI in DB (verificati su Belvedere il 17 mag):
#   contenidos_feed / contenidos_stories → contenidos
#   voz_huesped                          → resenas
#   planificacion                        → calendario
_CATEGORY_EXACT = {
    "voz_huesped":   "resenas",
    "planificacion": "calendario",
}


def _macro_from_category(category: Optional[str]) -> str:
    c = (category or "").strip().lower()
    if not c:
        return "contenidos"
    if c in _CATEGORY_EXACT:
        return _CATEGORY_EXACT[c]
    if c.startswith("contenidos") or "feed" in c or "stories" in c or "story" in c:
        return "contenidos"
    if "resen" in c or "reseñ" in c or "review" in c or "ugc" in c or "huesped" in c:
        return "resenas"
    if "calendar" in c or "planific" in c:
        return "calendario"
    if "mercado" in c or "research" in c or "investig" in c:
        return "investigacion_mercado"
    if "marketing" in c or "estrateg" in c or "strateg" in c:
        return "marketing"
    return c  # sconosciuto: macro = slug grezzo, motore "—" (onesto)


def make_id(client_uuid: str, macro: str, mes: str) -> str:
    return f"{client_uuid}{_SEP}{macro}{_SEP}{mes}"


def split_id(producion_id: str):
    parts = (producion_id or "").split(_SEP)
    if len(parts) != 3:
        return None
    return parts[0], parts[1], parts[2]


# ── Stato derivato per il macro "contenidos" (modello-slot ricco) ──────────
def _contenidos_state(sb, client_uuid: str, mes: str) -> dict:
    """
    Riusa la STESSA logica dell'endpoint che il frontend già vede
    (v2_get_editorial_plan): editorial_plans nel mese + split feed/stories.
    Bloqueo = slot senza foto confermata (= condizione no_photo_in_catalog).
    """
    slots = (
        sb.table("editorial_plans").select("*")
        .eq("client_id", client_uuid)
        .gte("week_start", f"{mes}-01")
        .lte("week_start", f"{mes}-31")
        .order("scheduled_date")
        .limit(60)
        .execute()
        .data or []
    )
    total = len(slots)
    hechos = sum(1 for s in slots if s.get("status") == "generated")

    confirmed = set()
    if slots:
        prs = (
            sb.table("photo_requests").select("plan_slot_id,status")
            .eq("client_id", client_uuid)
            .eq("status", "photo_confirmed")
            .execute()
            .data or []
        )
        confirmed = {p["plan_slot_id"] for p in prs if p.get("plan_slot_id")}

    falta_foto = [
        s for s in slots
        if s.get("status") != "generated" and s.get("id") not in confirmed
    ]
    bloqueos = []
    if falta_foto:
        bloqueos.append({
            "paso": "photoneeds",
            "motivo": "faltan fotos en catálogo",
            "slots": [
                {"id": s.get("id"), "fecha": s.get("scheduled_date"),
                 "format": s.get("format")}
                for s in falta_foto
            ],
        })

    if total and hechos == total:
        estado = "completada"
    elif bloqueos:
        estado = "bloqueada"
    elif total:
        estado = "en_curso"
    else:
        estado = "sin_datos"

    return {
        "estado": estado,
        "carga": {"total": total, "hechos": hechos,
                  "bloqueados": len(falta_foto)},
        "bloqueos": bloqueos,
    }


def _generic_state() -> dict:
    """Macro senza modello-slot in M1b: niente dati finti."""
    return {
        "estado": "en_curso",
        "carga": {"total": 0, "hechos": 0, "bloqueados": 0},
        "bloqueos": [],
        "detalle_no_disponible": True,
    }


# ── API pubblica (sola lettura) ────────────────────────────────────────────
def list_producciones(client_id: str, mes: str) -> dict:
    from tools.brand_store import _resolve_client_uuid
    client_uuid = _resolve_client_uuid(client_id)
    sb = get_client()
    if sb is None:
        return {"client_id": client_uuid, "mes": mes, "producciones": []}
    # Guardia: se l'id non si è risolto in un UUID, niente query (la colonna
    # è uuid → eviterebbe un 500). Risposta vuota e pulita, sola lettura.
    if len(client_uuid) <= 20:
        return {"client_id": client_uuid, "mes": mes,
                "producciones": [], "nota": "cliente no resuelto"}

    projs = (
        sb.table("client_projects").select("category")
        .eq("client_id", client_uuid).execute().data or []
    )
    macros = []
    for p in projs:
        m = _macro_from_category(p.get("category"))
        if m not in macros:
            macros.append(m)
    if not macros:
        macros = ["contenidos"]

    out = []
    for macro in macros:
        st = (_contenidos_state(sb, client_uuid, mes)
              if macro == "contenidos" else _generic_state())
        motor = MOTOR.get(macro, "—")
        out.append({
            "producion_id": make_id(client_uuid, macro, mes),
            "client_id": client_uuid,
            "macro_dominio": macro,
            "macro_humano": MACRO_HUMANO.get(macro, macro),
            "mes": mes,
            "motor_agente": motor,
            "motor_humano": _humano(motor),
            **st,
        })
    return {"client_id": client_uuid, "mes": mes, "producciones": out}


def get_flujo(producion_id: str) -> dict:
    parts = split_id(producion_id)
    if not parts:
        return {"error": "producion_id inválido"}
    client_uuid, macro, mes = parts
    sb = get_client()
    chain = FLUJO.get(macro, [MOTOR.get(macro, "—")])

    state = (_contenidos_state(sb, client_uuid, mes)
             if (sb and macro == "contenidos") else _generic_state())
    bloqueado_pasos = {b["paso"] for b in state.get("bloqueos", [])}
    planner_hecho = state["carga"]["total"] > 0

    def node(paso):
        if paso in bloqueado_pasos:
            estado = "bloqueado"
        elif paso in ("editorial_planner", "review_interpreter",
                      "market_intelligence", "strategist") and planner_hecho:
            estado = "hecho"
        else:
            estado = "en_cola"
        ag = PASO_AGENTE.get(paso, paso)
        return {"paso": paso, "estado": estado,
                "agente_tecnico": ag, "agente_humano": _humano(ag)}

    pasos = []
    for step in chain:
        if isinstance(step, list):
            pasos.append({"paralelo": [node(p) for p in step]})
        else:
            pasos.append(node(step))

    return {
        "producion_id": producion_id,
        "client_id": client_uuid,
        "macro_dominio": macro,
        "macro_humano": MACRO_HUMANO.get(macro, macro),
        "mes": mes,
        "estado": state["estado"],
        "bloqueos": state.get("bloqueos", []),
        "pasos": pasos,
        **({"detalle_no_disponible": True}
           if state.get("detalle_no_disponible") else {}),
    }


def get_paso(producion_id: str, paso: str) -> dict:
    parts = split_id(producion_id)
    if not parts:
        return {"error": "producion_id inválido"}
    client_uuid, macro, mes = parts
    sb = get_client()

    state = (_contenidos_state(sb, client_uuid, mes)
             if (sb and macro == "contenidos") else _generic_state())
    bloqueo = next((b for b in state.get("bloqueos", [])
                    if b["paso"] == paso), None)

    # failure_memory (sola lettura, righe strutturate per la UI)
    memoria = []
    if sb is not None:
        try:
            rows = (
                sb.table("failure_memory")
                .select("reason_category,reason_raw,occurrences")
                .eq("client_id", client_uuid)
                .eq("distilled", True)
                .order("occurrences", desc=True)
                .limit(10).execute().data or []
            )
            memoria = [
                {"categoria": r.get("reason_category"),
                 "motivo": r.get("reason_raw"),
                 "veces": r.get("occurrences")}
                for r in rows
            ]
        except Exception:
            memoria = []

    ag_tec = PASO_AGENTE.get(paso, paso)
    motor_tec = MOTOR.get(macro, "—")

    # Próximo paso guidato: dice all'umano COSA fare adesso.
    siguiente = None
    if bloqueo and paso == "photoneeds":
        n = len((bloqueo or {}).get("slots") or [])
        siguiente = {
            "accion": "proponer_prompts",
            "titulo": "Pedir al Fotógrafo los prompts de foto",
            "detalle": f"Faltan {n} fotos. El Fotógrafo (PhotoNeeds) "
                       f"propondrá un prompt por slot; tú los apruebas.",
            "disponible": False,  # diventa True nella fetta operativa
            "nota": "se activa en el paso operativo (próximo mattone)",
        }

    return {
        "producion_id": producion_id,
        "client_id": client_uuid,
        "macro_dominio": macro,
        "macro_humano": MACRO_HUMANO.get(macro, macro),
        "mes": mes,
        "paso": paso,
        "agente_paso_tecnico": ag_tec,
        "agente_paso_humano": _humano(ag_tec),
        "motor_produccion_tecnico": motor_tec,
        "motor_produccion_humano": _humano(motor_tec),
        "bloqueo": bloqueo,
        "siguiente_paso": siguiente,
        "memoria_errores": memoria,
        "nota": ("La intervención humana ocurre solo en las Aprobaciones."),
        **({"detalle_no_disponible": True}
           if state.get("detalle_no_disponible") else {}),
    }
