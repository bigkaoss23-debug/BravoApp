-- ============================================================
-- BRAVO — Centro de Mando
-- Schema Supabase completo + Seed Data
-- Versione 1.0 — Aprile 2026
-- ============================================================
-- ISTRUZIONI:
-- 1. Apri Supabase → SQL Editor
-- 2. Incolla tutto questo file
-- 3. Clicca "Run"
-- 4. Fatto — tutte le tabelle e i dati sono pronti
-- ============================================================

-- Abilita estensione UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PULIZIA (esegui solo se vuoi ripartire da zero)
-- ============================================================
DROP TABLE IF EXISTS agent_logs       CASCADE;
DROP TABLE IF EXISTS agents           CASCADE;
DROP TABLE IF EXISTS today_tasks      CASCADE;
DROP TABLE IF EXISTS chat_messages    CASCADE;
DROP TABLE IF EXISTS calendar_events  CASCADE;
DROP TABLE IF EXISTS strategy_steps   CASCADE;
DROP TABLE IF EXISTS strategy_objectives CASCADE;
DROP TABLE IF EXISTS decisions        CASCADE; 
DROP TABLE IF EXISTS card_links       CASCADE;
DROP TABLE IF EXISTS kanban_cards     CASCADE;
DROP TABLE IF EXISTS kanban_columns   CASCADE;
DROP TABLE IF EXISTS project_members  CASCADE;
DROP TABLE IF EXISTS projects         CASCADE;
DROP TABLE IF EXISTS clients          CASCADE;
DROP TABLE IF EXISTS team_members     CASCADE;

-- ============================================================
-- TABELLA 1 — TEAM MEMBERS
-- ============================================================
CREATE TABLE team_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  role       text        NOT NULL,
  initials   varchar(2)  NOT NULL,
  color      varchar(7)  NOT NULL,
  status     text        NOT NULL DEFAULT 'off'
                         CHECK (status IN ('on','away','off')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 2 — CLIENTS
-- ============================================================
CREATE TABLE clients (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 3 — PROJECTS (= CUENTAS)
-- ============================================================
CREATE TABLE projects (
  id             text        PRIMARY KEY,
  name           text        NOT NULL,
  client_id      uuid        REFERENCES clients(id),
  progress       integer     NOT NULL DEFAULT 0
                             CHECK (progress >= 0 AND progress <= 100),
  status         text        NOT NULL DEFAULT 'idle'
                             CHECK (status IN ('crit','warn','good','idle')),
  status_label   text,
  deadline       date,
  deadline_tag   text,
  deadline_class text,
  signal         text,
  open_tasks     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 4 — PROJECT MEMBERS (many-to-many)
-- ============================================================
CREATE TABLE project_members (
  project_id text REFERENCES projects(id)     ON DELETE CASCADE,
  member_id  uuid REFERENCES team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, member_id)
);

-- ============================================================
-- TABELLA 5 — KANBAN COLUMNS (9 colonne fisse)
-- ============================================================
CREATE TABLE kanban_columns (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  color_class text,
  position    integer NOT NULL
);

-- ============================================================
-- TABELLA 6 — KANBAN CARDS  ← real-time abilitato
-- ============================================================
CREATE TABLE kanban_cards (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  text        NOT NULL REFERENCES projects(id)     ON DELETE CASCADE,
  column_id   text        NOT NULL REFERENCES kanban_columns(id),
  title       text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  assigned_to uuid        REFERENCES team_members(id),
  priority    text        NOT NULL DEFAULT 'Normal'
                          CHECK (priority IN ('Alta','Normal','Baja')),
  due_date    date,
  comments    text        NOT NULL DEFAULT '',
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 7 — CARD LINKS (link Google Drive per ogni card)
-- ============================================================
CREATE TABLE card_links (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid        NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  name       text        NOT NULL DEFAULT 'Enlace',
  url        text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 8 — DECISIONS / HISTORIAL  ← real-time abilitato
-- ============================================================
CREATE TABLE decisions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text        REFERENCES projects(id),
  type       text        NOT NULL
                         CHECK (type IN ('green','red','gold','blue')),
  action     text        NOT NULL,
  detail     text,
  tags       text[]      NOT NULL DEFAULT '{}',
  created_by uuid        REFERENCES team_members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 9 — STRATEGY OBJECTIVES
-- ============================================================
CREATE TABLE strategy_objectives (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period     text        NOT NULL CHECK (period IN ('mes','trim')),
  text       text        NOT NULL,
  done       boolean     NOT NULL DEFAULT false,
  position   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 10 — STRATEGY STEPS (próximos pasos CEO)
-- ============================================================
CREATE TABLE strategy_steps (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text       text        NOT NULL,
  meta       text        NOT NULL DEFAULT 'Pendiente',
  position   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 11 — CALENDAR EVENTS
-- ============================================================
CREATE TABLE calendar_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      text        REFERENCES projects(id),
  title           text        NOT NULL,
  event_date      date        NOT NULL,
  color_class     text,
  google_event_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 12 — CHAT MESSAGES  ← real-time abilitato
-- ============================================================
CREATE TABLE chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid        REFERENCES team_members(id),
  text            text        NOT NULL,
  urgency         text        CHECK (urgency IN ('alta','media',null)),
  drive_link_name text,
  drive_link_url  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 13 — TODAY TASKS (= HOY_TAREAS)
-- ============================================================
CREATE TABLE today_tasks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid        NOT NULL REFERENCES team_members(id),
  project_id text        REFERENCES projects(id),
  task_date  date        NOT NULL DEFAULT CURRENT_DATE,
  text       text        NOT NULL,
  urgent     boolean     NOT NULL DEFAULT false,
  done       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 14 — AGENTS (pronto per Fase 3)
-- ============================================================
CREATE TABLE agents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  type        text        NOT NULL
                          CHECK (type IN ('marketing','designer','calendar','meetings','hr','content')),
  config      jsonb       NOT NULL DEFAULT '{}',
  active      boolean     NOT NULL DEFAULT false,
  last_active timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELLA 15 — AGENT LOGS
-- ============================================================
CREATE TABLE agent_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL REFERENCES agents(id),
  action_type text        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('success','error','pending')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDICI — performance sulle query più comuni
-- ============================================================
CREATE INDEX idx_kanban_cards_project   ON kanban_cards(project_id);
CREATE INDEX idx_kanban_cards_column    ON kanban_cards(column_id);
CREATE INDEX idx_kanban_cards_assigned  ON kanban_cards(assigned_to);
CREATE INDEX idx_decisions_project      ON decisions(project_id);
CREATE INDEX idx_decisions_created      ON decisions(created_at DESC);
CREATE INDEX idx_strategy_obj_project   ON strategy_objectives(project_id);
CREATE INDEX idx_strategy_steps_project ON strategy_steps(project_id);
CREATE INDEX idx_calendar_date          ON calendar_events(event_date);
CREATE INDEX idx_chat_created           ON chat_messages(created_at DESC);
CREATE INDEX idx_today_tasks_member     ON today_tasks(member_id);
CREATE INDEX idx_today_tasks_date       ON today_tasks(task_date);

-- ============================================================
-- FUNZIONE — aggiorna updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_kanban_cards_updated_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ============================================================
-- SEED DATA — Dati reali di BRAVO
-- ============================================================
-- ============================================================

-- ── TEAM MEMBERS ──────────────────────────────────────────
INSERT INTO team_members (id, name, role, initials, color, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Carlos Lage',     'Filmmaker',    'CL', '#D13B1E', 'on'),
  ('22222222-2222-2222-2222-222222222222', 'Andrea Valdivia', 'Social Media', 'AV', '#2c5f8a', 'on'),
  ('33333333-3333-3333-3333-333333333333', 'Mari Almendros',  'Disenadora',   'MA', '#2d7a4f', 'away');

-- ── CLIENTS ───────────────────────────────────────────────
INSERT INTO clients (id, name) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'Verde Fashion'),
  ('aaaa0002-0000-0000-0000-000000000002', 'Bianchi & Co'),
  ('aaaa0003-0000-0000-0000-000000000003', 'Rossi Srl'),
  ('aaaa0004-0000-0000-0000-000000000004', 'Ferretti SpA');

-- ── PROJECTS ──────────────────────────────────────────────
INSERT INTO projects (id, name, client_id, progress, status, status_label, deadline, deadline_tag, deadline_class, signal, open_tasks) VALUES
  ('ecom',    'E-commerce', 'aaaa0001-0000-0000-0000-000000000001', 32, 'crit', 'En retraso',  '2026-03-28', 'Vencido',  'dead-late', '2 dias de retraso. Sin respuesta del cliente.', 7),
  ('social',  'Social Q2',  'aaaa0002-0000-0000-0000-000000000002', 55, 'warn', 'Revision',    '2026-05-02', '33 dias',  'dead-soon', '3 contenidos en revision pendiente.', 5),
  ('rebrand', 'Rebrand',    'aaaa0003-0000-0000-0000-000000000003', 78, 'good', 'En curso',    '2026-04-15', '16 dias',  'dead-ok',   'Logo aprobado. Paleta en seleccion final.', 3),
  ('news',    'Newsletter', 'aaaa0004-0000-0000-0000-000000000004', 10, 'idle', 'Planificado', '2026-04-20', '21 dias',  'dead-ok',   'Sin responsable asignado.', 8);

-- ── PROJECT MEMBERS ───────────────────────────────────────
INSERT INTO project_members (project_id, member_id) VALUES
  ('ecom',    '11111111-1111-1111-1111-111111111111'),
  ('ecom',    '22222222-2222-2222-2222-222222222222'),
  ('ecom',    '33333333-3333-3333-3333-333333333333'),
  ('social',  '22222222-2222-2222-2222-222222222222'),
  ('social',  '33333333-3333-3333-3333-333333333333'),
  ('rebrand', '33333333-3333-3333-3333-333333333333'),
  ('rebrand', '11111111-1111-1111-1111-111111111111'),
  ('news',    '22222222-2222-2222-2222-222222222222');

-- ── KANBAN COLUMNS ────────────────────────────────────────
INSERT INTO kanban_columns (id, label, color_class, position) VALUES
  ('info',  'Info',       'tb-info',  1),
  ('ideas', 'Ideas',      'tb-ideas', 2),
  ('todo',  'Por Hacer',  'tb-todo',  3),
  ('wip',   'En Proceso', 'tb-wip',   4),
  ('done',  'Hecho',      'tb-done',  5),
  ('pub',   'Publicado',  'tb-pub',   6),
  ('meet',  'Reuniones',  'tb-meet',  7),
  ('shoot', 'Rodajes',    'tb-shoot', 8),
  ('prop',  'Propuestas', 'tb-prop',  9);

-- ── KANBAN CARDS — ECOM (Verde Fashion) ───────────────────
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  -- INFO
  ('ecom', 'info',  'Brief cliente aprobado', NULL, 'Normal', 1),
  ('ecom', 'info',  'Guia de marca v2', NULL, 'Normal', 2),
  -- IDEAS
  ('ecom', 'ideas', 'Reel de producto 15s',     '11111111-1111-1111-1111-111111111111', 'Alta',   1),
  ('ecom', 'ideas', 'Stories con countdown',    '22222222-2222-2222-2222-222222222222', 'Normal', 2),
  -- TODO
  ('ecom', 'todo',  'Fotografia de producto',   NULL,                                   'Alta',   1),
  ('ecom', 'todo',  'Copy para 5 posts',         '22222222-2222-2222-2222-222222222222', 'Normal', 2),
  ('ecom', 'todo',  'Banner web hero',           '33333333-3333-3333-3333-333333333333', 'Normal', 3),
  -- WIP
  ('ecom', 'wip',   'Video unboxing',            '11111111-1111-1111-1111-111111111111', 'Alta',   1),
  ('ecom', 'wip',   'Carrusel novedades',        '33333333-3333-3333-3333-333333333333', 'Normal', 2),
  -- DONE
  ('ecom', 'done',  'Identidad visual web',      '33333333-3333-3333-3333-333333333333', 'Normal', 1),
  -- MEET
  ('ecom', 'meet',  'Kickoff Verde Fashion',     NULL, 'Normal', 1),
  -- SHOOT
  ('ecom', 'shoot', 'Rodaje catalogo primavera', '11111111-1111-1111-1111-111111111111', 'Alta',   1),
  -- PROP
  ('ecom', 'prop',  'Propuesta reels mensuales', NULL, 'Normal', 1);

-- ── KANBAN CARDS — SOCIAL (Bianchi & Co) ─────────────────
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  -- INFO
  ('social', 'info',  'Brief Campana Q2',            NULL,                                   'Normal', 1),
  -- IDEAS
  ('social', 'ideas', 'Serie detras de camara',      '22222222-2222-2222-2222-222222222222', 'Normal', 1),
  ('social', 'ideas', 'Encuestas interactivas',      '22222222-2222-2222-2222-222222222222', 'Baja',   2),
  -- TODO
  ('social', 'todo',  'Calendario mayo',             '22222222-2222-2222-2222-222222222222', 'Alta',   1),
  ('social', 'todo',  '3 creatividades nuevas',      '33333333-3333-3333-3333-333333333333', 'Normal', 2),
  -- WIP
  ('social', 'wip',   'Post lanzamiento coleccion',  '33333333-3333-3333-3333-333333333333', 'Alta',   1),
  ('social', 'wip',   'Story secuencia x5',          '22222222-2222-2222-2222-222222222222', 'Normal', 2),
  ('social', 'wip',   'Reels testimoniales',         '11111111-1111-1111-1111-111111111111', 'Normal', 3),
  -- DONE
  ('social', 'done',  'Copy revisado marzo',         '22222222-2222-2222-2222-222222222222', 'Normal', 1),
  ('social', 'done',  'Paleta visual aprobada',      '33333333-3333-3333-3333-333333333333', 'Normal', 2),
  -- PUB
  ('social', 'pub',   'Post 28 mar Campana',         NULL,                                   'Normal', 1),
  -- MEET
  ('social', 'meet',  'Revision semanal',            NULL,                                   'Normal', 1),
  -- PROP
  ('social', 'prop',  'Propuesta influencer',        NULL,                                   'Normal', 1);

-- ── KANBAN CARDS — REBRAND (Rossi Srl) ───────────────────
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, due_date, position) VALUES
  -- INFO
  ('rebrand', 'info',  'Moodboard aprobado',          NULL,                                   'Normal', NULL,         1),
  ('rebrand', 'info',  'Briefing identidad',          NULL,                                   'Normal', NULL,         2),
  -- IDEAS
  ('rebrand', 'ideas', 'Motion logo animado',         '11111111-1111-1111-1111-111111111111', 'Normal', NULL,         1),
  -- TODO
  ('rebrand', 'todo',  'Brand guidelines PDF',        '33333333-3333-3333-3333-333333333333', 'Alta',   '2026-04-10', 1),
  ('rebrand', 'todo',  'Aplicaciones papeleria',      '33333333-3333-3333-3333-333333333333', 'Normal', NULL,         2),
  -- WIP
  ('rebrand', 'wip',   'Seleccion paleta final',      '33333333-3333-3333-3333-333333333333', 'Alta',   NULL,         1),
  -- DONE
  ('rebrand', 'done',  'Logo v3 aprobado',            '33333333-3333-3333-3333-333333333333', 'Normal', '2026-03-29', 1),
  ('rebrand', 'done',  'Tipografia definida',         '33333333-3333-3333-3333-333333333333', 'Normal', NULL,         2),
  -- MEET
  ('rebrand', 'meet',  'Presentacion brand book',     NULL,                                   'Normal', '2026-04-10', 1),
  -- SHOOT
  ('rebrand', 'shoot', 'Sesion foto corporativa',     '11111111-1111-1111-1111-111111111111', 'Alta',   '2026-04-08', 1);

-- ── KANBAN CARDS — NEWS (Ferretti SpA) ───────────────────
INSERT INTO kanban_cards (project_id, column_id, title, assigned_to, priority, position) VALUES
  -- INFO
  ('news', 'info',  'Brief Ferretti SpA',          NULL,                                   'Normal', 1),
  -- IDEAS
  ('news', 'ideas', 'Seccion novedades mes',       NULL,                                   'Normal', 1),
  -- TODO
  ('news', 'todo',  'Estructura newsletter',       NULL,                                   'Alta',   1),
  ('news', 'todo',  'Diseno plantilla',            '33333333-3333-3333-3333-333333333333', 'Normal', 2),
  ('news', 'todo',  'Copy principal',              NULL,                                   'Normal', 3),
  -- MEET
  ('news', 'meet',  'Kickoff Ferretti',            NULL,                                   'Normal', 1),
  -- PROP
  ('news', 'prop',  'Propuesta frecuencia mensual', NULL,                                  'Normal', 1);

-- ── DECISIONS / HISTORIAL ─────────────────────────────────
INSERT INTO decisions (project_id, type, action, detail, tags, created_at) VALUES
  ('rebrand', 'green', 'Logo Rossi Srl aprobado',
   'Cliente satisfecho, avance al 78%. Se notifico al equipo.',
   ARRAY['Rossi Srl','Lucia F.'], now() - interval '1 day' - interval '9 hours' + interval '38 minutes'),

  ('social',  'blue',  'Notificacion enviada a Bianchi & Co',
   'Recordatorio de aprobacion pendiente del brief Q2 v2.',
   ARRAY['Bianchi & Co','Sara M.'], now() - interval '1 day' - interval '12 hours' + interval '55 minutes'),

  ('news',    'gold',  'Revision solicitada — Copy Newsletter',
   'Tono demasiado formal. Se pidio ajuste al equipo creativo.',
   ARRAY['Ferretti SpA'], now() - interval '19 days' + interval '16 hours' + interval '40 minutes'),

  ('ecom',    'red',   'Escalacion — Paleta Colores retrasada',
   'Verde Fashion sin respuesta en 3 dias. Escalado a direccion.',
   ARRAY['Verde Fashion','Marco R.'], now() - interval '20 days' + interval '9 hours' + interval '15 minutes'),

  ('social',  'green', 'Brief Campana Q2 aprobado',
   'Aprobado con observaciones menores. Equipo informado.',
   ARRAY['Bianchi & Co','Sara M.'], now() - interval '21 days' + interval '17 hours' + interval '30 minutes'),

  ('news',    'blue',  'Reunion de kickoff confirmada',
   'Kickoff Newsletter Abril con Ferretti SpA el 1 de abril.',
   ARRAY['Ferretti SpA'], now() - interval '22 days' + interval '10 hours'),

  ('social',  'gold',  'Fecha limite desplazada — Social Q2',
   'Movida de 25 abr a 2 may por peticion del cliente.',
   ARRAY['Bianchi & Co'], now() - interval '23 days' + interval '15 hours' + interval '20 minutes'),

  ('rebrand', 'green', 'Moodboard Rossi Srl aprobado',
   'Primera entrega aprobada sin cambios. Excelente trabajo.',
   ARRAY['Rossi Srl','Lucia F.'], now() - interval '29 days' + interval '13 hours');

-- ── STRATEGY OBJECTIVES — ECOM ────────────────────────────
INSERT INTO strategy_objectives (project_id, period, text, done, position) VALUES
  ('ecom', 'mes',  'Recuperar retraso y entregar v1 del sitio',          false, 1),
  ('ecom', 'mes',  'Conseguir respuesta de Verde Fashion esta semana',   false, 2),
  ('ecom', 'mes',  'Definir paleta de colores definitiva',               true,  3),
  ('ecom', 'trim', 'Lanzamiento del e-commerce en Q2',                  false, 1),
  ('ecom', 'trim', 'Integrar pasarela de pago y logistica',             false, 2),
  ('ecom', 'trim', 'Campana de lanzamiento coordinada con Social',      false, 3);

-- ── STRATEGY OBJECTIVES — SOCIAL ─────────────────────────
INSERT INTO strategy_objectives (project_id, period, text, done, position) VALUES
  ('social', 'mes',  'Aprobar brief Q2 con Bianchi & Co',               false, 1),
  ('social', 'mes',  'Publicar 12 piezas de contenido en abril',        false, 2),
  ('social', 'mes',  'Cerrar propuesta influencer',                     false, 3),
  ('social', 'trim', 'Posicionar a Bianchi & Co como referente en IG',  false, 1),
  ('social', 'trim', 'Alcanzar 10k seguidores para el cliente',         false, 2),
  ('social', 'trim', 'Renovar contrato por segundo semestre',           false, 3);

-- ── STRATEGY OBJECTIVES — REBRAND ────────────────────────
INSERT INTO strategy_objectives (project_id, period, text, done, position) VALUES
  ('rebrand', 'mes',  'Entregar brand guidelines completas',            false, 1),
  ('rebrand', 'mes',  'Obtener aprobacion final de paleta',             false, 2),
  ('rebrand', 'mes',  'Sesion fotografica corporativa completada',      false, 3),
  ('rebrand', 'trim', 'Rebrand completo entregado para 15 abril',       false, 1),
  ('rebrand', 'trim', 'Aplicar nueva identidad en todos los materiales',false, 2),
  ('rebrand', 'trim', 'Presentar resultados y proponer siguiente proyecto', false, 3);

-- ── STRATEGY OBJECTIVES — NEWS ────────────────────────────
INSERT INTO strategy_objectives (project_id, period, text, done, position) VALUES
  ('news', 'mes',  'Asignar responsable del proyecto — urgente',        false, 1),
  ('news', 'mes',  'Cerrar brief con Ferretti SpA',                     false, 2),
  ('news', 'mes',  'Disenar plantilla base de newsletter',              false, 3),
  ('news', 'trim', 'Establecer newsletter mensual recurrente',          false, 1),
  ('news', 'trim', 'Conseguir 30% de open rate en primeros 3 envios',  false, 2);

-- ── STRATEGY STEPS (próximos pasos CEO) ──────────────────
INSERT INTO strategy_steps (project_id, text, meta, position) VALUES
  ('ecom',    'Llamada directa con Verde Fashion — urgente',         'Esta semana - CEO',           1),
  ('ecom',    'Replantear cronograma con el equipo',                 'Lunes 31 mar - Reunion',      2),
  ('ecom',    'Decidir si ampliar equipo para recuperar tiempo',     'Decision pendiente',           3),

  ('social',  'Presentar propuesta influencer en reunion semanal',   'Lun 31 mar - CEO + Andrea',   1),
  ('social',  'Revisar KPIs de marzo antes del brief Q2',            'Esta semana',                  2),

  ('rebrand', 'Confirmar fecha sesion fotografica 8 abril',          '8 abr - Carlos + cliente',    1),
  ('rebrand', 'Preparar propuesta de continuidad post-rebrand',      'Antes de entrega final',       2),

  ('news',    'Asignar responsable hoy mismo',                       'Urgente - CEO',                1),
  ('news',    'Reunion kickoff con Ferretti SpA confirmada',         '1 abr 10:00',                  2);

-- ── CALENDAR EVENTS ───────────────────────────────────────
INSERT INTO calendar_events (project_id, title, event_date, color_class) VALUES
  ('news',    'Kickoff Newsletter',   '2026-04-02', 'ce-blue'),
  ('ecom',    'Paleta Colores',       '2026-04-04', 'ce-gold'),
  ('rebrand', 'Brand Guidelines',    '2026-04-10', 'ce-green'),
  ('rebrand', 'Rebrand Rossi',       '2026-04-15', 'ce-red'),
  ('news',    'Newsletter Ferretti', '2026-04-20', 'ce-gold'),
  ('social',  'Revision Social Q2',  '2026-04-22', 'ce-blue'),
  ('social',  'Campana Social Q2',   '2026-05-02', 'ce-red');

-- ── CHAT MESSAGES ─────────────────────────────────────────
INSERT INTO chat_messages (author_id, text, urgency, drive_link_name, drive_link_url, created_at) VALUES
  ('22222222-2222-2222-2222-222222222222',
   'Buenos dias equipo! Acabo de subir el calendario de mayo a Drive.',
   NULL, 'Calendario Mayo Social', 'https://drive.google.com/example',
   now() - interval '6 hours' + interval '15 minutes'),

  ('11111111-1111-1111-1111-111111111111',
   'Perfecto. El rodaje del catalogo esta confirmado para el 2 de abril.',
   'alta', NULL, NULL,
   now() - interval '6 hours' + interval '22 minutes'),

  ('33333333-3333-3333-3333-333333333333',
   'Ya tengo lista la paleta final de Rossi. Andrea, puedes revisar que encaje con el social?',
   NULL, NULL, NULL,
   now() - interval '6 hours' + interval '31 minutes'),

  ('22222222-2222-2222-2222-222222222222',
   'Claro, lo miro ahora mismo.',
   NULL, NULL, NULL,
   now() - interval '6 hours' + interval '34 minutes');

-- ── TODAY TASKS (HOY_TAREAS) ──────────────────────────────
INSERT INTO today_tasks (member_id, project_id, text, urgent, task_date) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ecom',    'Rodaje catalogo primavera — Verde Fashion', true,  CURRENT_DATE),
  ('11111111-1111-1111-1111-111111111111', 'rebrand', 'Motion logo Rossi — storyboard',            false, CURRENT_DATE),
  ('22222222-2222-2222-2222-222222222222', 'social',  'Calendario mayo — Bianchi & Co',            true,  CURRENT_DATE),
  ('22222222-2222-2222-2222-222222222222', 'social',  'Revisar copy Q2',                           false, CURRENT_DATE),
  ('22222222-2222-2222-2222-222222222222', 'news',    'Confirmar kickoff Ferretti',                 false, CURRENT_DATE),
  ('33333333-3333-3333-3333-333333333333', 'rebrand', 'Paleta final Rossi — URGENTE',              true,  CURRENT_DATE),
  ('33333333-3333-3333-3333-333333333333', 'social',  '3 creatividades Bianchi',                   false, CURRENT_DATE);

-- ── AGENTS (placeholder per Fase 3) ──────────────────────
INSERT INTO agents (name, type, config, active) VALUES
  ('Agente Marketing',  'marketing', '{"model":"claude-3-5-sonnet","version":"1.0"}', false),
  ('Agente Designer',   'designer',  '{"model":"claude-3-5-sonnet","version":"1.0"}', false),
  ('Agente Calendario', 'calendar',  '{"model":"claude-3-5-sonnet","version":"1.0"}', false),
  ('Agente Riunioni',   'meetings',  '{"model":"claude-3-5-sonnet","version":"1.0"}', false),
  ('Agente Personale',  'hr',        '{"model":"claude-3-5-sonnet","version":"1.0"}', false);

-- ============================================================
-- ABILITA REAL-TIME sulle tabelle chiave
-- (da eseguire anche in Supabase → Database → Replication)
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE kanban_cards;
-- ALTER PUBLICATION supabase_realtime ADD TABLE decisions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE projects;
-- ALTER PUBLICATION supabase_realtime ADD TABLE today_tasks;

-- ============================================================
-- VERIFICA FINALE — controlla che tutto sia andato bene
-- ============================================================
SELECT 'team_members'        AS tabella, COUNT(*) AS righe FROM team_members
UNION ALL
SELECT 'clients',              COUNT(*) FROM clients
UNION ALL
SELECT 'projects',             COUNT(*) FROM projects
UNION ALL
SELECT 'project_members',      COUNT(*) FROM project_members
UNION ALL
SELECT 'kanban_columns',       COUNT(*) FROM kanban_columns
UNION ALL
SELECT 'kanban_cards',         COUNT(*) FROM kanban_cards
UNION ALL
SELECT 'decisions',            COUNT(*) FROM decisions
UNION ALL
SELECT 'strategy_objectives',  COUNT(*) FROM strategy_objectives
UNION ALL
SELECT 'strategy_steps',       COUNT(*) FROM strategy_steps
UNION ALL
SELECT 'calendar_events',      COUNT(*) FROM calendar_events
UNION ALL
SELECT 'chat_messages',        COUNT(*) FROM chat_messages
UNION ALL
SELECT 'today_tasks',          COUNT(*) FROM today_tasks
UNION ALL
SELECT 'agents',               COUNT(*) FROM agents
ORDER BY tabella;

-- ============================================================
-- FINE SCRIPT
-- Risultato atteso:
-- agents               5
-- calendar_events      7
-- chat_messages        4
-- clients              4
-- decisions            8
-- kanban_cards        43
-- kanban_columns       9
-- project_members      8
-- projects             4
-- strategy_objectives 20
-- strategy_steps       9
-- team_members         3
-- today_tasks          7
-- ============================================================
