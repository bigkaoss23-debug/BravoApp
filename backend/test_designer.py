#!/usr/bin/env python3
"""Test Script - Designer Agent con foto reali"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from agents.designer import composite, generate_variations

OUTPUT_DIR = Path(__file__).parent / "test_output"
OUTPUT_DIR.mkdir(exist_ok=True)

print("=" * 80)
print("DESIGNER AGENT - TEST SUITE")
print("=" * 80)

# Usa una foto da template
template_photo = Path(__file__).parent.parent / "02_TEMPLATES_CANVA/IG_STORIES/5.png"

if not template_photo.exists():
    print(f"❌ Foto non trovata: {template_photo}")
    sys.exit(1)

print(f"\n✓ Foto trovata: {template_photo.name}")

# TEST 1: CENTERED-HEADER
print("\n" + "=" * 80)
print("TEST 1: CENTERED-HEADER Layout")
print("=" * 80)

try:
    img1 = composite(
        photo_path=str(template_photo),
        headline="PROTOCOLO DESINFECCIÓN",
        body="El comienzo que mereces...",
        layout_variant="centered-header",
        label="DAKADY",
        logo_position="top-center",
        content_format="Story 9:16",
        output_path=str(OUTPUT_DIR / "test_1_centered_header.png")
    )
    print("✓ SUCCESSO - Output: test_1_centered_header.png")
except Exception as e:
    print(f"❌ ERRORE: {e}")
    import traceback
    traceback.print_exc()

# TEST 2: ASYMMETRIC-LEFT
print("\n" + "=" * 80)
print("TEST 2: ASYMMETRIC-LEFT Layout")
print("=" * 80)

try:
    img2 = composite(
        photo_path=str(template_photo),
        headline="NUEVA TÉCNICA",
        body="Resultados en 30 días",
        layout_variant="asymmetric-left",
        logo_position="top-center",
        content_format="Story 9:16",
        output_path=str(OUTPUT_DIR / "test_2_asymmetric_left.png")
    )
    print("✓ SUCCESSO - Output: test_2_asymmetric_left.png")
except Exception as e:
    print(f"❌ ERRORE: {e}")

# TEST 3: BOTTOM-LEFT (classico)
print("\n" + "=" * 80)
print("TEST 3: BOTTOM-LEFT Layout (Classico)")
print("=" * 80)

try:
    img3 = composite(
        photo_path=str(template_photo),
        headline="INNOVACIÓN EN SERRA",
        body="Sostenibilidad y rendimiento",
        layout_variant="bottom-left",
        logo_position="top-center",
        content_format="Story 9:16",
        output_path=str(OUTPUT_DIR / "test_3_bottom_left.png")
    )
    print("✓ SUCCESSO - Output: test_3_bottom_left.png")
except Exception as e:
    print(f"❌ ERRORE: {e}")

# TEST 4: Variazioni
print("\n" + "=" * 80)
print("TEST 4: GENERATE VARIATIONS")
print("=" * 80)

try:
    results = generate_variations(
        photo_path=str(template_photo),
        headline="SEGUIMIENTO ACTIVO",
        body="En tiempo real",
        variants=["centered-header", "asymmetric-left", "bottom-left"],
        output_dir=str(OUTPUT_DIR / "variations"),
        logo_position="top-center",
        content_format="Story 9:16"
    )
    print("\n✓ SUCCESSO - Generati 3 layout")
except Exception as e:
    print(f"❌ ERRORE: {e}")

# Summary
print("\n" + "=" * 80)
print("TEST COMPLETATO")
print("=" * 80)
print(f"\nOutput salvati in: {OUTPUT_DIR}\n")
