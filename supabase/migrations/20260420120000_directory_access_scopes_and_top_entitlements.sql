-- Directory access scopes + Top-Profil Entitlements (Zielbild 2026-04).
--
-- Ziel:
-- - App-User (Dokumentations-App): Zugriff auf App + Directory-Edit, Top-Profil automatisch (Quelle: app_subscription)
-- - Directory-only User: kein App-Zugriff, nur Directory-Edit, Top-Profil via Directory-Produkt (Quelle: directory_subscription)
-- - Admin: alles (läuft über Service Role / ADMIN_USER_IDS)
--
-- Entitlements separat, damit klar ist warum Top aktiv ist (Quelle) und mehrere Quellen möglich sind.

-- 1) Access scope für Auth-User (optional; App-User ist implizit, directory_only explizit).
CREATE TABLE IF NOT EXISTS public.directory_user_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_scope text NOT NULL DEFAULT 'directory_only',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_user_access_scope_check CHECK (access_scope = ANY (ARRAY['directory_only'::text, 'app'::text]))
);

COMMENT ON TABLE public.directory_user_access IS
  'Directory-only Accounts: steuert Zugriff (directory_only/app). App-User werden primär über Billing-Guard bestimmt; directory_only ist ein Opt-in Flag.';

ALTER TABLE public.directory_user_access ENABLE ROW LEVEL SECURITY;

-- Nutzer dürfen ihren eigenen Scope lesen (für Middleware/Layouts).
DROP POLICY IF EXISTS directory_user_access_select_own ON public.directory_user_access;
CREATE POLICY directory_user_access_select_own
  ON public.directory_user_access
  FOR SELECT
  USING (user_id = auth.uid());

-- 2) Top-Profil Entitlements pro Directory-Profil + Quelle.
CREATE TABLE IF NOT EXISTS public.directory_profile_top_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles(id) ON DELETE CASCADE,
  source text NOT NULL,
  active_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_profile_top_entitlements_source_check CHECK (
    source = ANY (ARRAY['app_subscription'::text, 'directory_subscription'::text, 'manual'::text])
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS directory_profile_top_entitlements_unique_source
  ON public.directory_profile_top_entitlements (directory_profile_id, source);

CREATE INDEX IF NOT EXISTS directory_profile_top_entitlements_profile_idx
  ON public.directory_profile_top_entitlements (directory_profile_id);

COMMENT ON TABLE public.directory_profile_top_entitlements IS
  'Top-Profil Entitlements je Profil + Quelle. active_until NULL = unbegrenzt aktiv (z.B. manuell).';

