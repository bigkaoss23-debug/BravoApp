-- ============================================================
-- BRAVO — Migración: campos de agente en client_projects
-- Ejecutar en Supabase → SQL Editor (idempotente)
-- Fecha: 2026-05-02
-- ============================================================

-- Agente principal asignado por Opus al analizar el briefing
ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS responsible_agent text;

-- Agentes secundarios que colaboran (array de claves)
ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS co_agents jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Mini-brief autocontenido que Opus escribe para el agente
ALTER TABLE client_projects
  ADD COLUMN IF NOT EXISTS mini_brief text;

-- Verificación
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'client_projects'
  AND column_name IN ('responsible_agent', 'co_agents', 'mini_brief')
ORDER BY column_name;
