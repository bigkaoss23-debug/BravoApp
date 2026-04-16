# DaKady® Text Positioning Rules & Layout Patterns

## Overview
Based on analysis of DaKady templates, text should be positioned to:
1. **Maximize readability** over photographer-provided photos
2. **Create visual hierarchy** through size, color, and spacing
3. **Support brand consistency** with KD logo and red/orange accent colors
4. **Avoid excessive density** - leave breathing room, don't overcrowd

---

## Observed Layout Patterns

### Pattern 1: CENTERED LAYOUT (Pages 1-2, typical for lifestyle/process content)
**Best for:** Inspirational, process-focused, or landscape photography

**Text Hierarchy (top to bottom):**
1. **Logo**: KD white circle at top-center (~15-20% from top)
2. **Subtitle/Label** (Optional): Red/orange colored, medium-bold text (~30-40% from top)
   - Example: "NUEVA SERIE", "PROTOCOLO DESINFECCION"
   - Color: #FF7F50 (orange-red) or #E74C3C (red)
   - Font size: 32-40px
3. **Main Headline**: White, large, bold, centered (~45-60% from top)
   - Example: "EL TRABAJO QUE CONLLEVA UNA PLANTA"
   - Font: Bebas Neue Bold or similar
   - Font size: 48-64px
   - Can split across multiple lines (2-4 lines typical)
4. **Secondary Text/Body** (Optional): White, medium size (~65-75% from top)
   - Subtitle or extended text
   - Font size: 28-36px
   - Usually 1-2 lines max
5. **Watermark/Brand Footer**: "Dakady GreenHouse Solutions"
   - Color: White, subtle
   - Position: Bottom (~92-95% from top)
   - Font size: 16-20px
6. **Dark Overlay**: Gradient overlay covering 40-50% of lower half
   - Starts transparent at top
   - Reaches ~60-70% opacity at bottom
   - Purpose: Ensure text readability

**Technical Implementation:**
- Center all text elements horizontally
- Logo centered, positioned at 15% from top
- Main headline block centered, ~50% from top
- Apply dark gradient overlay starting at ~40% from top, darkening toward bottom
- Padding: 50-70px on sides, 100px+ top/bottom

---

### Pattern 2: ASYMMETRIC LAYOUT (Page 13, typical for team/people content)
**Best for:** Team introductions, testimonials, event coverage, person-focused content

**Text Hierarchy:**
1. **Logo**: Red/branded version at top-center (~15% from top)
   - Alternative: White version if on light background
2. **Tagline/Brand Text**: Red/orange color (~25-30% from top)
   - Font size: 32-40px
   - Centered horizontally
3. **Main Text**: Left-aligned, white color (~45-55% from top)
   - Font size: 28-36px
   - Positioned on left 30-40% of image
4. **Photo/Product**: Right side (60-70% of width)
   - Portrait or product photo
5. **Attribution**: "Att. [Name]"
   - Font size: 18-24px
   - Positioned below main text on left

**Technical Implementation:**
- Logo/tagline centered at top
- Main text block left-aligned, starts at ~45% from top
- Photo/product positioned on right side
- Dark overlay on left side only (where text is)
- Asymmetric composition with weight on right

---

### Pattern 3: PRODUCT/INFOGRAPHIC LAYOUT (Page 29)
**Best for:** Product showcases, statistics, technical information

**Text Hierarchy:**
1. **Logo**: Centered at top (~15% from top)
2. **Main Headline**: Large, centered (~25-35% from top)
3. **Bullet Points/Stats**: Centered, formatted as list (~40-70% from top)
   - Each item: Red bullet + white text
   - Font size: 24-32px per item
   - Line spacing: 20-30px between items
   - Example: "-25% PRODUCCION", "-20% MEJORA EN EL SUELO"
4. **Brand/Logo**: Secondary brand element (~75% from top)
5. **Product Image**: Bottom portion of layout

**Technical Implementation:**
- All elements centered
- Larger white space/padding around text
- Dark gradient overlay covering 30-60% of image height
- Bullet points rendered as text (not special characters necessarily)

---

## Color Palette
- **White**: #FFFFFF - Main text, headlines
- **Red/Orange**: #FF7F50 or #E74C3C - Subtitles, labels, accents
- **Black Shadow**: #1A1A1A or #000000 - Text shadow for contrast
- **Dark Overlay**: Black with 40-70% opacity

---

## Font Specifications

### Headline Font (Bebas Neue or equivalent)
- Weight: Bold (700-900)
- Size: 48-64px typical
- Line spacing: 4-8px (tight for impact)
- Tracking: 0-2px (may use slight letter spacing)

### Subtitle/Label Font (Medium weight)
- Weight: Semi-bold (600-700)
- Size: 32-40px
- Color: Red/orange (#FF7F50 or #E74C3C)

### Body/Secondary Font (Libre Franklin or equivalent)
- Weight: Regular (400-500)
- Size: 24-36px
- Line spacing: 6-10px
- Color: White or light gray

### Footer/Brand Font (Small)
- Weight: Regular (400)
- Size: 16-20px
- Color: White, subtle

---

## Layout Rules & Best Practices

### Text Density
- ❌ DON'T: Overcrowd with text
- ✅ DO: Leave 40-50% of canvas without text
- ✅ DO: Use white space strategically

### Contrast & Readability
- ❌ DON'T: Place light text on light backgrounds
- ✅ DO: Use dark overlay gradient behind text
- ✅ DO: Add subtle text shadow (offset 2px, opacity 30-40%)
- ✅ DO: Ensure minimum 60% contrast ratio

### Positioning Rules
- Logo: Always top area (10-20% from top), usually centered
- Main text: Center for centered layouts, left/right for asymmetric
- Footer: Bottom area (90-95% from top)
- Accent bars: Optional, use sparingly (8-10px height, red color)

### Alignment
- **Centered layouts**: All text horizontally centered
- **Asymmetric layouts**: Text left/right aligned based on position
- **Bullet lists**: Center the entire block, but left-align individual items

### Spacing Guidelines
- Vertical padding (top/bottom): 80-120px minimum
- Horizontal padding (left/right): 50-80px minimum
- Between text blocks: 20-40px (headline to body)
- Between lines within block: 4-10px (headlines), 6-12px (body)

---

## Implementation Strategy for Designer Agent

### New Layout Variants Needed:
1. `centered-header` - Centered headline with subtitle, no logo border
2. `centered-with-logo` - Centered layout with top logo placement
3. `asymmetric-left` - Asymmetric with text on left, photo on right
4. `product-infographic` - Product showcase with bullet points
5. `vertical-center` - Vertical centering (good for all-text slides)

### New Text Element Types:
1. **Label/Subtitle** - Red/orange color, 32-40px
2. **Headline** - White, large, 48-64px
3. **Body** - White, 24-36px
4. **Bullet List** - White with red bullets, 24-32px per item
5. **Footer/Attribution** - White, small, 16-20px

### Color Variations:
- Support dynamic color selection for labels (red, orange, brand color)
- Support dark/light overlay opacity adjustment (40-80%)

---

## Visual Examples (From Templates)

**Page 1: Centered Layout**
- KD logo top-center
- "EL TRABAJO QUE CONLLEVA UNA PLANTA" - white, centered, ~52% from top
- "SEGUIMIENTO DESDE JULIO." - orange, centered, ~62% from top
- "Dakady GreenHouse Solutions" - white footer, ~93% from top

**Page 2: Centered with Label**
- KD logo top-center
- "NUEVA SERIE" - red label, ~38% from top
- Multi-line white headline at ~50% from top
- Subtle "PRESENCIA" watermark text
- Footer brand

**Page 13: Asymmetric**
- Red DaKady logo + text top-center
- Red tagline below logo
- "Esta semana visitamos," - left side, white
- "fruit attraction" logo - left side
- Person photo - right side (60% of width)

**Page 29: Infographic**
- KD logo centered
- Red/orange title
- Bullet point list centered (5 items, each ~32px)
- "aigro" brand element
- Dark overlay with high opacity
