-- ============================================================
-- BRAVO — Libreria asset per cliente
-- Esegui nel SQL Editor di Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS client_assets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    text        NOT NULL,
  filename     text        NOT NULL,
  storage_path text        NOT NULL,        -- path nel bucket bravo-media
  public_url   text        NOT NULL,        -- URL pubblico Supabase Storage
  type         text        NOT NULL DEFAULT 'photo',   -- photo | video | logo | doc
  tags         text[]      NOT NULL DEFAULT '{}',      -- tag liberi es. {campo, equipo, producto}
  size_bytes   bigint,
  width        int,
  height       int,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_assets_client
  ON client_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_type
  ON client_assets(client_id, type);
CREATE INDEX IF NOT EXISTS idx_client_assets_created
  ON client_assets(created_at DESC);

ALTER TABLE client_assets DISABLE ROW LEVEL SECURITY;

-- Verifica
SELECT COUNT(*) AS righe FROM client_assets;
