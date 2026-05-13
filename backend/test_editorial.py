"""
Test archetipo F (mixed_type) — stile "hotel deluxe / magazine cover".
4 esempi diversi sulla foto Belvedere per testare il mix italic/regular + subline CTA.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from tools.editorial_renderer import composite_editorial

PHOTO = "/Users/bigart/Downloads/Gemini_Generated_Image_ux65k0ux65k0ux65.png"
OUT = Path("/tmp/editorial_tests")
OUT.mkdir(exist_ok=True)

print("─" * 60)
print("Test archetipo F · Mixed type + CTA")
print("─" * 60)

# F1 — italic dopo · stile "Disfrutá de nuestro restaurante"
print("\n[F1] 'Una mesa {junto al Tajo}' + subline CTA · lower-left")
composite_editorial(
    PHOTO, "mixed_type",
    headline="Una mesa\n{junto al Tajo}",
    subline="Reserva tu mañana",
    position="lower-left",
    output_path=str(OUT / "v3_F1_mesa_tajo.png"),
)

# F2 — italic prima · stile "La tradición se sirve en la mesa"
print("\n[F2] '{Despertar} con la niebla' + subline · upper-left")
composite_editorial(
    PHOTO, "mixed_type",
    headline="{Despertar}\ncon la niebla",
    subline="Belvedere · Ronda",
    position="upper-left",
    output_path=str(OUT / "v3_F2_despertar_niebla.png"),
)

# F3 — italic in mezzo · stile "Espacios exclusivos para tus eventos"
print("\n[F3] 'Mañanas {sin prisa}' senza subline · mid-center")
composite_editorial(
    PHOTO, "mixed_type",
    headline="Mañanas\n{sin prisa}",
    subline=None,
    position="mid-center",
    output_path=str(OUT / "v3_F3_mananas_sin_prisa.png"),
)

# F4 — italic come finale enfatico · stile "Descansá y disfrutá"
print("\n[F4] 'El primer café del {valle}' + subline · lower-left")
composite_editorial(
    PHOTO, "mixed_type",
    headline="El primer café\ndel {valle}",
    subline="Cada mañana en Belvedere",
    position="lower-left",
    output_path=str(OUT / "v3_F4_primer_cafe_valle.png"),
)

print("\n" + "─" * 60)
print(f"✓ 4 versioni F in {OUT}/")
print("─" * 60)
