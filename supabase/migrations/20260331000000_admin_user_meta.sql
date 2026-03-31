-- Admin-only metadata per user (notes + feature flags)

CREATE TABLE IF NOT EXISTS public.admin_user_meta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  admin_note text NULL,
  feature_flags jsonb NULL,

  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_user_meta_updated_at
  ON public.admin_user_meta(updated_at DESC);

COMMENT ON TABLE public.admin_user_meta IS 'Admin-only Metadaten je Nutzer: interne Notizen und Feature-Flags. Zugriff nur über Service Role.';

ALTER TABLE public.admin_user_meta ENABLE ROW LEVEL SECURITY;
-- Keine Policies: nur Service Role darf lesen/schreiben.

