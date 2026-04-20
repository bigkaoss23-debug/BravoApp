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

-- Migrazioni per tabelle esistenti
ALTER TABLE post_metrics ADD COLUMN IF NOT EXISTS ig_media_id text UNIQUE;
ALTER TABLE metrics_monthly ADD COLUMN IF NOT EXISTS comment_insights jsonb;

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

-- ============================================================
-- TABELLA 3 — SNAPSHOT MENSILI
-- Aggregati per mese per confronti storici (fino a 12 mesi)
-- Generata automaticamente dal worker ogni notte
-- ============================================================

CREATE TABLE IF NOT EXISTS metrics_monthly (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    text        NOT NULL,
  month        text        NOT NULL,             -- formato YYYY-MM (es. 2025-10)
  total_posts  int         NOT NULL DEFAULT 0,
  avg_likes    numeric(8,1) NOT NULL DEFAULT 0,
  avg_reach    numeric(10,1) NOT NULL DEFAULT 0,
  avg_saves    numeric(8,1) NOT NULL DEFAULT 0,
  avg_comments numeric(8,1) NOT NULL DEFAULT 0,
  by_pillar        jsonb,                        -- { "TECNOLOGIA": { posts, avg_reach }, ... }
  by_platform      jsonb,                        -- { "instagram": { posts, avg_reach }, ... }
  comment_insights jsonb,                        -- temi, tono, keywords estratti dai commenti del mese
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, month)
);

CREATE INDEX IF NOT EXISTS idx_metrics_monthly_client
  ON metrics_monthly(client_id, month DESC);

ALTER TABLE metrics_monthly DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABELLA 4 — COMMENTI POST
-- Scaricati dall'API Instagram, analizzati dall'Analista
-- ============================================================

CREATE TABLE IF NOT EXISTS post_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    text        NOT NULL,
  ig_media_id  text        NOT NULL,             -- post a cui appartiene
  ig_comment_id text       NOT NULL UNIQUE,      -- deduplicazione
  text         text        NOT NULL,
  timestamp    timestamptz,
  synced_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_client
  ON post_comments(client_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_media
  ON post_comments(ig_media_id);

ALTER TABLE post_comments DISABLE ROW LEVEL SECURITY;

-- Verifica
SELECT COUNT(*) AS righe FROM post_metrics;
SELECT COUNT(*) AS report FROM metrics_reports;
SELECT COUNT(*) AS snapshot FROM metrics_monthly;
SELECT COUNT(*) AS commenti FROM post_comments;
