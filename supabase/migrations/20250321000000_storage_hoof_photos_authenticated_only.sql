-- Sicherheits-Härtung: hoof-photos nur für angemeldete Nutzer (anon entfernt).
-- Anonymer Zugriff war ursprünglich für Service-Role/SDK-Szenarien gedacht; alle Zugriffe erfolgen über Supabase Client mit User-JWT.

DROP POLICY IF EXISTS "Users can upload hoof-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own hoof-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own hoof-photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own hoof-photos" ON storage.objects;

CREATE POLICY "Users can upload hoof-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hoof-photos');

CREATE POLICY "Users can read own hoof-photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'hoof-photos'
    AND owner_id = auth.uid()::text
  );

CREATE POLICY "Users can update own hoof-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'hoof-photos'
    AND owner_id = auth.uid()::text
  );

CREATE POLICY "Users can delete own hoof-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hoof-photos'
    AND owner_id = auth.uid()::text
  );
