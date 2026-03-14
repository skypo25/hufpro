-- RLS für Storage-Bucket "hoof-photos": Nur Zugriff auf eigene Objekte (owner_id = auth.uid()).
-- Supabase setzt owner_id beim Upload automatisch aus dem JWT.

DROP POLICY IF EXISTS "Users can upload hoof-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own hoof-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own hoof-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own hoof-photos" ON storage.objects;

CREATE POLICY "Users can upload hoof-photos"
  ON storage.objects FOR INSERT
  TO authenticated, anon
  WITH CHECK (bucket_id = 'hoof-photos');

CREATE POLICY "Users can read own hoof-photos"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (
    bucket_id = 'hoof-photos'
    AND owner_id = auth.uid()::text
  );

CREATE POLICY "Users can update own hoof-photos"
  ON storage.objects FOR UPDATE
  TO authenticated, anon
  USING (
    bucket_id = 'hoof-photos'
    AND owner_id = auth.uid()::text
  );

CREATE POLICY "Users can delete own hoof-photos"
  ON storage.objects FOR DELETE
  TO authenticated, anon
  USING (
    bucket_id = 'hoof-photos'
    AND owner_id = auth.uid()::text
  );
