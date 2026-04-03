ALTER TABLE public.data_export_jobs
  ADD COLUMN IF NOT EXISTS email_notified_at timestamptz;

COMMENT ON COLUMN public.data_export_jobs.email_notified_at IS 'Zeitpunkt, zu dem die Fertig-Mail erfolgreich versendet wurde.';
