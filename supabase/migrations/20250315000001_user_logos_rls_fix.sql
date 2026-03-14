-- Fix: RLS für user-logos (behebt "new row violates row-level security policy")
-- Einmal im Supabase SQL Editor ausführen, wenn Logo-Upload den RLS-Fehler wirft.
-- Nutzt auth.jwt()->>'sub' wie in der Supabase-Doku; SELECT für Upsert; anon + authenticated.

DROP POLICY IF EXISTS "Users can upload own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own logo" ON storage.objects;

-- Erster Ordner im Pfad = User-ID (aus JWT), wie in Supabase Storage-Doku
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
