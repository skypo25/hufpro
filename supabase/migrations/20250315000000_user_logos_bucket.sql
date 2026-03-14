-- Bucket für User-Logos (Rechnungen, PDF-Branding)
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'user-logos',
  'user-logos',
  true,
  ARRAY['image/jpeg', 'image/png', 'image/webp'],
  2097152
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Eigenes Verzeichnis = erster Ordner = auth.jwt()->>'sub'; anon+authenticated (Storage-API)
DROP POLICY IF EXISTS "Users can upload own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own logo" ON storage.objects;

CREATE POLICY "Users can upload own logo"
  ON storage.objects FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    bucket_id = 'user-logos'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );

CREATE POLICY "Users can read own logo"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (
    bucket_id = 'user-logos'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );

CREATE POLICY "Users can update own logo"
  ON storage.objects FOR UPDATE
  TO authenticated, anon
  USING (
    bucket_id = 'user-logos'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );

CREATE POLICY "Users can delete own logo"
  ON storage.objects FOR DELETE
  TO authenticated, anon
  USING (
    bucket_id = 'user-logos'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  );
