-- ============================================================
-- BRAVO — Metriche post pubblicati
-- Esegui nel SQL Editor di Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS post_metrics (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    text        NOT NULL,
  content_id   text,                          -- ref a generated_content (opzionale)
  headline     text,                          -- titolo del post
  platform     text        NOT NULL DEFAULT 'instagram',
  pillar       text,                          -- PRODUCTO / AGRONOMIA / etc.
  published_at date        NOT NULL,
  likes        int         NOT NULL DEFAULT 0,
  comments     int         NOT NULL DEFAULT 0,
  reach        int         NOT NULL DEFAULT 0,
  impressions  int         NOT NULL DEFAULT 0,
  saves        int         NOT NULL DEFAULT 0,
  shares       int         NOT NULL DEFAULT 0,
  notes        text,
  source       text        NOT NULL DEFAULT 'manual',  -- manual | instagram_api
  ig_media_id  text        UNIQUE,                    -- ID post Instagram (deduplicazione sync)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_metrics_client
  ON post_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_published
  ON post_metrics(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_metrics_pillar
  ON post_metrics(client_id, pillar);

ALTER TABLE post_metrics DISABLE ROW LEVEL SECURITY;

-- Migrazione: aggiunge ig_media_id se la tabella esiste già
ALTER TABLE post_metrics ADD COLUMN IF NOT EXISTS ig_media_id text UNIQUE;

-- ============================================================
-- TABELLA 2 — REPORT ANALISI IA
-- Un report per cliente, aggiornato ogni notte dall'Analista
-- ============================================================

CREATE TABLE IF NOT EXISTS metrics_reports (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      text        NOT NULL UNIQUE,   -- un solo report attivo per cliente
  report         jsonb       NOT NULL,           -- { resumen, funciona, mejorar, ideas, pilar_top, pilar_bottom }
  posts_analyzed int         NOT NULL DEFAULT 0,
  generated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE metrics_reports DISABLE ROW LEVEL SECURITY;

-- Migrazione: aggiunge metrics_reports se non esiste già
-- (già gestita dal CREATE TABLE IF NOT EXISTS sopra)

-- Verifica
SELECT COUNT(*) AS righe FROM post_metrics;
SELECT COUNT(*) AS report FROM metrics_reports;
