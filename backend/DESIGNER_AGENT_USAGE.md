# Designer Agent — Enhanced Usage Guide

## Overview
The Designer Agent has been enhanced to support multiple DaKady® brand layout patterns, enabling varied and professional text positioning on photographer-provided photos.

---

## New Layout Variants

### CLASSIC VARIANTS (Original)
These existing layouts continue to work as before:

#### `bottom-left`
- Text block positioned at bottom-left corner
- Good for: Landscape photos with subject in upper portion
- Text occupies: ~72% width, bottom 40% height

#### `bottom-right`
- Text block positioned at bottom-right corner
- Good for: Landscape photos with subject on left side
- Text occupies: ~72% width, bottom 40% height

#### `bottom-full`
- Text centered, spanning full width at bottom
- Good for: Horizontal compositions, wide landscapes
- Text occupies: Full width, bottom 40% height

#### `top-left` / `top-right`
- Text positioned at top corner
- Good for: Photos with subject in lower portion
- Text occupies: ~72% width, top 30% height

#### `center`
- Text centered both horizontally and vertically
- Good for: Product photos, centered subjects
- Text occupies: Full width, center 50% height

---

### NEW DAKADY BRAND VARIANTS

#### `centered-header`
**Based on:** Pages 1-2 of DaKady templates
**Use case:** Inspirational, process-focused content

Features:
- Optional RED LABEL above headline (e.g., "NUEVA SERIE")
- LARGE WHITE HEADLINE centered
- Optional body text below headline
- White brand footer at bottom
- Dark gradient overlay covering bottom 50%

**Parameters:**
```python
composite(
    photo_path="photo.jpg",
    headline="EL TRABAJO QUE CONLLEVA UNA PLANTA",
    body="Seguimiento desde julio.",
    layout_variant="centered-header",
    label="NUEVA SERIE",  # Optional red label above headline
    label_color=ORANGE,   # RGB tuple (255, 127, 80)
    logo_position="top-center"
)
```

**Visual Layout:**
```
        KD Logo (top-center, 15% from top)
        
        
        NUEVA SERIE (red, 38% from top)
        
        EL TRABAJO QUE CONLLEVA
        UNA PLANTA (white, 50% from top, large)
        
        Seguimiento desde julio. (body, 62% from top)
        
        
        
        [Dark gradient overlay]
        
Dakady GreenHouse Solutions (footer, 93% from top)
```

---

#### `centered-with-logo`
**Based on:** Page 4 of DaKady templates
**Use case:** Feature pages with explicit logo placement

Features:
- Same as `centered-header`
- Explicit spacing for KD logo positioning
- Good for high-impact announcement pages

---

#### `asymmetric-left` / `asymmetric-right`
**Based on:** Page 13 of DaKady templates
**Use case:** Team introductions, team showcases, event coverage

Features:
- Text positioned on left OR right side (40% width)
- Photo/subject occupies opposite side (60% width)
- Dark overlay only on text side
- White headline + body text
- Ideal for portrait photography

**Parameters:**
```python
composite(
    photo_path="team_photo.jpg",
    headline="Esta semana visitamos",
    body="Fruit Attraction expo 2025",
    layout_variant="asymmetric-left",  # Text on left, photo on right
    logo_position="top-center"
)
```

**Visual Layout (asymmetric-left):**
```
        KD Logo (top-center)
        Tagline (red, centered)

[Dark Overlay]  │  [PHOTO/SUBJECT]
Esta semana     │
visitamos       │
                │
Fruit           │
Attraction      │
                │
Att. Camilo     │
                │
```

---

## Complete Parameter List

### Required Parameters
- `photo_path` (str): Path to photographer's photo

### Text Content Parameters  
- `headline` (str): Main text (will be uppercased automatically)
- `body` (Optional[str]): Secondary text

### Layout Parameters
- `layout_variant` (str): One of the variants listed above
  - Default: `"bottom-left"`
- `logo_position` (str): Where to place KD watermark
  - Options: `"top-center"`, `"top-left"`, `"top-right"`, `"bottom-center"`, `"bottom-left"`, `"bottom-right"`
  - Default: `"top-center"`
- `content_format` (str): Canvas size
  - Options: `"Story 9:16"` (1080×1920), `"Post 1:1"` (1080×1080), `"Carosello"`, `"Portada Reel"`
  - Default: `"Post 1:1"`

### Brand Parameters (NEW)
- `label` (Optional[str]): Red/orange subtitle/label text
  - Appears above headline in centered layouts
  - Will be uppercased automatically
  - Default: `None`
- `subtitle_color` (tuple): RGB color for label
  - Default: `ORANGE` (255, 127, 80)
  - Can also use: `RED` (192, 57, 43)
- `side` (str): For asymmetric layouts
  - Options: `"left"` or `"right"`
  - Default: `"left"`

### Output Parameters
- `output_path` (Optional[str]): Where to save PNG
  - If `None`, only returns PIL Image in memory
  - Default: `None`

---

## Code Examples

### Example 1: Centered Layout with Label (Page 1 style)
```python
from agents.designer import composite

img = composite(
    photo_path="/path/to/greenhouse.jpg",
    headline="El trabajo que conlleva una planta",
    body="Seguimiento desde julio.",
    layout_variant="centered-header",
    label="Nueva serie",
    logo_position="top-center",
    content_format="Story 9:16",
    output_path="/output/post_1.png"
)
```

### Example 2: Asymmetric Layout with Team Photo (Page 13 style)
```python
img = composite(
    photo_path="/path/to/team_photo.jpg",
    headline="Esta semana visitamos",
    body="Fruit Attraction expo",
    layout_variant="asymmetric-left",
    logo_position="top-center",
    content_format="Post 1:1",
    output_path="/output/team_post.png"
)
```

### Example 3: Classic Bottom-Left (Original)
```python
img = composite(
    photo_path="/path/to/photo.jpg",
    headline="Nueva técnica",
    body="Resultados en 30 días",
    layout_variant="bottom-left",
    content_format="Story 9:16"
)
```

---

## Generate Variations
The `generate_variations()` function creates multiple layouts from the same photo:

```python
from agents.designer import generate_variations

results = generate_variations(
    photo_path="/path/to/photo.jpg",
    headline="Nuevo producto",
    body="Ahora disponible",
    variants=["centered-header", "asymmetric-left", "bottom-left", "center"],
    output_dir="/output/variations/",
    logo_position="top-center",
    content_format="Story 9:16"
)

for result in results:
    print(f"✓ {result['variant']} → {result['path']}")
```

---

## Font & Color Information

### Fonts Used
- **Headline (Bebas Neue Bold)**: 48-124px
  - Used for main text and red labels
  - Tight letter-spacing (4-8px line height)
- **Body (Libre Franklin Regular)**: 24-45px
  - Used for secondary text
  - Medium line-spacing (6-12px)

### Colors
- **White**: `(255, 255, 255)` — Main text
- **Light Gray**: `(230, 230, 230)` — Body text
- **Orange**: `(255, 127, 80)` — Labels/subtitles (default)
- **Red**: `(192, 57, 43)` — Alternative label color
- **Black**: `(26, 26, 26)` — Text shadows

---

## Best Practices

### Text Positioning
1. ✅ DO: Use `centered-header` for inspirational/process content
2. ✅ DO: Use `asymmetric-left`/`asymmetric-right` for people/portraits
3. ✅ DO: Keep headlines under 5 words when possible
4. ❌ DON'T: Use more than 2 text element types (headline + label, or headline + body)

### Photo Selection
1. ✅ DO: Choose photos with clear visual composition (subject in upper/lower portion)
2. ✅ DO: Use landscape-oriented photos for `bottom-*` variants
3. ✅ DO: Use portrait photos for `asymmetric` variants
4. ❌ DON'T: Use photos with dense backgrounds (hard to read text)

### Colors & Contrast
1. ✅ DO: Rely on dark overlay gradient for text readability
2. ✅ DO: Use white text for maximum contrast
3. ✅ DO: Use red/orange labels to draw attention
4. ❌ DON'T: Use light text on light photo areas

---

## Testing New Layouts

To test the enhanced Designer Agent:

```python
import os
from agents.designer import composite

test_photo = "/path/to/test_photo.jpg"
test_cases = [
    {
        "headline": "Nuevo producto",
        "body": "Disponible ahora",
        "layout": "centered-header",
        "label": "Lanzamiento"
    },
    {
        "headline": "Equipo DaKady",
        "body": "En IBERFLORA 2025",
        "layout": "asymmetric-left"
    },
    {
        "headline": "Protocolo técnico",
        "layout": "bottom-left"
    }
]

output_dir = "/output/test_layouts/"
os.makedirs(output_dir, exist_ok=True)

for i, test in enumerate(test_cases, 1):
    output = os.path.join(output_dir, f"test_{i}_{test['layout']}.png")
    img = composite(
        photo_path=test_photo,
        headline=test["headline"],
        body=test.get("body"),
        layout_variant=test["layout"],
        label=test.get("label"),
        output_path=output
    )
    print(f"✓ Test {i}: {test['layout']} → {output}")
```

---

## Troubleshooting

### Text doesn't appear
- Check photo path exists and is readable
- Verify headline text is not empty
- Ensure fonts are available in `/assets/`

### Text looks cut off
- Try shorter headlines (3-4 words)
- Use `"Story 9:16"` format for longer text
- Check dark overlay visibility

### Colors look wrong
- Ensure RGB tuples are correct (0-255 range)
- Dark overlay gradient helps readability
- Consider photo background colors

### Positioning looks off
- Try different layout variants
- Ensure photo dimensions match expected format
- Check photo subject is in expected area

---

## Next Steps

1. **Test with real photos**: Use photographer-provided photos
2. **Refine spacing**: Adjust overlay opacity, padding if needed
3. **Create variations**: Generate 3-4 variants per photo
4. **Brand consistency**: Use `centered-header` for official announcements
5. **A/B testing**: Compare layout effectiveness with audience
