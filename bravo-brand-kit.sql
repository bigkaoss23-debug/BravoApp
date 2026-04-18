-- ============================================================
-- BRAVO Brand Kit — Schema + Dati reali clienti
-- Esegui nel SQL Editor di Supabase
-- ============================================================

-- 1. Tabella brand kit per cliente
CREATE TABLE IF NOT EXISTS client_brand (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    text        NOT NULL UNIQUE,  -- UUID del cliente
  colors       jsonb       NOT NULL DEFAULT '[]',
  fonts        jsonb       NOT NULL DEFAULT '[]',
  tone_of_voice text,
  pillars      jsonb       NOT NULL DEFAULT '[]',
  layouts      jsonb       NOT NULL DEFAULT '[]',
  templates    jsonb       NOT NULL DEFAULT '[]',
  notes        text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_brand_client
  ON client_brand(client_id);

ALTER TABLE client_brand DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Seed — DaKady S.L.
-- ============================================================
INSERT INTO client_brand (client_id, colors, fonts, tone_of_voice, pillars, layouts, notes)
VALUES (
  'cc000001-0000-0000-0000-000000000001',

  -- COLORES
  '[
    { "name": "Rojo DaKady",    "hex": "#D13B1E", "uso": "Acento principal, CTA, títulos" },
    { "name": "Verde campo",    "hex": "#2d5c2e", "uso": "Fondos naturales, pilares AGRONOMIA" },
    { "name": "Blanco",         "hex": "#FFFFFF", "uso": "Texto sobre fondos oscuros" },
    { "name": "Negro suave",    "hex": "#1a1a1a", "uso": "Fondos de imagen, overlays" },
    { "name": "Amarillo solar", "hex": "#F5A623", "uso": "Destacados secundarios, TECNOLOGIA" }
  ]',

  -- FUENTES
  '[
    { "name": "Bebas Neue",       "tipo": "Headline", "uso": "Titulares grandes, máximo impacto visual" },
    { "name": "Barlow Condensed", "tipo": "Subtítulo", "uso": "Subtítulos, etiquetas de pilar" },
    { "name": "IBM Plex Mono",    "tipo": "Cuerpo / datos", "uso": "Datos técnicos, porcentajes, hashtags" }
  ]',

  -- TONO DE VOZ
  'Técnico pero cercano. Habla a profesionales del invernadero con datos reales y lenguaje agrícola. Directo, sin rodeos. Primera persona del plural (nosotros). Llamadas a la acción claras.',

  -- PILARES EDITORIALES
  '[
    { "nombre": "PRODUCTO",    "pct": 25, "color": "#D13B1E", "descripcion": "Soluciones, sistemas, productos DaKady" },
    { "nombre": "AGRONOMIA",   "pct": 25, "color": "#2d5c2e", "descripcion": "Técnicas de cultivo, consejos de campo" },
    { "nombre": "EQUIPO",      "pct": 15, "color": "#2c5f8a", "descripcion": "Personas, visitas a clientes, cultura" },
    { "nombre": "TECNOLOGIA",  "pct": 15, "color": "#F5A623", "descripcion": "Innovación, sensores, automatización" },
    { "nombre": "CLIENTE",     "pct": 10, "color": "#6d4c8e", "descripcion": "Casos de éxito, testimonios" },
    { "nombre": "CALENDARIO",  "pct": 10, "color": "#555",    "descripcion": "Temporadas, ferias, eventos del sector" }
  ]',

  -- LAYOUTS PREFERIDOS
  '[
    { "name": "centered-header",   "descripcion": "Título centrado arriba, foto de fondo — ideal PRODUCTO" },
    { "name": "asymmetric-left",   "descripcion": "Texto izquierda, espacio derecho para imagen — AGRONOMIA" },
    { "name": "bottom-full",       "descripcion": "Banda de texto en la parte inferior — EQUIPO / CLIENTE" },
    { "name": "centered-with-logo","descripcion": "Logo + headline centrado — campañas y FERIAS" }
  ]',

  -- NOTAS
  'Evitar fondos blancos lisos. Siempre usar foto de campo o invernadero como fondo. El rojo DaKady (#D13B1E) debe estar presente en cada post. Hashtags fijos: #DaKady #invernadero #cultivo #almeria #agricultura'
)
ON CONFLICT (client_id) DO UPDATE SET
  colors        = EXCLUDED.colors,
  fonts         = EXCLUDED.fonts,
  tone_of_voice = EXCLUDED.tone_of_voice,
  pillars       = EXCLUDED.pillars,
  layouts       = EXCLUDED.layouts,
  notes         = EXCLUDED.notes,
  updated_at    = now();

-- ============================================================
-- 3. Seed — Altair Fitness Club (placeholder, da completare)
-- ============================================================
INSERT INTO client_brand (client_id, colors, fonts, tone_of_voice, pillars, layouts, notes)
VALUES (
  'cc000002-0000-0000-0000-000000000002',
  '[{"name": "Azul Altair", "hex": "#1a3a5c", "uso": "Color principal"}, {"name": "Naranja HYROX", "hex": "#E8640A", "uso": "Acento energético"}]',
  '[{"name": "Bebas Neue", "tipo": "Headline", "uso": "Titulares"}, {"name": "Barlow Condensed", "tipo": "Cuerpo", "uso": "Texto general"}]',
  'Motivador, directo, orientado a resultados. Comunidad HYROX y entrenamiento de alto rendimiento.',
  '[{"nombre": "ENTRENAMIENTO", "pct": 35, "color": "#1a3a5c"}, {"nombre": "NUTRICION", "pct": 25, "color": "#E8640A"}, {"nombre": "COMUNIDAD", "pct": 20, "color": "#2d7a4f"}, {"nombre": "RESULTADOS", "pct": 20, "color": "#555"}]',
  '[]',
  'Brand kit pendiente de completar con cliente.'
)
ON CONFLICT (client_id) DO UPDATE SET
  colors = EXCLUDED.colors, fonts = EXCLUDED.fonts,
  tone_of_voice = EXCLUDED.tone_of_voice, pillars = EXCLUDED.pillars,
  notes = EXCLUDED.notes, updated_at = now();

-- ============================================================
-- 4. Verifica
-- ============================================================
SELECT c.name, cb.tone_of_voice IS NOT NULL AS tiene_tono,
       jsonb_array_length(cb.colors) AS num_colores,
       jsonb_array_length(cb.fonts)  AS num_fuentes,
       jsonb_array_length(cb.pillars) AS num_pilares
FROM client_brand cb
JOIN clients c ON c.id::text = cb.client_id
ORDER BY c.name;
