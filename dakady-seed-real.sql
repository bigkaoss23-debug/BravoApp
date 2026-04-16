-- ============================================================
-- DAKADY — Dati Reali
-- Sostituisce tutti i dati esempio con dati reali DaKady S.L.
-- Esegui su Supabase → SQL Editor → Run
-- ============================================================

-- 1. SVUOTA dati esempio (mantiene struttura e kanban_columns)
TRUNCATE TABLE
  today_tasks, chat_messages, card_links, kanban_cards,
  strategy_steps, strategy_objectives, calendar_events,
  decisions, project_members, projects, clients,
  team_members, agents
CASCADE;

-- ============================================================
-- TEAM MEMBERS — Equipo DaKady
-- ============================================================
INSERT INTO team_members (id, name, role, initials, color, status) VALUES
  ('aa000001-0000-0000-0000-000000000001', 'Diego Piedrahita', 'Director',           'DP', '#8B4513', 'on'),
  ('aa000002-0000-0000-0000-000000000002', 'Camilo Diaz',      'Sales Manager',      'CD', '#2c5f8a', 'on'),
  ('aa000003-0000-0000-0000-000000000003', 'Chema Soler',      'Técnico Comercial',  'CS', '#D13B1E', 'on'),
  ('aa000004-0000-0000-0000-000000000004', 'Bilal Taik',       'Coordinador',        'BT', '#2d7a4f', 'on'),
  ('aa000005-0000-0000-0000-000000000005', 'Ayub Elmalki',     'Técnico',            'AE', '#7B4FBF', 'off');

-- ============================================================
-- CLIENTS — Clientes DaKady
-- ============================================================
INSERT INTO clients (id, name) VALUES
  ('bb000001-0000-0000-0000-000000000001', 'DaKady S.L.'),
  ('bb000002-0000-0000-0000-000000000002', 'Samanta (@agrosamanta_)'),
  ('bb000003-0000-0000-0000-000000000003', 'Oscar — Berja'),
  ('bb000004-0000-0000-0000-000000000004', 'Solis Plant (@solisplant)');

-- ============================================================
-- PROJECTS — Proyectos activos
-- ============================================================
INSERT INTO projects (id, name, client_id, progress, status, status_label, deadline, deadline_tag, deadline_class, signal, open_tasks) VALUES
  ('ai-agent',
   'DAKADY AI Agent',
   'bb000001-0000-0000-0000-000000000001',
   65, 'warn', 'En Desarrollo', '2026-06-30', '30 jun', 'dead-warn', '⚙️', 12),

  ('contenido',
   'Contenido Social',
   'bb000001-0000-0000-0000-000000000001',
   30, 'crit', 'Activo', '2026-04-30', '30 abr', 'dead-ok', '📱', 8),

  ('water-iot',
   'Water Savings IoT',
   'bb000002-0000-0000-0000-000000000002',
   80, 'good', 'En curso', '2026-05-15', '15 may', 'dead-ok', '💧', 3),

  ('trip-control',
   'Control Trips Calabacín',
   'bb000003-0000-0000-0000-000000000003',
   100, 'good', 'Completado', NULL, NULL, 'dead-ok', '✅', 0);

-- ============================================================
-- PROJECT MEMBERS
-- ============================================================
INSERT INTO project_members (project_id, member_id) VALUES
  ('ai-agent',     'aa000001-0000-0000-0000-000000000001'),
  ('ai-agent',     'aa000002-0000-0000-0000-000000000002'),
  ('contenido',    'aa000001-0000-0000-0000-000000000001'),
  ('contenido',    'aa000002-0000-0000-0000-000000000002'),
  ('contenido',    'aa000003-0000-0000-0000-000000000003'),
  ('water-iot',    'aa000002-0000-0000-0000-000000000002'),
  ('water-iot',    'aa000003-0000-0000-0000-000000000003'),
  ('trip-control', 'aa000003-0000-0000-0000-000000000003');

-- ============================================================
-- KANBAN CARDS — AI AGENT
-- ============================================================
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  -- INFO (documentazione di progetto)
  ('ai-agent', 'info', 'Architettura sistema AI definita',               NULL,                                   'Normal', 1),
  ('ai-agent', 'info', 'Analisi sito dakady.es completata',              NULL,                                   'Normal', 2),
  ('ai-agent', 'info', 'Profilo cliente DaKady strutturato',             NULL,                                   'Normal', 3),
  -- DONE (completati)
  ('ai-agent', 'done', 'System prompt Agente Marketing DaKady',         'aa000001-0000-0000-0000-000000000001', 'Normal', 1),
  ('ai-agent', 'done', 'Connessione Supabase backend + frontend',       'aa000001-0000-0000-0000-000000000001', 'Alta',   2),
  ('ai-agent', 'done', 'Schema database BRAVO + backend',               'aa000001-0000-0000-0000-000000000001', 'Normal', 3),
  ('ai-agent', 'done', 'Deploy GitHub monorepo (BravoApp)',             'aa000001-0000-0000-0000-000000000001', 'Normal', 4),
  -- TODO (da fare)
  ('ai-agent', 'todo', 'Setup n8n su Hetzner VPS',                      'aa000001-0000-0000-0000-000000000001', 'Alta',   1),
  ('ai-agent', 'todo', 'Integrazione Claude API (Anthropic)',           'aa000001-0000-0000-0000-000000000001', 'Alta',   2),
  ('ai-agent', 'todo', 'Integrazione Ideogram API (immagini)',          'aa000001-0000-0000-0000-000000000001', 'Alta',   3),
  ('ai-agent', 'todo', 'Connessione Buffer / Later (scheduling)',       'aa000002-0000-0000-0000-000000000002', 'Normal', 4),
  ('ai-agent', 'todo', 'Canva Connect API',                             NULL,                                   'Normal', 5),
  -- WIP (in corso)
  ('ai-agent', 'wip',  'Profili database clienti (Notion/Airtable)',    'aa000002-0000-0000-0000-000000000002', 'Normal', 1),
  ('ai-agent', 'wip',  'Primo test contenuto AI live',                  'aa000001-0000-0000-0000-000000000001', 'Alta',   2);

-- ============================================================
-- KANBAN CARDS — CONTENIDO SOCIAL
-- ============================================================
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  -- INFO
  ('contenido', 'info',  'Guía de contenido DaKady — tono y pilares',           NULL,                                   'Normal', 1),
  ('contenido', 'info',  'Pilares: Arranque · Sostenibilidad · Verano',          NULL,                                   'Normal', 2),
  -- IDEAS
  ('contenido', 'ideas', 'Serie: Arranque — protocolo BRAVERIA paso a paso',    'aa000002-0000-0000-0000-000000000002', 'Alta',   1),
  ('contenido', 'ideas', 'Post: -30% agua con sensores AIGRO (caso real)',       'aa000002-0000-0000-0000-000000000002', 'Normal', 2),
  ('contenido', 'ideas', 'Reel: Chema en campo — control trips calabacín',       'aa000003-0000-0000-0000-000000000003', 'Normal', 3),
  ('contenido', 'ideas', 'Carrusel: protocolo sandía — arranque a cuajado',      'aa000003-0000-0000-0000-000000000003', 'Normal', 4),
  -- TODO
  ('contenido', 'todo',  'Brief semana 15-21 abril (Arranque + Sostenibilidad)', 'aa000001-0000-0000-0000-000000000001', 'Alta',   1),
  ('contenido', 'todo',  'Calendario mayo completo',                             'aa000002-0000-0000-0000-000000000002', 'Normal', 2),
  -- WIP
  ('contenido', 'wip',   'Post estrés térmico — preparación verano (Sanosil)',  'aa000002-0000-0000-0000-000000000002', 'Alta',   1),
  -- SHOOT
  ('contenido', 'shoot', 'Rodaje campo Almería con Chema',                       'aa000003-0000-0000-0000-000000000003', 'Normal', 1);

-- ============================================================
-- KANBAN CARDS — WATER SAVINGS IOT
-- ============================================================
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  ('water-iot', 'info',  'Partnership AIGRO Tech Solutions activo',              NULL,                                   'Normal', 1),
  ('water-iot', 'info',  'Objetivo: -30% agua, +15% producción',                NULL,                                   'Normal', 2),
  ('water-iot', 'wip',   'Instalación sensores — invernadero Poniente',          'aa000003-0000-0000-0000-000000000003', 'Alta',   1),
  ('water-iot', 'wip',   'Análisis suelo pre-sensor (María / AIGRO)',            'aa000002-0000-0000-0000-000000000002', 'Normal', 2),
  ('water-iot', 'done',  'Análisis agua Quimsa ITW (Luis)',                      'aa000003-0000-0000-0000-000000000003', 'Normal', 1),
  ('water-iot', 'done',  'Propuesta ensayo con Norden Agro aprobada',            'aa000002-0000-0000-0000-000000000002', 'Normal', 2);

-- ============================================================
-- KANBAN CARDS — TRIP CONTROL (caso cerrado)
-- ============================================================
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  ('trip-control', 'info', 'Cliente: agricultor calabacín — Almería',            NULL,                                   'Normal', 1),
  ('trip-control', 'done', 'Diagnóstico: infestación fuerte de trips',           'aa000003-0000-0000-0000-000000000003', 'Normal', 1),
  ('trip-control', 'done', 'Protocolo DaKady aplicado en campo',                 'aa000003-0000-0000-0000-000000000003', 'Alta',   2),
  ('trip-control', 'done', 'Resultado: hojas nuevas 100% sanas',                 'aa000003-0000-0000-0000-000000000003', 'Normal', 3),
  ('trip-control', 'pub',  'Publicado en Instagram — 43 likes, 1 comentario',   NULL,                                   'Normal', 1);

-- ============================================================
-- DECISIONS / HISTORIAL
-- ============================================================
INSERT INTO decisions (project_id, type, action, detail, tags, created_at) VALUES
  ('ai-agent', 'green',
   'Supabase conectado — backend + frontend operativo',
   'Conexión estable. Datos reales cargando. Real-time activo en decisiones y kanban.',
   ARRAY['DaKady', 'Supabase', 'BRAVO'], now() - interval '1 hour'),

  ('ai-agent', 'green',
   'GitHub monorepo BravoApp configurado',
   'Backend subido a /backend. Workflow colaborativo con Bravo listo.',
   ARRAY['DaKady', 'GitHub'], now() - interval '3 hours'),

  ('ai-agent', 'blue',
   'System prompt Agente Marketing DaKady aprobado',
   'Tono técnico-cercano. Foco agricultores Almería. Listo para pruebas con Claude API.',
   ARRAY['DaKady', 'AI', 'Marketing'], now() - interval '3 days'),

  ('contenido', 'gold',
   'Brief semana 15-21 abril pendiente de validación',
   'Temas: Arranque, Sostenibilidad, Estrés térmico verano. Revisar con Diego Piedrahita.',
   ARRAY['DaKady', 'Contenido', 'Diego'], now() - interval '1 day'),

  ('water-iot', 'green',
   'Trial AIGRO: -30% agua, +15% producción confirmados',
   'Datos validados en invernadero Poniente Almeriense. Publicar caso estudio.',
   ARRAY['DaKady', 'AIGRO', 'IoT', 'Samanta'], now() - interval '5 days'),

  ('trip-control', 'green',
   'Caso trips calabacín cerrado con éxito',
   'Hojas nuevas completamente sanas tras protocolo DaKady. Cliente satisfecho. Documentado para contenido.',
   ARRAY['DaKady', 'Chema', 'Calabacín'], now() - interval '10 days'),

  ('contenido', 'red',
   'Post "plásticos" viralizado — 333 likes',
   'Mayor engagement histórico del canal. Sin impulso pagado. Replicar formato.',
   ARRAY['DaKady', 'Instagram', 'Viral'], now() - interval '15 days'),

  ('ai-agent', 'blue',
   'Análisis materiales Canva + dakady.es completado',
   'Colores, tipografías, tono de voz y pilares de contenido documentados en el brief.',
   ARRAY['DaKady', 'Diseño', 'Brief'], now() - interval '7 days');

-- ============================================================
-- STRATEGY OBJECTIVES — AI AGENT
-- ============================================================
INSERT INTO strategy_objectives (project_id, period, text, done, position) VALUES
  ('ai-agent', 'mes',  'Primer test de contenido AI en vivo con DaKady',             false, 1),
  ('ai-agent', 'mes',  'n8n + Claude API + Ideogram completamente operativo',        false, 2),
  ('ai-agent', 'mes',  'BRAVO Centro de Mando conectado a Supabase',                 true,  3),
  ('ai-agent', 'trim', 'Sistema AI generando 4 posts/semana para DaKady',            false, 1),
  ('ai-agent', 'trim', 'Integración Buffer/Later para publicación automática',       false, 2),
  ('ai-agent', 'trim', 'Feedback loop BRAVO → AI operativo y medible',               false, 3);

INSERT INTO strategy_steps (project_id, text, meta, position) VALUES
  ('ai-agent', 'Activar VPS Hetzner + instalar n8n',            'Esta semana',    1),
  ('ai-agent', 'Conectar Claude API con system prompt DaKady',  'Esta semana',    2),
  ('ai-agent', 'Conectar Ideogram API para imágenes',           'Próxima semana', 3),
  ('ai-agent', 'Test: generar 3 posts reales y revisar calidad','Próxima semana', 4),
  ('ai-agent', 'Conectar Buffer / Later para scheduling',       '30 abr',         5);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
INSERT INTO calendar_events (project_id, title, event_date, color_class) VALUES
  ('contenido',    'Brief semana — Arranque + Sostenibilidad',    '2026-04-15', 'ce-blue'),
  ('contenido',    'Brief semana — Verano / Estrés térmico',      '2026-04-22', 'ce-blue'),
  ('water-iot',    'Revisión instalación sensores — campo',       '2026-04-25', 'ce-green'),
  ('contenido',    'Rodaje campo Almería — Chema',                '2026-04-28', 'ce-gold'),
  ('ai-agent',     'Deadline: n8n + APIs online',                 '2026-04-30', 'ce-red'),
  ('ai-agent',     'Primer test contenuto AI live',               '2026-05-05', 'ce-green'),
  (NULL,           'EFA Campomar — Charla técnica (Camilo)',      '2026-05-10', 'ce-blue'),
  ('ai-agent',     'Deadline: integración Buffer / Later',        '2026-05-15', 'ce-red'),
  (NULL,           'Iberflora — Feria ornamentales',              '2026-10-01', 'ce-gold');

-- ============================================================
-- TODAY TASKS — Hoy toca
-- ============================================================
INSERT INTO today_tasks (member_id, project_id, text, urgent, task_date) VALUES
  ('aa000001-0000-0000-0000-000000000001', 'ai-agent',  'Setup VPS Hetzner + instalar n8n',              true,  CURRENT_DATE),
  ('aa000001-0000-0000-0000-000000000001', 'ai-agent',  'Test Claude API con system prompt DaKady',      false, CURRENT_DATE),
  ('aa000002-0000-0000-0000-000000000002', 'contenido', 'Brief semana 15-21 abril — validar con Diego',  true,  CURRENT_DATE),
  ('aa000002-0000-0000-0000-000000000002', 'contenido', 'Calendario de contenido mayo',                  false, CURRENT_DATE),
  ('aa000003-0000-0000-0000-000000000003', 'water-iot', 'Visita campo — revisión sensores AIGRO',        false, CURRENT_DATE),
  ('aa000004-0000-0000-0000-000000000004', 'contenido', 'Coordinar rodaje campo con Chema',              false, CURRENT_DATE);

-- ============================================================
-- AGENTS — placeholder Fase 3
-- ============================================================
INSERT INTO agents (name, type, config, active) VALUES
  ('Agente Marketing DaKady',  'marketing', '{"model":"claude-sonnet-4-6","client":"dakady"}', false),
  ('Agente Diseño DaKady',     'designer',  '{"model":"claude-sonnet-4-6","client":"dakady"}', false),
  ('Agente Calendario',        'calendar',  '{"model":"claude-sonnet-4-6","client":"dakady"}', false),
  ('Agente Contenido DaKady',  'content',   '{"model":"claude-sonnet-4-6","client":"dakady"}', false);

-- ============================================================
-- VERIFICA FINALE
-- ============================================================
SELECT 'team_members'    AS tabella, COUNT(*) AS righe FROM team_members
UNION ALL SELECT 'clients',          COUNT(*) FROM clients
UNION ALL SELECT 'projects',         COUNT(*) FROM projects
UNION ALL SELECT 'kanban_cards',     COUNT(*) FROM kanban_cards
UNION ALL SELECT 'decisions',        COUNT(*) FROM decisions
UNION ALL SELECT 'calendar_events',  COUNT(*) FROM calendar_events
UNION ALL SELECT 'today_tasks',      COUNT(*) FROM today_tasks
UNION ALL SELECT 'agents',           COUNT(*) FROM agents;
