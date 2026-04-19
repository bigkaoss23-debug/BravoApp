-- ============================================================
-- BRAVO — Project Tasks
-- Sub-tareas operativas de cada proyecto de cliente.
-- Una fila = una tarea (rol, responsable, fechas, estado).
--
-- Regla: una sola fuente de verdad para TODO lo operativo.
-- client_projects.assigned_to sigue siendo el "project owner".
-- ============================================================

CREATE TABLE IF NOT EXISTS project_tasks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  client_id       uuid        NOT NULL REFERENCES clients(id)         ON DELETE CASCADE,

  -- Qué hay que hacer
  title           text        NOT NULL,
  description     text        NOT NULL DEFAULT '',
  role            text        CHECK (role IN (
                                'estrategia','copy','diseño','video',
                                'ads','publicación','reporting','gestión'
                              )),

  -- Quién lo hace y cuándo
  assigned_to     text,                               -- nombre del miembro del equipo
  start_date      date,
  end_date        date,

  -- Estado y prioridad
  status          text        NOT NULL DEFAULT 'pendiente'
                              CHECK (status IN ('pendiente','en_progreso','revisión','completado')),
  priority        text        NOT NULL DEFAULT 'normal'
                              CHECK (priority IN ('alta','normal','baja')),

  -- Orden visual dentro del proyecto
  order_index     integer     NOT NULL DEFAULT 0,

  -- Link al entregable (Drive, Canva, etc.)
  deliverable_url text,

  -- Metadata
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices para las consultas más frecuentes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project
  ON project_tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_client
  ON project_tasks(client_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned
  ON project_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_project_tasks_status
  ON project_tasks(status);

CREATE INDEX IF NOT EXISTS idx_project_tasks_dates
  ON project_tasks(start_date, end_date);

-- Trigger: actualiza updated_at en cada cambio
CREATE OR REPLACE FUNCTION project_tasks_before_write()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_tasks_before_write ON project_tasks;
CREATE TRIGGER trg_project_tasks_before_write
  BEFORE INSERT OR UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION project_tasks_before_write();

-- Sin RLS (igual que el resto del sistema BRAVO)
ALTER TABLE project_tasks DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT 'project_tasks' AS tabla, COUNT(*) AS filas FROM project_tasks;
