-- ============================================================
-- BRAVO Multi-Agent System — Schema Supabase
-- Fase 1: infrastruttura coda + agenti
-- ============================================================
-- ISTRUZIONI:
-- 1. Apri Supabase → SQL Editor
-- 2. Incolla tutto questo file
-- 3. Clicca "Run"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELLA 1 — AGENT_TASKS
-- Coda di lavoro condivisa tra tutti gli agenti
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name     text        NOT NULL CHECK (agent_name IN ('coordinator','strategist','market_researcher','designer')),
  client_id      uuid        REFERENCES clients(id) ON DELETE CASCADE,
  payload        jsonb       NOT NULL DEFAULT '{}',
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  result         jsonb,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  completed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status
  ON agent_tasks(status, agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_client
  ON agent_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created
  ON agent_tasks(created_at DESC);

-- ============================================================
-- TABELLA 2 — MARKET_RESEARCH
-- Report di mercato per settore (condivisi tra clienti)
-- Scadenza 30 giorni — il Ricercatore riusa se ancora valido
-- ============================================================
CREATE TABLE IF NOT EXISTS market_research (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sector         text        NOT NULL,
  report         text        NOT NULL,
  keywords       text[],
  hashtags       text[],
  trends         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  valid_until    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  task_id        uuid        REFERENCES agent_tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_market_research_sector
  ON market_research(sector, valid_until DESC);

-- ============================================================
-- TABELLA 3 — EDITORIAL_PLANS
-- Piani settimanali prodotti dallo Stratega
-- Una riga = un post pianificato con brief dettagliato
-- ============================================================
CREATE TABLE IF NOT EXISTS editorial_plans (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start     date        NOT NULL,
  pillar         text        NOT NULL,
  platform       text        NOT NULL DEFAULT 'instagram',
  format         text,
  scheduled_date date,
  angle          text,
  brief          text        NOT NULL,
  status         text        NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','assigned','done','skipped')),
  task_id        uuid        REFERENCES agent_tasks(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editorial_plans_client_week
  ON editorial_plans(client_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_editorial_plans_status
  ON editorial_plans(status);

-- ============================================================
-- VERIFICA
-- ============================================================
SELECT 'agent_tasks'    AS tabella, COUNT(*) AS righe FROM agent_tasks
UNION ALL
SELECT 'market_research',            COUNT(*) FROM market_research
UNION ALL
SELECT 'editorial_plans',            COUNT(*) FROM editorial_plans;
