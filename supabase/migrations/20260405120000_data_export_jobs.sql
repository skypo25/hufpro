-- Hintergrund-Datenexport: Job-Zeilen für asynchrone ZIP-Erstellung + Download per signierter URL.

CREATE TABLE public.data_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'complete'::text, 'failed'::text])),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  progress_label text NOT NULL DEFAULT '',
  error_message text,
  storage_bucket text,
  storage_object_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX data_export_jobs_user_active_idx
  ON public.data_export_jobs (user_id, created_at DESC)
  WHERE status = ANY (ARRAY['pending'::text, 'processing'::text]);

CREATE INDEX data_export_jobs_pending_created_idx
  ON public.data_export_jobs (created_at ASC)
  WHERE status = 'pending'::text;

ALTER TABLE public.data_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_export_jobs_select_own
  ON public.data_export_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY data_export_jobs_insert_own
  ON public.data_export_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.data_export_jobs IS 'Async user data export jobs; worker updates via service role.';
