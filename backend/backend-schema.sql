-- ============================================================
-- DAKADY Backend — Schema Supabase
-- Tabelle per il sistema AI di generazione contenuti
-- ============================================================
-- ISTRUZIONI:
-- 1. Apri Supabase → SQL Editor
-- 2. Incolla tutto questo file
-- 3. Clicca "Run"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELLA 1 — CONTENUTI GENERATI
-- Storico di tutti i post generati dall'AI
-- ============================================================
CREATE TABLE IF NOT EXISTS generated_content (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id     text        NOT NULL UNIQUE,
  client_id      text        NOT NULL DEFAULT 'dakady',
  brief          text        NOT NULL,
  platform       text,
  pillar         text,
  format         text,
  content_type   text,
  headline       text,
  caption        text,
  visual_prompt  text,
  layout_variant text,
  agent_notes    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_content_client
  ON generated_content(client_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_created
  ON generated_content(created_at DESC);

-- ============================================================
-- TABELLA 2 — FEEDBACK
-- Approvazioni e rifiuti di BRAVO sui contenuti generati
-- ============================================================
CREATE TABLE IF NOT EXISTS content_feedback (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id       text        NOT NULL,
  client_id        text        NOT NULL DEFAULT 'dakady',
  status           text        NOT NULL CHECK (status IN ('approved','rejected','revised')),
  rejection_reason text,
  liked_aspects    text[],
  original_brief   text,
  headline         text,
  layout_variant   text,
  pillar           text,
  caption_preview  text,
  agent_notes      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_feedback_client
  ON content_feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_content_feedback_status
  ON content_feedback(status);
CREATE INDEX IF NOT EXISTS idx_content_feedback_created
  ON content_feedback(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (opzionale — abilita se usi auth)
-- ============================================================
-- ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE content_feedback   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VERIFICA
-- ============================================================
SELECT 'generated_content' AS tabella, COUNT(*) AS righe FROM generated_content
UNION ALL
SELECT 'content_feedback',              COUNT(*) FROM content_feedback;
