-- RLS für documentation_photos: gleiche Isolation wie hoof_photos.

ALTER TABLE public.documentation_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own documentation_photos" ON public.documentation_photos;

CREATE POLICY "Users can manage own documentation_photos"
  ON public.documentation_photos
  FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
