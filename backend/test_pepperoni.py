#!/usr/bin/env python3
"""Test con foto peperoni reale - 28.png"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from agents.designer import composite, generate_variations

OUTPUT_DIR = Path(__file__).parent / "test_output/pepperoni"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Foto peperoni
photo = Path(__file__).parent.parent / "02_TEMPLATES_CANVA/IG_STORIES/28.png"

print("=" * 80)
print("TEST PEPERONI - Foto reale")
print("=" * 80)
print(f"\n📸 Foto: {photo.name}")
print(f"   Percorso: {photo}")
print(f"   Output: {OUTPUT_DIR}\n")

# Test 1: CENTERED-HEADER
print("\n[1/3] CENTERED-HEADER - Titolo centrato")
try:
    img1 = composite(
        photo_path=str(photo),
        headline="PIMENTÓN ROJO MADURO",
        body="Cosecha premium con sabor intenso",
        layout_variant="centered-header",
        label="VARIEDAD SELECTA",
        logo_position="top-center",
        content_format="Story 9:16",
        output_path=str(OUTPUT_DIR / "pepperoni_1_centered.png")
    )
    print("✓ Generato: pepperoni_1_centered.png")
except Exception as e:
    print(f"✗ Errore: {e}")

# Test 2: ASYMMETRIC-LEFT
print("\n[2/3] ASYMMETRIC-LEFT - Testo a sinistra")
try:
    img2 = composite(
        photo_path=str(photo),
        headline="CULTIVO SOSTENIBLE",
        body="Tecnología de precisión en cada planta",
        layout_variant="asymmetric-left",
        logo_position="top-center",
        content_format="Story 9:16",
        output_path=str(OUTPUT_DIR / "pepperoni_2_asymmetric.png")
    )
    print("✓ Generato: pepperoni_2_asymmetric.png")
except Exception as e:
    print(f"✗ Errore: {e}")

# Test 3: BOTTOM-LEFT
print("\n[3/3] BOTTOM-LEFT - Testo in basso")
try:
    img3 = composite(
        photo_path=str(photo),
        headline="FRESCO Y NATURAL",
        body="Directo de nuestras serras a tu mesa",
        layout_variant="bottom-left",
        logo_position="top-center",
        content_format="Story 9:16",
        output_path=str(OUTPUT_DIR / "pepperoni_3_bottom.png")
    )
    print("✓ Generato: pepperoni_3_bottom.png")
except Exception as e:
    print(f"✗ Errore: {e}")

print("\n" + "=" * 80)
print("TEST COMPLETATO")
print("=" * 80)
print(f"\n✓ Output salvati in: {OUTPUT_DIR}\n")
