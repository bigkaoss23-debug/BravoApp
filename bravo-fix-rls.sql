-- ============================================================
-- BRAVO — Fix permessi RLS
-- Esegui questo in Supabase → SQL Editor → Run
-- ============================================================
-- Problema: Supabase blocca tutte le letture per default.
-- Soluzione: disabilita RLS su tutte le tabelle BRAVO.
-- (In produzione si aggiungono policy specifiche per ruolo)
-- ============================================================

ALTER TABLE team_members      DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients           DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects          DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   DISABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_columns    DISABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_cards      DISABLE ROW LEVEL SECURITY;
ALTER TABLE card_links        DISABLE ROW LEVEL SECURITY;
ALTER TABLE decisions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_objectives DISABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_steps    DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events   DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     DISABLE ROW LEVEL SECURITY;
ALTER TABLE today_tasks       DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents            DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs        DISABLE ROW LEVEL SECURITY;

-- Verifica che sia tutto OK
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
