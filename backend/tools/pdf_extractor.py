"""
PDF/DOCX Extractor — estrae testo grezzo integrale da PDF o Word.
Nessun riassunto, nessun filtro. Serve al flusso Briefing cliente.
"""
from __future__ import annotations

from io import BytesIO
from pypdf import PdfReader


def extract_text_from_pdf_bytes(data: bytes) -> str:
    """Estrae il testo integrale da un PDF passato come bytes.

    Restituisce una stringa markdown-friendly: pagine separate da una riga
    vuota, nessun'altra manipolazione. Se il PDF è scannerizzato (solo
    immagini) il risultato sarà vuoto — in quel caso serve OCR (non gestito
    qui intenzionalmente, i briefing sono documenti testuali).
    """
    reader = PdfReader(BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text.strip())
    return "\n\n".join(p for p in pages if p).strip()


def extract_text_from_docx_bytes(data: bytes) -> str:
    """Estrae il testo integrale da un file Word (.docx) passato come bytes.

    Mantiene la struttura dei paragrafi separandoli con righe vuote.
    Tabelle: ogni cella viene estratta separata da tabulazione.
    """
    from docx import Document as DocxDocument

    doc = DocxDocument(BytesIO(data))
    parts: list[str] = []

    for block in doc.element.body:
        tag = block.tag.split("}")[-1] if "}" in block.tag else block.tag

        if tag == "p":
            # Paragrafo normale
            text = "".join(
                node.text or ""
                for node in block.iter()
                if node.tag.endswith("}t")
            ).strip()
            if text:
                parts.append(text)

        elif tag == "tbl":
            # Tabella: riga per riga, celle separate da tab
            for row in block.iter():
                if not row.tag.endswith("}tr"):
                    continue
                cells = []
                for cell in row.iter():
                    if not cell.tag.endswith("}tc"):
                        continue
                    cell_text = "".join(
                        n.text or ""
                        for n in cell.iter()
                        if n.tag.endswith("}t")
                    ).strip()
                    if cell_text:
                        cells.append(cell_text)
                if cells:
                    parts.append("\t".join(cells))

    return "\n\n".join(parts).strip()


def extract_text_from_file_bytes(data: bytes, filename: str) -> str:
    """Dispatcher: sceglie il parser giusto in base all'estensione del file."""
    if filename.lower().endswith(".docx"):
        return extract_text_from_docx_bytes(data)
    return extract_text_from_pdf_bytes(data)
