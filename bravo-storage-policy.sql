-- ============================================================
-- BRAVO — Policy Supabase Storage per bucket bravo-content
-- Esegui nel SQL Editor di Supabase UNA SOLA VOLTA
-- ============================================================

-- Assicura che il bucket esista ed è pubblico
INSERT INTO storage.buckets (id, name, public)
VALUES ('bravo-content', 'bravo-content', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permette upload (INSERT) a chiunque usi la chiave anon (il backend Railway)
CREATE POLICY "bravo_content_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'bravo-content');

-- Permette sovrascrittura (UPDATE) — per upsert
CREATE POLICY "bravo_content_update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'bravo-content');

-- Permette lettura pubblica
CREATE POLICY "bravo_content_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'bravo-content');

-- Verifica
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE 'bravo_content%';
