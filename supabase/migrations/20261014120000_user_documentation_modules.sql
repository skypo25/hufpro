-- Dokumentations-Modul-Entitlements (hoof | physio | osteo | heilpraktik)
-- Additive Migration: keine Drops, bestehende Daten unberührt.
-- Client: nur SELECT eigener Zeilen. Schreiben: Service Role (Onboarding-API / Admin).

CREATE TABLE IF NOT EXISTS public.user_documentation_modules (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  module_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'onboarding',
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  PRIMARY KEY (user_id, module_id),

  CONSTRAINT user_documentation_modules_module_id_check
    CHECK (module_id IN ('hoof', 'physio', 'osteo', 'heilpraktik')),

  CONSTRAINT user_documentation_modules_source_check
    CHECK (source IN ('onboarding', 'admin', 'migration'))
);

CREATE INDEX IF NOT EXISTS idx_user_documentation_modules_user_enabled
  ON public.user_documentation_modules (user_id)
  WHERE enabled = true;

COMMENT ON TABLE public.user_documentation_modules IS
  'Serverseitige Freischaltung Dokumentationsmodule pro Nutzer. Schreiben nur Service Role.';

ALTER TABLE public.user_documentation_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own documentation modules"
  ON public.user_documentation_modules;
CREATE POLICY "Users can select own documentation modules"
  ON public.user_documentation_modules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Keine INSERT/UPDATE/DELETE-Policies für authenticated → nur Service Role.

-- Optional: Standard-Behandlungsmodul am Termin (nullable, Legacy ok).
-- Mehrere Docs pro Termin bleiben über documentation_records.metadata.appointment_id möglich.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS documentation_module text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_documentation_module_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_documentation_module_check
      CHECK (
        documentation_module IS NULL
        OR documentation_module IN ('hoof', 'physio', 'osteo', 'heilpraktik')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.appointments.documentation_module IS
  'Optionale Vorauswahl Dokumentationsmodul; verhindert keine weiteren Docs am Termin.';
