-- Globale App-Einstellungen (eine Zeile, id = 1). Nur Server/Service Role.

CREATE TABLE IF NOT EXISTS public.system_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data_export_retention_days integer NOT NULL DEFAULT 14
    CHECK (data_export_retention_days >= 1 AND data_export_retention_days <= 365),
  updated_at timestamptz,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO public.system_settings (id, data_export_retention_days)
VALUES (1, 14)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.system_settings IS 'Singleton-Konfiguration; Zugriff nur über Service Role / Server.';
