TRUNCATE TABLE today_tasks, chat_messages, card_links, kanban_cards, strategy_steps, strategy_objectives, calendar_events, decisions, project_members, projects, clients, team_members, agents CASCADE;

INSERT INTO team_members (id, name, role, initials, color, status) VALUES
  ('aa000001-0000-0000-0000-000000000001', 'Diego Piedrahita', 'Director',          'DP', '#8B4513', 'on'),
  ('aa000002-0000-0000-0000-000000000002', 'Camilo Diaz',      'Sales Manager',     'CD', '#2c5f8a', 'on'),
  ('aa000003-0000-0000-0000-000000000003', 'Chema Soler',      'Tecnico Comercial', 'CS', '#D13B1E', 'on'),
  ('aa000004-0000-0000-0000-000000000004', 'Bilal Taik',       'Coordinador',       'BT', '#2d7a4f', 'on'),
  ('aa000005-0000-0000-0000-000000000005', 'Ayub Elmalki',     'Tecnico',           'AE', '#7B4FBF', 'off');

INSERT INTO clients (id, name) VALUES
  ('bb000001-0000-0000-0000-000000000001', 'DaKady S.L.'),
  ('bb000002-0000-0000-0000-000000000002', 'Samanta agrosamanta'),
  ('bb000003-0000-0000-0000-000000000003', 'Oscar Berja'),
  ('bb000004-0000-0000-0000-000000000004', 'Solis Plant');

INSERT INTO projects (id, name, client_id, progress, status, status_label, deadline, deadline_tag, deadline_class, signal, open_tasks) VALUES
  ('ai-agent',     'DAKADY AI Agent',        'bb000001-0000-0000-0000-000000000001', 65,  'warn', 'En Desarrollo', '2026-06-30', '30 jun', 'dead-warn', 'AI',  12),
  ('contenido',    'Contenido Social',       'bb000001-0000-0000-0000-000000000001', 30,  'crit', 'Activo',        '2026-04-30', '30 abr', 'dead-ok',   'SNS', 8),
  ('water-iot',    'Water Savings IoT',      'bb000002-0000-0000-0000-000000000002', 80,  'good', 'En curso',      '2026-05-15', '15 may', 'dead-ok',   'IOT', 3),
  ('trip-control', 'Control Trips Calabacin','bb000003-0000-0000-0000-000000000003', 100, 'good', 'Completado',    NULL,          NULL,     'dead-ok',   'OK',  0);

INSERT INTO project_members (project_id, member_id) VALUES
  ('ai-agent',     'aa000001-0000-0000-0000-000000000001'),
  ('ai-agent',     'aa000002-0000-0000-0000-000000000002'),
  ('contenido',    'aa000001-0000-0000-0000-000000000001'),
  ('contenido',    'aa000002-0000-0000-0000-000000000002'),
  ('contenido',    'aa000003-0000-0000-0000-000000000003'),
  ('water-iot',    'aa000002-0000-0000-0000-000000000002'),
  ('water-iot',    'aa000003-0000-0000-0000-000000000003'),
  ('trip-control', 'aa000003-0000-0000-0000-000000000003');

INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  ('ai-agent', 'info', 'Architettura sistema AI definita',         NULL,                                   'Normal', 1),
  ('ai-agent', 'info', 'Analisi sito dakady.es completata',        NULL,                                   'Normal', 2),
  ('ai-agent', 'info', 'Profilo cliente DaKady strutturato',       NULL,                                   'Normal', 3),
  ('ai-agent', 'done', 'System prompt Agente Marketing DaKady',   'aa000001-0000-0000-0000-000000000001', 'Normal', 1),
  ('ai-agent', 'done', 'Connessione Supabase backend + frontend', 'aa000001-0000-0000-0000-000000000001', 'Alta',   2),
  ('ai-agent', 'done', 'Schema database BRAVO + backend',         'aa000001-0000-0000-0000-000000000001', 'Normal', 3),
  ('ai-agent', 'done', 'Deploy GitHub monorepo BravoApp',         'aa000001-0000-0000-0000-000000000001', 'Normal', 4),
  ('ai-agent', 'todo', 'Setup n8n su Hetzner VPS',                'aa000001-0000-0000-0000-000000000001', 'Alta',   1),
  ('ai-agent', 'todo', 'Integrazione Claude API',                 'aa000001-0000-0000-0000-000000000001', 'Alta',   2),
  ('ai-agent', 'todo', 'Integrazione Ideogram API',               'aa000001-0000-0000-0000-000000000001', 'Alta',   3),
  ('ai-agent', 'todo', 'Connessione Buffer / Later',              'aa000002-0000-0000-0000-000000000002', 'Normal', 4),
  ('ai-agent', 'todo', 'Canva Connect API',                        NULL,                                   'Normal', 5),
  ('ai-agent', 'wip',  'Profili database Notion/Airtable',        'aa000002-0000-0000-0000-000000000002', 'Normal', 1),
  ('ai-agent', 'wip',  'Primo test contenuto AI live',            'aa000001-0000-0000-0000-000000000001', 'Alta',   2),
  ('contenido', 'info',  'Guia de contenido DaKady',              NULL,                                   'Normal', 1),
  ('contenido', 'info',  'Pilares: Arranque, Sostenibilidad, Verano', NULL,                               'Normal', 2),
  ('contenido', 'ideas', 'Serie Arranque protocolo BRAVERIA',     'aa000002-0000-0000-0000-000000000002', 'Alta',   1),
  ('contenido', 'ideas', 'Post -30% agua con sensores AIGRO',     'aa000002-0000-0000-0000-000000000002', 'Normal', 2),
  ('contenido', 'ideas', 'Reel Chema en campo trips calabacin',   'aa000003-0000-0000-0000-000000000003', 'Normal', 3),
  ('contenido', 'ideas', 'Carrusel protocolo sandia paso a paso', 'aa000003-0000-0000-0000-000000000003', 'Normal', 4),
  ('contenido', 'todo',  'Brief semana 15-21 abril',              'aa000001-0000-0000-0000-000000000001', 'Alta',   1),
  ('contenido', 'todo',  'Calendario mayo completo',              'aa000002-0000-0000-0000-000000000002', 'Normal', 2),
  ('contenido', 'wip',   'Post estres termico verano Sanosil',    'aa000002-0000-0000-0000-000000000002', 'Alta',   1),
  ('contenido', 'shoot', 'Rodaje campo Almeria con Chema',        'aa000003-0000-0000-0000-000000000003', 'Normal', 1),
  ('water-iot', 'info',  'Partnership AIGRO Tech Solutions',       NULL,                                   'Normal', 1),
  ('water-iot', 'info',  'Objetivo -30% agua +15% produccion',    NULL,                                   'Normal', 2),
  ('water-iot', 'wip',   'Instalacion sensores invernadero',      'aa000003-0000-0000-0000-000000000003', 'Alta',   1),
  ('water-iot', 'wip',   'Analisis suelo pre-sensor AIGRO',       'aa000002-0000-0000-0000-000000000002', 'Normal', 2),
  ('water-iot', 'done',  'Analisis agua Quimsa ITW',              'aa000003-0000-0000-0000-000000000003', 'Normal', 1),
  ('water-iot', 'done',  'Propuesta ensayo Norden Agro aprobada', 'aa000002-0000-0000-0000-000000000002', 'Normal', 2),
  ('trip-control', 'info', 'Cliente agricultor calabacin Almeria', NULL,                                  'Normal', 1),
  ('trip-control', 'done', 'Diagnostico infestacion trips',       'aa000003-0000-0000-0000-000000000003', 'Normal', 1),
  ('trip-control', 'done', 'Protocolo DaKady aplicado en campo',  'aa000003-0000-0000-0000-000000000003', 'Alta',   2),
  ('trip-control', 'done', 'Resultado hojas nuevas 100% sanas',   'aa000003-0000-0000-0000-000000000003', 'Normal', 3),
  ('trip-control', 'pub',  'Publicado Instagram 43 likes',        NULL,                                   'Normal', 1);

INSERT INTO decisions (project_id, type, action, detail, tags, created_at) VALUES
  ('ai-agent',     'green', 'Supabase conectado backend + frontend OK',     'Conexion estable. Datos reales cargando. Real-time activo.',              ARRAY['DaKady','Supabase'], now() - interval '1 hour'),
  ('ai-agent',     'green', 'GitHub monorepo BravoApp configurado',         'Backend subido. Workflow colaborativo con Bravo listo.',                  ARRAY['DaKady','GitHub'],   now() - interval '3 hours'),
  ('ai-agent',     'blue',  'System prompt Agente Marketing aprobado',      'Tono tecnico-cercano. Foco agricultores Almeria.',                        ARRAY['DaKady','AI'],       now() - interval '3 days'),
  ('contenido',    'gold',  'Brief semana 15-21 abril pendiente',           'Temas: Arranque, Sostenibilidad, Estres termico. Revisar con Diego.',     ARRAY['DaKady','Diego'],    now() - interval '1 day'),
  ('water-iot',    'green', 'Trial AIGRO -30% agua +15% produccion',       'Datos validados invernadero Poniente Almeriense.',                        ARRAY['DaKady','AIGRO'],    now() - interval '5 days'),
  ('trip-control', 'green', 'Caso trips calabacin cerrado con exito',      'Hojas nuevas 100% sanas. Cliente satisfecho.',                            ARRAY['DaKady','Chema'],    now() - interval '10 days'),
  ('contenido',    'red',   'Post plasticos viralizado 333 likes',         'Mayor engagement historico. Sin impulso pagado. Replicar formato.',       ARRAY['DaKady','Instagram'],now() - interval '15 days'),
  ('ai-agent',     'blue',  'Analisis materiales Canva dakady.es listo',   'Colores, tipografias, tono de voz y pilares documentados.',               ARRAY['DaKady','Brief'],    now() - interval '7 days');

INSERT INTO strategy_objectives (project_id, period, text, done, position) VALUES
  ('ai-agent', 'mes',  'Primer test de contenido AI en vivo con DaKady',       false, 1),
  ('ai-agent', 'mes',  'n8n + Claude API + Ideogram operativo',                false, 2),
  ('ai-agent', 'mes',  'BRAVO Centro de Mando conectado a Supabase',           true,  3),
  ('ai-agent', 'trim', 'Sistema AI generando 4 posts por semana para DaKady',  false, 1),
  ('ai-agent', 'trim', 'Integracion Buffer Later para publicacion automatica', false, 2),
  ('ai-agent', 'trim', 'Feedback loop BRAVO a AI operativo y medible',         false, 3);

INSERT INTO strategy_steps (project_id, text, meta, position) VALUES
  ('ai-agent', 'Activar VPS Hetzner + instalar n8n',           'Esta semana',    1),
  ('ai-agent', 'Conectar Claude API con system prompt DaKady', 'Esta semana',    2),
  ('ai-agent', 'Conectar Ideogram API para imagenes',          'Proxima semana', 3),
  ('ai-agent', 'Test: generar 3 posts reales y revisar',       'Proxima semana', 4),
  ('ai-agent', 'Conectar Buffer Later para scheduling',        '30 abr',         5);

INSERT INTO calendar_events (project_id, title, event_date, color_class) VALUES
  ('contenido', 'Brief semana Arranque + Sostenibilidad', '2026-04-15', 'ce-blue'),
  ('contenido', 'Brief semana Verano Estres termico',     '2026-04-22', 'ce-blue'),
  ('water-iot', 'Revision sensores campo',                '2026-04-25', 'ce-green'),
  ('contenido', 'Rodaje campo Almeria con Chema',         '2026-04-28', 'ce-gold'),
  ('ai-agent',  'Deadline n8n + APIs online',             '2026-04-30', 'ce-red'),
  ('ai-agent',  'Primer test contenido AI live',          '2026-05-05', 'ce-green'),
  (NULL,        'EFA Campomar Charla tecnica Camilo',     '2026-05-10', 'ce-blue'),
  ('ai-agent',  'Deadline integracion Buffer Later',      '2026-05-15', 'ce-red'),
  (NULL,        'Iberflora Feria ornamentales',           '2026-10-01', 'ce-gold');

INSERT INTO today_tasks (member_id, project_id, text, urgent, task_date) VALUES
  ('aa000001-0000-0000-0000-000000000001', 'ai-agent',  'Setup VPS Hetzner + instalar n8n',           true,  CURRENT_DATE),
  ('aa000001-0000-0000-0000-000000000001', 'ai-agent',  'Test Claude API con system prompt DaKady',   false, CURRENT_DATE),
  ('aa000002-0000-0000-0000-000000000002', 'contenido', 'Brief semana 15-21 abril validar con Diego', true,  CURRENT_DATE),
  ('aa000002-0000-0000-0000-000000000002', 'contenido', 'Calendario de contenido mayo',               false, CURRENT_DATE),
  ('aa000003-0000-0000-0000-000000000003', 'water-iot', 'Visita campo revision sensores AIGRO',       false, CURRENT_DATE),
  ('aa000004-0000-0000-0000-000000000004', 'contenido', 'Coordinar rodaje campo con Chema',           false, CURRENT_DATE);

INSERT INTO agents (name, type, config, active) VALUES
  ('Agente Marketing DaKady', 'marketing', '{"model":"claude-sonnet-4-6"}', false),
  ('Agente Diseno DaKady',    'designer',  '{"model":"claude-sonnet-4-6"}', false),
  ('Agente Calendario',       'calendar',  '{"model":"claude-sonnet-4-6"}', false),
  ('Agente Contenido DaKady', 'content',   '{"model":"claude-sonnet-4-6"}', false);
