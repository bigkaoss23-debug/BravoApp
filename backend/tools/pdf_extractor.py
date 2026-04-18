"""
PDF Extractor — estrae testo grezzo integrale da un PDF.
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
