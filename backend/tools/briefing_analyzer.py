"""
briefing_analyzer.py — v2: Parser Python + Haiku fallback.

Legge il briefing strutturato (10 sezioni con ━━━) e cataloga ogni sezione
nel campo brand_kit_opus di client_brand in Supabase.
Zero LLM per briefing standard. Haiku solo come fallback per formati diversi.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import date
from typing import Optional

import anthropic

from tools.supabase_client import get_client


# ═══════════════════════════════════════════════════════════════════════════════
# SEZIONE 1 — PARSER PYTHON (formato standard: sezioni numerate con ━━━)
# ═══════════════════════════════════════════════════════════════════════════════

_SECTION_HEADER = re.compile(r"^0?(\d{1,2})\.\s*(.+?)$", re.MULTILINE)


def _split_sections(text: str) -> dict[int, tuple[str, str]]:
    """
    Trova le sezioni numerate (es. '01. DESCRIPCIÓN DEL CLIENTE') seguite da ━━━.
    Restituisce {numero: (titolo, corpo)}.
    """
    headers: list[tuple[int, str, int]] = []
    for m in _SECTION_HEADER.finditer(text):
        num = int(m.group(1))
        title = m.group(2).strip()
        after_title = m.end()
        rest = text[after_title:after_title + 200]
        if re.match(r"\s*━", rest):
            separator_end = text.find("\n", text.find("━", after_title))
            body_start = separator_end + 1 if separator_end != -1 else after_title
            headers.append((num, title, body_start))

    sections: dict[int, tuple[str, str]] = {}
    for i, (num, title, body_start) in enumerate(headers):
        if i + 1 < len(headers):
            next_num, next_title, _ = headers[i + 1]
            next_title_pos = text.find(f"{next_num:02d}. " if next_num < 10 else f"{next_num}. ", body_start)
            if next_title_pos == -1:
                next_title_pos = text.find(f"{next_num}. ", body_start)
            body = text[body_start:next_title_pos].strip() if next_title_pos != -1 else text[body_start:].strip()
        else:
            body = text[body_start:].strip()
            last_sep = body.rfind("━━━")
            if last_sep != -1:
                body = body[:last_sep].strip()
        sections[num] = (title, body)

    return sections


def _parse_description(body: str) -> dict:
    """§01 — Descripción del cliente."""
    result: dict = {"description": body.strip()}

    lines = body.strip().splitlines()
    for line in lines:
        line = line.strip()
        low = line.lower()
        if low.startswith("posicionamiento:"):
            result["positioning"] = line.split(":", 1)[1].strip()
        elif low.startswith("web:"):
            result["web"] = line.split(":", 1)[1].strip()
        elif low.startswith("instagram:"):
            result["instagram"] = line.split(":", 1)[1].strip()
        elif low.startswith("responsable") or low.startswith("contacto"):
            result["contact"] = line.split(":", 1)[1].strip() if ":" in line else line
        elif low.startswith("email:"):
            result["email"] = line.split(":", 1)[1].strip()

    first_para = []
    for line in lines:
        if not line.strip():
            break
        first_para.append(line.strip())
    if first_para:
        result["summary"] = " ".join(first_para)

    return result


def _parse_scope(body: str) -> dict:
    """§02 — Alcance del proyecto (scope)."""
    included: list[str] = []
    excluded: list[str] = []
    posts_month = 0
    stories_month = 0

    in_excluded = False
    in_included = True
    for line in body.splitlines():
        line = line.strip()
        low = line.lower()

        if "no incluido" in low or "no incluye" in low or "no incluye" in low:
            in_excluded = True
            in_included = False
            continue
        if "gestiona" in low or "incluido" in low or "incluye" in low:
            in_included = True
            in_excluded = False
            continue

        m_posts = re.search(r"(\d+)\s*posts?\s*(de\s*feed\s*)?.*?(?:por\s*mes|mensual|/\s*mes)", low)
        if m_posts:
            posts_month = int(m_posts.group(1))

        m_stories = re.search(r"(\d+)\s*(?:instagram\s*)?stories?\s*.*?(?:por\s*mes|mensual|/\s*mes)", low)
        if m_stories:
            stories_month = int(m_stories.group(1))

        if line.startswith("-"):
            item = line.lstrip("- ").strip()
            if item:
                (excluded if in_excluded else included).append(item)

    return {
        "feed_posts_per_month": posts_month or 8,
        "stories_per_month": stories_month or 12,
        "platforms": ["instagram"],
        "included": included,
        "excluded": excluded,
    }


def _parse_identity(body: str) -> dict:
    """§03 — Identidad de marca (tono de voz + reglas)."""
    result: dict = {"full_text": body.strip()}

    lines = body.strip().splitlines()
    for line in lines:
        line = line.strip()
        low = line.lower()
        if low.startswith("nombre:"):
            result["name"] = line.split(":", 1)[1].strip()
        elif low.startswith("eslogan:") or low.startswith("tagline:"):
            result["slogan"] = line.split(":", 1)[1].strip().strip('"')

    tov_start = None
    tov_end = None
    for i, line in enumerate(lines):
        low = line.strip().lower()
        if "tono de voz" in low or "tone of voice" in low:
            tov_start = i + 1
        elif tov_start and (low.startswith("correcto:") or low.startswith("ejemplo correcto")):
            tov_end = i
            break

    if tov_start:
        end = tov_end or len(lines)
        result["tone_of_voice"] = "\n".join(lines[tov_start:end]).strip()

    correct = _extract_example(body, ["correcto:", "ejemplo correcto"])
    incorrect = _extract_example(body, ["incorrecto:", "ejemplo incorrecto"])
    if correct:
        result["example_correct"] = correct
    if incorrect:
        result["example_incorrect"] = incorrect

    rules_do: list[str] = []
    rules_dont: list[str] = []
    in_dont = False
    for line in lines:
        low = line.strip().lower()
        if "qué no hacer" in low or "no hacer con la marca" in low or "don'ts" in low:
            in_dont = True
            continue
        if "qué hacer" in low or "do's" in low:
            in_dont = False
            continue
        if line.strip().startswith("- No ") or line.strip().startswith("- no "):
            rules_dont.append(line.strip().lstrip("- "))
            in_dont = True
        elif line.strip().startswith("-") and in_dont:
            rules_dont.append(line.strip().lstrip("- "))

    result["rules_do"] = rules_do
    result["rules_dont"] = rules_dont

    return result


def _extract_example(body: str, prefixes: list[str]) -> str:
    """Estrae un esempio dal testo cercando un prefisso."""
    lines = body.splitlines()
    for i, line in enumerate(lines):
        low = line.strip().lower()
        for prefix in prefixes:
            if low.startswith(prefix):
                parts = [line.split(":", 1)[1].strip() if ":" in line else ""]
                for j in range(i + 1, min(i + 4, len(lines))):
                    next_line = lines[j].strip()
                    if not next_line or next_line.startswith("-") or ":" in next_line[:20]:
                        break
                    parts.append(next_line)
                return " ".join(p for p in parts if p).strip().strip('"')
    return ""


def _parse_personas(body: str) -> list[dict]:
    """§04 — Público objetivo (personas)."""
    personas: list[dict] = []
    blocks = re.split(r"\n\s*\n", body.strip())

    current: dict = {}
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        header = re.match(r"Persona\s+[A-Z]\s*[—–-]\s*[\"«]?(.+?)[\"»]?$", block.splitlines()[0], re.IGNORECASE)
        if header:
            if current:
                personas.append(current)
            current = {"name": header.group(1).strip().strip('"')}
            for line in block.splitlines()[1:]:
                _parse_persona_line(line, current)
        elif current:
            for line in block.splitlines():
                _parse_persona_line(line, current)

    if current and current.get("name"):
        personas.append(current)

    return personas


def _parse_persona_line(line: str, persona: dict) -> None:
    line = line.strip()
    low = line.lower()

    age_m = re.search(r"edad:\s*(\d+[\s\-–]+\d+)", line, re.IGNORECASE)
    if age_m:
        persona["age_range"] = age_m.group(1).replace("–", "-")

    nat_m = re.search(r"nacionalidad:\s*(.+?)(?:\||$)", line, re.IGNORECASE)
    if nat_m:
        persona["nationality"] = nat_m.group(1).strip()

    if low.startswith("perfil:"):
        persona["profile"] = line.split(":", 1)[1].strip()
    elif "perfil:" not in low and line.startswith("Perfil"):
        persona["profile"] = line.split(":", 1)[1].strip() if ":" in line else line

    if low.startswith("canal:"):
        persona["channel"] = line.split(":", 1)[1].strip()

    msg_m = re.match(r"mensaje\s+que\s+resuena:\s*(.+)", line, re.IGNORECASE)
    if msg_m:
        persona["resonating_message"] = msg_m.group(1).strip().strip('"')


def _parse_pillars(body: str) -> list[dict]:
    """§05 — Pilares editoriales."""
    pillars: list[dict] = []
    current: dict = {}

    for line in body.splitlines():
        line = line.strip()
        m = re.match(r"(\d+)\.\s+(.+?)\s*\((\d+)%\)", line)
        if m:
            if current:
                pillars.append(current)
            current = {
                "name": m.group(2).strip(),
                "percentage": int(m.group(3)),
                "description": "",
                "formats": [],
            }
            continue

        if current:
            low = line.lower()
            if low.startswith("formatos:") or low.startswith("formato:"):
                fmts = line.split(":", 1)[1].strip()
                current["formats"] = [f.strip() for f in re.split(r"[,;]", fmts) if f.strip()]
            elif line and not line.startswith("-"):
                if current["description"]:
                    current["description"] += " " + line
                else:
                    current["description"] = line

    if current:
        pillars.append(current)

    return pillars


def _parse_angles(body: str) -> list[dict]:
    """§06 — Ángulos narrativos."""
    angles: list[dict] = []
    current: dict = {}
    desc_lines: list[str] = []

    for line in body.splitlines():
        line = line.strip()
        m = re.match(r"(\d+)\.\s+(.+)", line)
        if m and not line[0].isspace():
            name_candidate = m.group(2).strip()
            if len(name_candidate) < 60 and not name_candidate.startswith("Mostrar") and not name_candidate.startswith("Narrar"):
                if current:
                    current["description"] = " ".join(desc_lines).strip()
                    angles.append(current)
                current = {"name": name_candidate, "frequency": "", "headline_style": "", "example_headline": ""}
                desc_lines = []
                continue

        if current:
            low = line.lower()
            freq_m = re.search(r"cuándo usarlo:\s*(.+?)(?:\.|formato)", low)
            if freq_m:
                current["frequency"] = freq_m.group(1).strip()

            fmt_m = re.search(r"formato:\s*(.+)", low)
            if fmt_m:
                current["format"] = fmt_m.group(1).strip()

            ex_m = re.match(r"ejemplo:\s*[\"«]?(.+?)[\"»]?\s*$", line, re.IGNORECASE)
            if ex_m:
                current["example_headline"] = ex_m.group(1).strip().strip('"')
            elif line and not low.startswith("cuándo") and not low.startswith("ejemplo"):
                desc_lines.append(line)

    if current:
        current["description"] = " ".join(desc_lines).strip()
        angles.append(current)

    return angles


def _parse_messages(body: str) -> dict:
    """§07 — Mensajes clave."""
    result: dict = {"principal": "", "per_persona": {}, "hashtags": []}

    lines = body.strip().splitlines()
    for i, line in enumerate(lines):
        line = line.strip()
        low = line.lower()

        if low.startswith("mensaje principal"):
            for j in range(i + 1, min(i + 3, len(lines))):
                nxt = lines[j].strip().strip('"')
                if nxt:
                    result["principal"] = nxt
                    break

        persona_m = re.match(r"para\s+(.+?):", line, re.IGNORECASE)
        if persona_m:
            for j in range(i + 1, min(i + 3, len(lines))):
                nxt = lines[j].strip().strip('"')
                if nxt:
                    result["per_persona"][persona_m.group(1).strip()] = nxt
                    break

        hashtags = re.findall(r"#\w+", line)
        if hashtags:
            result["hashtags"] = list(dict.fromkeys(result["hashtags"] + hashtags))

    return result


def _parse_kpis(body: str) -> list[dict]:
    """§08 — KPIs."""
    kpis: list[dict] = []

    lines = body.strip().splitlines()
    in_table = False
    for line in lines:
        line = line.strip()
        low = line.lower()

        if low.startswith("kpi") and ("objetivo" in low or "target" in low or "canal" in low):
            in_table = True
            continue

        if in_table and line and not line.startswith("-"):
            parts = re.split(r"\s{2,}", line)
            if len(parts) >= 2:
                kpi: dict = {"metric": parts[0].strip()}
                if len(parts) >= 2:
                    kpi["target"] = parts[1].strip()
                if len(parts) >= 3:
                    kpi["channel"] = parts[2].strip()
                kpis.append(kpi)

        obj_m = re.match(r"-\s*(.+?):\s*(.+)", line)
        if obj_m and not in_table:
            if any(kw in low for kw in ["aumentar", "alcanzar", "mantener", "lograr", "conseguir"]):
                kpis.append({"metric": obj_m.group(0).lstrip("- ").strip(), "target": "", "channel": "", "type": "strategic"})

    return kpis


def _parse_competitors(body: str) -> list[dict]:
    """§09 — Competidores."""
    competitors: list[dict] = []
    current: dict = {}
    desc_lines: list[str] = []

    for line in body.splitlines():
        line = line.strip()
        m = re.match(r"-\s*(.+?):\s*(.+)", line)
        if m and len(m.group(1)) < 50:
            if current:
                if desc_lines:
                    current["notes"] = " ".join(desc_lines).strip()
                competitors.append(current)
            name = m.group(1).strip()
            desc = m.group(2).strip()

            threat = "media"
            low = desc.lower()
            if "vigilar" in low or "a vigilar" in low:
                threat = "media"
            elif "referente" in low or "aspiracional" in low:
                threat = "alta"
            elif "indirect" in low or "fuera" in low:
                threat = "baja"

            current = {"name": name, "positioning": desc, "threat_level": threat}
            desc_lines = []
        elif current and line:
            desc_lines.append(line)

    if current:
        if desc_lines:
            current["notes"] = " ".join(desc_lines).strip()
        competitors.append(current)

    return competitors


def _parse_seasonality(body: str) -> dict:
    """§10 — Estacionalidad."""
    result: dict = {"alta": [], "media": [], "baja": [], "events": []}

    lines = body.strip().splitlines()
    current_season: str | None = None

    for line in lines:
        line = line.strip()
        low = line.lower()

        if "alta temporada" in low or "temporada alta" in low or ("alta" in low and "prioridad" in low):
            current_season = "alta"
        elif ("temporada media" in low) or ("media" in low and ("contenido regular" in low or "temporada" in low)):
            current_season = "media"
        elif "temporada baja" in low or ("baja" in low and ("foco" in low or "inspiración" in low or "mantenimiento" in low)):
            current_season = "baja"

        if "notas para" in low or "notas:" in low:
            current_season = None

        if current_season and current_season in ("alta", "media", "baja"):
            months = _extract_months(low)
            if months:
                result[current_season].extend(m for m in months if m not in result[current_season])

        event_m = re.match(r"-\s*(\w+):\s*(.+)", line)
        if event_m:
            result["events"].append({
                "period": event_m.group(1).strip(),
                "note": event_m.group(2).strip(),
            })

    return result


_MONTH_NAMES = {
    "enero": "Enero", "febrero": "Febrero", "marzo": "Marzo",
    "abril": "Abril", "mayo": "Mayo", "junio": "Junio",
    "julio": "Julio", "agosto": "Agosto", "septiembre": "Septiembre",
    "octubre": "Octubre", "noviembre": "Noviembre", "diciembre": "Diciembre",
}


def _extract_months(text: str) -> list[str]:
    """Estrae nomi di mesi dal testo."""
    found = []
    low = text.lower()
    for key, label in _MONTH_NAMES.items():
        if key in low:
            found.append(label)
    # Gestione range "Abril–Mayo"
    range_m = re.findall(r"(\w+)[–\-]+(\w+)", low)
    for start, end in range_m:
        keys = list(_MONTH_NAMES.keys())
        try:
            si = keys.index(start)
            ei = keys.index(end)
            for i in range(si, ei + 1):
                label = _MONTH_NAMES[keys[i]]
                if label not in found:
                    found.append(label)
        except ValueError:
            pass
    return found


def parse_standard_briefing(text: str) -> dict | None:
    """
    Tenta di parsare un briefing con formato standard (sezioni ━━━ numerate).
    Restituisce dict con tutte le sezioni catalogate, o None se il formato non è riconosciuto.
    """
    sections = _split_sections(text)
    if len(sections) < 5:
        return None

    data: dict = {}

    if 1 in sections:
        data["client_info"] = _parse_description(sections[1][1])

    if 2 in sections:
        data["scope"] = _parse_scope(sections[2][1])

    if 3 in sections:
        identity = _parse_identity(sections[3][1])
        data["tone_of_voice"] = identity.get("tone_of_voice", identity.get("full_text", ""))
        data["identity"] = identity

    if 4 in sections:
        data["personas"] = _parse_personas(sections[4][1])

    if 5 in sections:
        data["pillar_identity"] = _parse_pillars(sections[5][1])

    if 6 in sections:
        data["angle_identity"] = _parse_angles(sections[6][1])

    if 7 in sections:
        data["key_messages"] = _parse_messages(sections[7][1])

    if 8 in sections:
        data["kpis"] = _parse_kpis(sections[8][1])

    if 9 in sections:
        data["competitors"] = _parse_competitors(sections[9][1])

    if 10 in sections:
        data["seasonality"] = _parse_seasonality(sections[10][1])

    data["rules_do"] = data.get("identity", {}).get("rules_do", [])
    data["rules_dont"] = data.get("identity", {}).get("rules_dont", [])

    return data


# ═══════════════════════════════════════════════════════════════════════════════
# SEZIONE 2 — FALLBACK HAIKU (per briefing non standard)
# ═══════════════════════════════════════════════════════════════════════════════

_HAIKU_SYSTEM = """Eres un catalogador de briefings de marketing. Tu trabajo es EXTRAER y CATALOGAR la información del briefing, NO interpretarla ni reescribirla.

Lee el briefing y devuelve un JSON con estas claves (omite las que no encuentres):

{
  "client_info": {"description": "...", "positioning": "...", "web": "...", "instagram": "...", "contact": "...", "email": "..."},
  "scope": {"feed_posts_per_month": 8, "stories_per_month": 12, "platforms": ["instagram"], "included": [...], "excluded": [...]},
  "tone_of_voice": "texto completo de la sección de tono de voz",
  "identity": {"name": "...", "slogan": "...", "tone_of_voice": "...", "example_correct": "...", "example_incorrect": "...", "rules_do": [...], "rules_dont": [...]},
  "personas": [{"name": "...", "age_range": "...", "nationality": "...", "profile": "...", "channel": "...", "resonating_message": "..."}],
  "pillar_identity": [{"name": "...", "percentage": 30, "description": "...", "formats": [...]}],
  "angle_identity": [{"name": "...", "frequency": "...", "description": "...", "example_headline": "..."}],
  "key_messages": {"principal": "...", "per_persona": {"Persona A": "..."}, "hashtags": ["#Tag1"]},
  "kpis": [{"metric": "...", "target": "...", "channel": "..."}],
  "competitors": [{"name": "...", "positioning": "...", "threat_level": "alta|media|baja"}],
  "seasonality": {"alta": [...], "media": [...], "baja": [...], "events": [{"period": "...", "note": "..."}]},
  "rules_do": [...],
  "rules_dont": [...]
}

REGLAS:
- Copia el texto original, no lo reescribas
- Los porcentajes de pilares deben sumar 100
- Hashtags con # incluido
- Responde SOLO con el JSON, sin texto antes ni después"""


def _analyze_with_haiku(briefing_text: str, client_name: str = "") -> dict:
    """Fallback: usa Haiku per catalogare un briefing non standard."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY non configurata")

    claude = anthropic.Anthropic(api_key=api_key)

    user_msg = f"BRIEFING DE {client_name or 'CLIENTE'}:\n\n{briefing_text}"

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4000,
        system=_HAIKU_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start != -1 and end > start:
        raw = raw[start:end]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    try:
        from json_repair import repair_json
        repaired = repair_json(raw, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return repaired
    except Exception:
        pass

    cleaned = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Haiku ha restituito JSON non valido: {e}. Primi 300 chars: {raw[:300]}")


# ═══════════════════════════════════════════════════════════════════════════════
# SEZIONE 3 — ANALYZE (entry point unico)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze(briefing_text: str, client_name: str = "") -> dict:
    """
    Analizza il briefing: prima tenta il parser Python (gratis, istantaneo),
    poi fallback a Haiku (~$0.01, 2 secondi).
    """
    data = parse_standard_briefing(briefing_text)

    if data is not None:
        print(f"✅ briefing_analyzer: parser Python riuscito — {len(data)} sezioni catalogate")
        return data

    print("⚠️  briefing_analyzer: formato non standard, fallback a Haiku...")
    return _analyze_with_haiku(briefing_text, client_name)


# ═══════════════════════════════════════════════════════════════════════════════
# SEZIONE 4 — SAVE TO SUPABASE (compatibile con v1, estesa per v2)
# ═══════════════════════════════════════════════════════════════════════════════

def save_to_supabase(client_id: str, data: dict) -> bool:
    """
    Salva i risultati nel campo brand_kit_opus di client_brand.
    Ogni sezione del briefing va nel suo campo dentro il JSON.
    Compatibile con il formato v1 (brand_store.py lo legge).
    """
    sb = get_client()
    if sb is None:
        raise RuntimeError("Supabase non configurato (SUPABASE_URL / SUPABASE_SECRET_KEY mancanti)")

    try:
        res = sb.table("client_brand").select("brand_kit_opus").eq("client_id", client_id).limit(1).execute()
        existing_opus = {}
        if res.data:
            existing_opus = res.data[0].get("brand_kit_opus") or {}

        new_opus: dict = {}

        if data.get("client_info"):
            new_opus["client_info"] = data["client_info"]

        if data.get("scope"):
            new_opus["scope"] = data["scope"]

        if data.get("identity"):
            new_opus["identity"] = data["identity"]

        if data.get("personas"):
            new_opus["personas"] = data["personas"]

        if data.get("pillar_identity"):
            new_opus["pillar_identity"] = data["pillar_identity"]
            new_opus["pillars"] = [
                {"name": p["name"], "description": p.get("description", ""), "percentage": p.get("percentage", 0), "examples": []}
                for p in data["pillar_identity"]
            ]

        if data.get("angle_identity"):
            new_opus["angle_identity"] = data["angle_identity"]

        if data.get("key_messages"):
            new_opus["key_messages"] = data["key_messages"]
            if data["key_messages"].get("hashtags"):
                new_opus["hashtags"] = data["key_messages"]["hashtags"]

        if data.get("kpis"):
            new_opus["kpis"] = data["kpis"]

        if data.get("competitors"):
            new_opus["competitors"] = data["competitors"]

        if data.get("seasonality"):
            new_opus["seasonality"] = data["seasonality"]

        if data.get("rules_do"):
            new_opus["rules_do"] = data["rules_do"]
        if data.get("rules_dont"):
            new_opus["rules_dont"] = data["rules_dont"]

        # Preserva campi esistenti dal brand kit (design_system, format_rules, seasonal_palette)
        # che vengono dal Brand Book, non dal briefing
        for keep_key in ("design_system", "format_rules", "seasonal_palette", "briefing_distilled"):
            if keep_key in existing_opus and keep_key not in new_opus:
                new_opus[keep_key] = existing_opus[keep_key]

        update_brand: dict = {"brand_kit_opus": new_opus, "updated_at": "now()"}

        if data.get("tone_of_voice"):
            update_brand["tone_of_voice"] = data["tone_of_voice"]

        if data.get("pillar_identity"):
            update_brand["pillars"] = new_opus.get("pillars", [])

        if res.data:
            sb.table("client_brand").update(update_brand).eq("client_id", client_id).execute()
        else:
            update_brand["client_id"] = client_id
            sb.table("client_brand").insert(update_brand).execute()

        print(f"✅ briefing_analyzer: client_brand aggiornato per {client_id}")

        # ── client_profile ──────────────────────────────────────────────
        profile_row: dict = {"client_id": client_id, "updated_at": "now()"}
        info = data.get("client_info", {})
        if info.get("description"):
            profile_row["history"] = info["description"]
        if data.get("scope"):
            scope = data["scope"]
            profile_row["scope"] = scope.get("included", [])
            profile_row["out_of_scope"] = scope.get("excluded", [])
        if info.get("contact"):
            profile_row["key_contacts"] = [{"name": info["contact"], "role": info.get("email", "")}]

        if len(profile_row) > 2:
            sb.table("client_profile").upsert(profile_row, on_conflict="client_id").execute()
            print(f"✅ briefing_analyzer: client_profile aggiornato per {client_id}")

        return True

    except Exception as e:
        raise RuntimeError(f"Errore salvataggio Supabase per {client_id}: {e}") from e


# ═══════════════════════════════════════════════════════════════════════════════
# SEZIONE 5 — ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def run_for_client(client_id: str, briefing_text: str, client_name: str = "") -> bool:
    """
    Entry point principale: analizza e salva per un singolo cliente.
    Stessa firma della v1 — main.py non deve cambiare.
    """
    if not briefing_text or len(briefing_text.strip()) < 100:
        raise ValueError(f"Briefing troppo corto ({len(briefing_text.strip())} chars) per {client_id}")

    print(f"📖 briefing_analyzer: catalogazione briefing di {client_name or client_id}...")

    data = analyze(briefing_text, client_name)
    save_to_supabase(client_id, data)
    print(f"🎉 briefing_analyzer: catalogazione completata per {client_name or client_id}")
    return True
