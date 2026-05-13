"""
Briefing DOCX Parser — formato canonico Studio Bravo.

Legge un .docx con le 10 sezioni numerate (01. ... 10.) e restituisce
il testo LETTERALE di ogni sezione. Niente riassunti, niente parafrasi,
niente fallback AI.

Se una sezione canonica manca: solleva BriefingFormatError con il nome
della sezione mancante, così l'utente sa cosa correggere nel .docx.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from typing import Dict, List

from docx import Document


CANONICAL_SECTIONS = [
    ("01", "DESCRIPCIÓN DEL CLIENTE"),
    ("02", "ALCANCE DEL PROYECTO"),
    ("03", "IDENTIDAD DE MARCA"),
    ("04", "PÚBLICO OBJETIVO"),
    ("05", "PILARES EDITORIALES"),
    ("06", "ÁNGULOS NARRATIVOS"),
    ("07", "MENSAJES CLAVE"),
    ("08", "OBJETIVOS Y KPI"),
    ("09", "CONTEXTO DE MERCADO"),
    ("10", "ESTACIONALIDAD"),
]

SECTION_HEADER_RE = re.compile(r"^\s*(\d{2})\.\s+(.+?)\s*$")
SEPARATOR_RE = re.compile(r"^[━─=\-]{3,}\s*$")


class BriefingFormatError(ValueError):
    """Il .docx non rispetta lo schema canonico delle 10 sezioni."""


@dataclass
class ParsedBriefing:
    sections: Dict[str, str]
    raw_text: str
    counts: Dict[str, int]

    def section(self, number: str) -> str:
        return self.sections.get(number, "")


def _read_paragraphs(data: bytes) -> List[str]:
    doc = Document(BytesIO(data))
    return [p.text for p in doc.paragraphs]


def _find_sections(paragraphs: List[str]) -> Dict[str, Dict]:
    """
    Trova gli header `NN. TITOLO` e raccoglie i paragrafi sotto ognuno.
    Salta i separatori `━━━`.
    """
    found: Dict[str, Dict] = {}
    current_num: str | None = None
    current_title: str = ""
    current_body: List[str] = []

    def flush():
        if current_num is not None:
            found[current_num] = {
                "title": current_title,
                "body": "\n".join(current_body).strip(),
            }

    for raw in paragraphs:
        line = raw.rstrip()
        if not line.strip():
            if current_num is not None:
                current_body.append("")
            continue
        if SEPARATOR_RE.match(line):
            continue
        m = SECTION_HEADER_RE.match(line)
        if m and m.group(1) in {n for n, _ in CANONICAL_SECTIONS}:
            flush()
            current_num = m.group(1)
            current_title = m.group(2).strip()
            current_body = []
            continue
        if current_num is not None:
            current_body.append(line)

    flush()
    return found


def _count_pillars(text: str) -> int:
    return len(re.findall(r"^\s*\d\.\s+[A-ZÁÉÍÓÚÑ]", text, re.MULTILINE))


def _count_angles(text: str) -> int:
    return len(re.findall(r"^\s*\d\.\s+[A-ZÁÉÍÓÚÑ]", text, re.MULTILINE))


def _count_personas(text: str) -> int:
    return len(re.findall(r"Persona\s+[A-Z]\b", text))


def parse_briefing_docx(data: bytes) -> ParsedBriefing:
    """
    Parsa il .docx canonico Studio Bravo.

    Solleva BriefingFormatError se manca una delle 10 sezioni canoniche.
    """
    paragraphs = _read_paragraphs(data)
    if not paragraphs:
        raise BriefingFormatError("El documento .docx está vacío")

    found = _find_sections(paragraphs)

    missing: List[str] = []
    for num, expected_title in CANONICAL_SECTIONS:
        if num not in found:
            missing.append(f"{num}. {expected_title}")
            continue
        actual_title = found[num]["title"].upper()
        if not actual_title.startswith(expected_title):
            missing.append(
                f"{num}. {expected_title} (encontrado: '{found[num]['title']}')"
            )

    if missing:
        raise BriefingFormatError(
            "Faltan o no coinciden secciones canónicas:\n  - "
            + "\n  - ".join(missing)
            + "\n\nUsa la plantilla Studio Bravo y respeta los títulos."
        )

    sections = {num: found[num]["body"] for num, _ in CANONICAL_SECTIONS}
    raw_text = "\n\n".join(
        f"{num}. {title}\n{sections[num]}"
        for num, title in CANONICAL_SECTIONS
    )

    counts = {
        "secciones": len(sections),
        "pilares": _count_pillars(sections["05"]),
        "angulos": _count_angles(sections["06"]),
        "personas": _count_personas(sections["04"]),
    }

    return ParsedBriefing(sections=sections, raw_text=raw_text, counts=counts)
