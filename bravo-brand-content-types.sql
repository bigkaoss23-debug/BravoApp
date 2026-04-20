-- ============================================================
-- BRAVO — Angoli narrativi (content_types) per ogni cliente
-- ============================================================
-- Aggiunge alla tabella client_brand UNA colonna nuova:
--
--   content_types  → lista strutturata di "tipi di post" / angoli
--                    narrativi (Trampa, Tech, Testimonio, ecc.)
--
-- Le regole di scrittura (emoji, never-do, struttura caption)
-- vengono messe nella colonna `notes` che già esiste — così
-- non duplichiamo campi.
--
-- Seed per DaKady portato dal vecchio prompts/dakady.py.
-- Eseguire una sola volta su Supabase (idempotente).
-- ============================================================


-- 1. Aggiungi la colonna se non esiste
ALTER TABLE client_brand
  ADD COLUMN IF NOT EXISTS content_types jsonb NOT NULL DEFAULT '[]'::jsonb;


-- 2. Seed DaKady — 11 tipi di post + TRAMPA
UPDATE client_brand
SET content_types = '[
  {
    "name": "Product Showcase",
    "when_to_use": "Presentar un producto DaKady (BRAVERIA, GS-PMAX, GS-CUAJE, Dinamizer, Sanosil) con imagen de campo de fondo y headline grande.",
    "tone": "Directo, orientado a resultado. Nombre producto en primer plano.",
    "example_headline": "BRAVERIA — EL ARRANQUE QUE MERECES"
  },
  {
    "name": "Serie Educativa",
    "when_to_use": "Explicar una técnica agrícola en 3-4 slides: hook → técnico → beneficios → CTA. Ideal para carosello.",
    "tone": "Técnico pero cercano al agricultor. Lenguaje agronómico sin jerga.",
    "example_headline": "CÓMO DIAGNOSTICAR EL TRIPS EN 4 PASOS"
  },
  {
    "name": "Antes / Después",
    "when_to_use": "Mostrar el efecto concreto de un tratamiento o protocolo DAKADY con dos marcos contrapuestos y etiqueta.",
    "tone": "Visual, concreto, con dato medible si es posible.",
    "example_headline": "ANTES: HOJAS MANCHADAS — DESPUÉS: CULTIVO LIMPIO"
  },
  {
    "name": "Team Human",
    "when_to_use": "Humanizar la marca mostrando a Chema, Camilo u otro técnico DaKady en primer plano con CTA personal.",
    "tone": "Cercano, humano. Primera persona. Llamada directa.",
    "example_headline": "ESCRÍBEME — CHEMA, TÉCNICO DAKADY"
  },
  {
    "name": "Slogan Bold",
    "when_to_use": "Momento institucional: frase potente del cliente o de la marca sobre fondo de campo. Headline bicolor bold.",
    "tone": "Institucional, rotundo. Poco texto, mucho peso visual.",
    "example_headline": "LÍDERES EN SOLUCIONES AGRÍCOLAS"
  },
  {
    "name": "Visita Técnica",
    "when_to_use": "Foto o vídeo del equipo DaKady en campo con un cliente o partner (AIGRO, Norden Agro, Quimsa).",
    "tone": "De reportaje — cuenta dónde, quién y por qué.",
    "example_headline": "HOY EN CAMPO CON AIGRO — SENSORES EN ACCIÓN"
  },
  {
    "name": "Testimonio",
    "when_to_use": "Cita textual del agricultor o técnico en pantalla, con subtítulos y foto de la persona.",
    "tone": "Palabras del cliente, sin edulcorar. Breve y creíble.",
    "example_headline": "«EN 15 DÍAS VI LA DIFERENCIA» — AGRICULTOR, ALMERÍA"
  },
  {
    "name": "Calendario",
    "when_to_use": "Anunciar un evento del sector (ferias, jornadas técnicas, estacionalidad del cultivo).",
    "tone": "Informativo, concreto. Fecha bien visible.",
    "example_headline": "12 DE MAYO — JORNADA TÉCNICA CON EFA CAMPOMAR"
  },
  {
    "name": "Logo Puro",
    "when_to_use": "Cierre de serie, inicio de campaña o slide puente: solo logo DaKady sobre fondo sólido o foto.",
    "tone": "Sin texto narrativo. Marca pura.",
    "example_headline": ""
  },
  {
    "name": "Tech / Innovación",
    "when_to_use": "Mostrar sensores AIGRO, sistemas de riego, productos de alta tecnología con foto del equipamiento.",
    "tone": "Profesional, técnico, orientado a dato. Aporta números si hay.",
    "example_headline": "15% MENOS AGUA — SENSORES AIGRO × DAKADY"
  },
  {
    "name": "TRAMPA",
    "when_to_use": "Post cebo: pregunta provocadora, afirmación audaz o mito del sector que abre debate en comentarios. ALTA VIRALIDAD. Usar 1-2 veces al mes como máximo.",
    "tone": "Provocador pero nunca agresivo. Pregunta directa al sector. Invita a responder en comentarios.",
    "example_headline": "¿QUIÉN TE HA DICHO QUE NECESITAS FITOSANITARIOS CADA SEMANA?"
  },
  {
    "name": "Portada Reel",
    "when_to_use": "Carátula de un vídeo/reel: headline bold + fondo campo + watermark KD. Debe invitar al play.",
    "tone": "Gancho visual y textual en una sola imagen.",
    "example_headline": "LO QUE NADIE TE CUENTA DEL CUAJE"
  }
]'::jsonb
WHERE client_id = 'cc000001-0000-0000-0000-000000000001';


-- 3. Espandi il campo notes di DaKady — regole di scrittura complete
UPDATE client_brand
SET notes = 'REGLAS VISUALES:
- Nunca fondos blancos lisos: siempre foto de campo o invernadero.
- El rojo DaKady (#D13B1E) debe estar presente en cada post.
- Watermark icono KD siempre visible.

ESTRUCTURA DE CAPTION (siempre en este orden):
  1. Hook (1 línea): afirmación audaz, dato concreto o metáfora agrícola
     Ej: "Las hojas nuevas no mienten: le hemos ganado la batalla al trip"
     Ej: "Un 15% de ahorro en agua no es magia, son datos"
  2. Contexto (1-2 líneas): quién, dónde, situación de partida
  3. Problema o insight (1-2 líneas): el reto, el peligro, el porqué
  4. Acción DAKADY (1-2 líneas): protocolo, productos, técnica aplicada
  5. Resultado (1 línea): concreto, medible si es posible
  6. CTA engagement (1 línea): pregunta al lector O keyword en comentarios
     Ej: "¿Quieres el protocolo? Escribe PROTOCOLO en comentarios"
     Ej: "¿Y tú, tienes sensores en tu invernadero? Te leemos 👇"
  7. Hashtags (4-6, sectoriales + marca)

USO DE EMOJIS (semántico, nunca decorativo):
  🌱 crecimiento / productos naturales   |  💧 agua / riego
  📊 datos / análisis                    |  🎯 objetivos / resultados
  👇 CTA comentarios                     |  📩 CTA mensaje privado
  🏁 lanzamiento                         |  🛡️ prevención / protección
  ✅ resultado positivo

HASHTAGS GEOGRÁFICOS:
  #almeria #agriculturaalmeria #invernaderosalmeria #poniente #elejido

HASHTAGS SECTOR:
  #agrotech #asesoramientotecnico #controlbiologico #sensoresagricolas
  #invernaderos #dakady #dakadygs #agricultura #cultivoecologico
  #agriculturasostenible

LO QUE NUNCA DEBES HACER:
- Lenguaje genérico o promocional vacío ("somos los mejores", "calidad insuperable")
- Jerga técnica sin explicación práctica para el agricultor
- Tono distante o académico
- Superlativos sin datos que los respalden
- Texto en inglés en el copy (solo en nombres de productos)'
WHERE client_id = 'cc000001-0000-0000-0000-000000000001';


-- 4. Verifica
SELECT c.name,
       jsonb_array_length(cb.content_types) AS num_angoli,
       length(cb.notes)                      AS lunghezza_notes
FROM client_brand cb
JOIN clients c ON c.id::text = cb.client_id
ORDER BY c.name;
