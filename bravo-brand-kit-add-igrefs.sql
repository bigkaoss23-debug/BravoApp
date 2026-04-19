-- ============================================================
-- BRAVO Brand Kit — Aggiunta colonna ig_refs_b64
-- Esegui nel SQL Editor di Supabase UNA SOLA VOLTA
-- ============================================================

ALTER TABLE client_brand
  ADD COLUMN IF NOT EXISTS ig_refs_b64 jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Verifica
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'client_brand' AND column_name = 'ig_refs_b64';
