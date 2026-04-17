-- ============================================================
-- BRAVO — Tabella generated_content
-- Salva i contenuti AI approvati con cleanup automatico (max 30 per cliente)
-- Esegui in Supabase → SQL Editor → Run
-- ============================================================

-- 1. Crea la tabella
CREATE TABLE IF NOT EXISTS generated_content (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     TEXT        NOT NULL,
  platform      TEXT        DEFAULT 'Instagram',
  pillar        TEXT,
  headline      TEXT,
  body          TEXT,
  caption       TEXT,
  layout_variant TEXT,
  agent_notes   TEXT,
  img_b64       TEXT,         -- JPEG base64 (nullable — solo post con foto)
  generated_by  TEXT        DEFAULT 'manual',  -- 'manual' | 'auto'
  status        TEXT        DEFAULT 'approved',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trigger: dopo ogni INSERT, mantieni solo gli ultimi 30 per client_id
CREATE OR REPLACE FUNCTION cleanup_generated_content()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM generated_content
  WHERE client_id = NEW.client_id
    AND id NOT IN (
      SELECT id
      FROM   generated_content
      WHERE  client_id = NEW.client_id
      ORDER  BY created_at DESC
      LIMIT  30
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_generated_content ON generated_content;
CREATE TRIGGER trg_cleanup_generated_content
  AFTER INSERT ON generated_content
  FOR EACH ROW EXECUTE FUNCTION cleanup_generated_content();

-- 3. Disabilita RLS (consistente con le altre tabelle BRAVO)
ALTER TABLE generated_content DISABLE ROW LEVEL SECURITY;

-- 4. Verifica
SELECT
  'generated_content' AS tabella,
  COUNT(*)            AS righe,
  rowsecurity         AS rls_attivo
FROM generated_content
LEFT JOIN pg_tables ON tablename = 'generated_content' AND schemaname = 'public'
GROUP BY rowsecurity;
