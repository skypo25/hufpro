-- data_export_jobs: Clients dürfen nur pending Jobs ohne Storage-Felder anlegen.
-- Status/Pfade setzt ausschließlich der Worker (service role).

DROP POLICY IF EXISTS data_export_jobs_insert_own ON public.data_export_jobs;

CREATE POLICY data_export_jobs_insert_own
  ON public.data_export_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND storage_bucket IS NULL
    AND storage_object_path IS NULL
    AND COALESCE(progress_percent, 0) = 0
  );
