"""
DIAGNOSTICA — nessuna modifica al renderer.

Renderizza lo STESSO contenuto etiqueta_titulo su tutti e 4 i formati,
così com'è il codice ORA. Serve a vedere dove e quanto sbaglia prima
di decidere il fix Format Profiles.

Lanciare: cd backend && python scripts/test_formats_diagnostic.py
"""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env", override=True)

PHOTO = "/Users/bigart/Downloads/Gemini_Generated_Image_ux65k0ux65k0ux65.png"
OUT = ROOT / "scripts" / "_renders"
OUT.mkdir(exist_ok=True)

LABEL = "07:50"
HEADLINE = "Café, mermelada y el Tajo para ti"

FORMATS = ["Post 1:1", "Story 9:16", "Portada Reel", "Carosello"]


def main():
    from tools.editorial_renderer import render_etiqueta_titulo

    for fmt in FORMATS:
        try:
            img = render_etiqueta_titulo(
                PHOTO,
                label=LABEL,
                headline=HEADLINE,
                canvas_format=fmt,
                position="bottom-left",
                accent_word="Tajo",
            )
            w, h = img.size
            safe = fmt.replace(" ", "_").replace(":", "")
            path = OUT / f"diag_etiqueta_{safe}.png"
            img.save(path, "PNG")
            print(f"✓ {fmt:14s} {w}x{h}  → {path.name}")
        except Exception as e:
            print(f"✗ {fmt:14s} ERRORE: {e}")

    print(f"\nPNG in {OUT}/diag_etiqueta_*.png")


if __name__ == "__main__":
    main()
