-- ============================================================
-- BRAVO — Tabelle agenti e profilo cliente (schema mancante)
-- ============================================================
-- Ricostruite dall'audit del 2026-04-20.
-- Queste tabelle vengono usate dal backend ma non erano
-- versionate in nessun file .sql del repo.
--
-- Eseguire su Supabase una volta sola (idempotente).
-- ============================================================


-- ── weekly_contexts ───────────────────────────────────────────
-- Contesto settimanale del cliente (tema, appunti di campo,
-- istruzioni editoriali). Letto da tutti gli agenti.
-- Usato da: POST/GET /api/agents/weekly-context/{client_id}
CREATE TABLE IF NOT EXISTS weekly_contexts (
  client_id        text        NOT NULL,
  week_start       date        NOT NULL,
  nota_campo       text                 DEFAULT '',
  istruzioni_bravo text                 DEFAULT '',
  note_aggiuntive  text                 DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_contexts_client_week
  ON weekly_contexts(client_id, week_start DESC);

ALTER TABLE weekly_contexts DISABLE ROW LEVEL SECURITY;


-- ── client_profile ────────────────────────────────────────────
-- Profilo cliente estratto dal briefing (AI).
-- Una riga per cliente — upsert on client_id.
-- Usato da: POST/GET /api/briefing/extract-profile, /api/briefing/profile
CREATE TABLE IF NOT EXISTS client_profile (
  client_id         uuid        PRIMARY KEY,
  team_bravo        jsonb                DEFAULT '[]'::jsonb,
  key_contacts      jsonb                DEFAULT '[]'::jsonb,
  history           text                 DEFAULT '',
  objectives        jsonb                DEFAULT '[]'::jsonb,
  strategy          text                 DEFAULT '',
  editorial_pillars jsonb                DEFAULT '[]'::jsonb,
  scope             jsonb                DEFAULT '[]'::jsonb,
  out_of_scope      jsonb                DEFAULT '[]'::jsonb,
  partners          jsonb                DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_profile DISABLE ROW LEVEL SECURITY;


-- ── client_projects ───────────────────────────────────────────
-- Progetti di marketing estratti dal briefing.
-- id è una stringa tipo "a1b2c3d4_proj_1" (prefisso cliente + indice).
-- Usato da: /api/briefing/extract-projects, /api/briefing/projects
CREATE TABLE IF NOT EXISTS client_projects (
  id            text        PRIMARY KEY,
  client_id     uuid        NOT NULL,
  title         text        NOT NULL DEFAULT '',
  category      text        NOT NULL DEFAULT 'CONTENIDO',
  priority      text                 DEFAULT 'media',
  description   text                 DEFAULT '',
  deliverable   text                 DEFAULT '',
  month_target  text                 DEFAULT '',
  why           text                 DEFAULT '',
  status        text        NOT NULL DEFAULT 'propuesto',
  source        text                 DEFAULT 'manual',
  -- Campi di pianificazione (feature #1 della roadmap)
  start_date    date,
  end_date      date,
  assigned_to   text,
  budget_eur    integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_projects_client
  ON client_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_status
  ON client_projects(client_id, status);

ALTER TABLE client_projects DISABLE ROW LEVEL SECURITY;


-- ── team_tasks ────────────────────────────────────────────────
-- Task assegnati ai membri del team BRAVO (cross-cliente).
-- Una riga per membro, con array di task e clienti assegnati.
-- Letto/scritto direttamente dal frontend tramite Supabase JS.
CREATE TABLE IF NOT EXISTS team_tasks (
  member_name      text        PRIMARY KEY,
  tasks            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  assigned_clients jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_tasks DISABLE ROW LEVEL SECURITY;


-- ── Trigger updated_at condiviso ──────────────────────────────
CREATE OR REPLACE FUNCTION _bravo_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weekly_contexts_updated  ON weekly_contexts;
CREATE TRIGGER trg_weekly_contexts_updated
  BEFORE UPDATE ON weekly_contexts
  FOR EACH ROW EXECUTE FUNCTION _bravo_touch_updated_at();

DROP TRIGGER IF EXISTS trg_client_profile_updated   ON client_profile;
CREATE TRIGGER trg_client_profile_updated
  BEFORE UPDATE ON client_profile
  FOR EACH ROW EXECUTE FUNCTION _bravo_touch_updated_at();

DROP TRIGGER IF EXISTS trg_client_projects_updated  ON client_projects;
CREATE TRIGGER trg_client_projects_updated
  BEFORE UPDATE ON client_projects
  FOR EACH ROW EXECUTE FUNCTION _bravo_touch_updated_at();

DROP TRIGGER IF EXISTS trg_team_tasks_updated       ON team_tasks;
CREATE TRIGGER trg_team_tasks_updated
  BEFORE UPDATE ON team_tasks
  FOR EACH ROW EXECUTE FUNCTION _bravo_touch_updated_at();


-- ── Verifica ─────────────────────────────────────────────────
SELECT 'weekly_contexts' AS tabella, COUNT(*) AS righe FROM weekly_contexts
UNION ALL
SELECT 'client_profile',           COUNT(*)         FROM client_profile
UNION ALL
SELECT 'client_projects',          COUNT(*)         FROM client_projects
UNION ALL
SELECT 'team_tasks',               COUNT(*)         FROM team_tasks;
