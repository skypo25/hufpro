-- hoof-photos: Upload nur unter erstem Ordner = auth.uid()
-- (analog user-logos). Bestehende Objekte bleiben lesbar über owner_id-Policies.

DROP POLICY IF EXISTS "Users can upload hoof-photos" ON storage.objects;

CREATE POLICY "Users can upload hoof-photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hoof-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
