-- ============================================================
-- BRAVO — Client Briefings
-- Manuale di marca/contenuto per cliente, usato come contesto
-- integrale dagli agenti AI (coordinatore, stratega, ricercatore).
--
-- Regola: UN solo briefing per cliente (nessuno storico).
-- Ogni "Salva" sovrascrive il record esistente.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_briefings (
  client_id        text        PRIMARY KEY,     -- UUID del cliente (tabella clients.id)
  briefing_text    text        NOT NULL,        -- Testo integrale markdown-friendly
  source           text        NOT NULL DEFAULT 'manual'
                               CHECK (source IN ('pdf','manual')),
  source_filename  text,                        -- Nome file PDF originale (se caricato)
  char_count       integer     NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text                         -- email/nome di chi ha salvato
);

CREATE INDEX IF NOT EXISTS idx_client_briefings_updated
  ON client_briefings(updated_at DESC);

ALTER TABLE client_briefings DISABLE ROW LEVEL SECURITY;

-- Trigger: aggiorna char_count e updated_at ad ogni INSERT/UPDATE
CREATE OR REPLACE FUNCTION client_briefings_before_write()
RETURNS trigger AS $$
BEGIN
  NEW.char_count := COALESCE(length(NEW.briefing_text), 0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_briefings_before_write ON client_briefings;
CREATE TRIGGER trg_client_briefings_before_write
  BEFORE INSERT OR UPDATE ON client_briefings
  FOR EACH ROW EXECUTE FUNCTION client_briefings_before_write();
