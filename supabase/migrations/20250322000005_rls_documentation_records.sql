-- RLS für documentation_records: gleiche Isolation wie hoof_records (JWT → auth.uid()).

ALTER TABLE public.documentation_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own documentation_records" ON public.documentation_records;

CREATE POLICY "Users can manage own documentation_records"
  ON public.documentation_records
  FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
