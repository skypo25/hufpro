-- Explizite Produkt-Sicht pro Verzeichnisprofil (ergänzt Top-Entitlements).
-- directory_plan / directory_premium_source werden aus Entitlements synchronisiert (App-Code + Webhook).

ALTER TABLE public.directory_profiles
  ADD COLUMN IF NOT EXISTS directory_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS directory_premium_source text NOT NULL DEFAULT 'none';

ALTER TABLE public.directory_profiles
  DROP CONSTRAINT IF EXISTS directory_profiles_directory_plan_check;

ALTER TABLE public.directory_profiles
  ADD CONSTRAINT directory_profiles_directory_plan_check
    CHECK (directory_plan = ANY (ARRAY['free'::text, 'premium'::text]));

ALTER TABLE public.directory_profiles
  DROP CONSTRAINT IF EXISTS directory_profiles_directory_premium_source_check;

ALTER TABLE public.directory_profiles
  ADD CONSTRAINT directory_profiles_directory_premium_source_check
    CHECK (directory_premium_source = ANY (ARRAY['none'::text, 'paid'::text, 'app'::text]));

COMMENT ON COLUMN public.directory_profiles.directory_plan IS
  'free = Basisprofil; premium = Galerie + Kontaktformular + Premium-Darstellung (siehe Entitlements).';

COMMENT ON COLUMN public.directory_profiles.directory_premium_source IS
  'none | paid (Verzeichnis-Abo/Checkout/manuell) | app (AniDocs-App-Abo inkl. Premium-Verzeichnis).';

-- Backfill aus bestehenden Top-Entitlements
UPDATE public.directory_profiles p
SET
  directory_plan = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.directory_profile_top_entitlements e
      WHERE e.directory_profile_id = p.id
        AND (e.active_until IS NULL OR e.active_until > now())
    ) THEN 'premium'
    ELSE 'free'
  END,
  directory_premium_source = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.directory_profile_top_entitlements e
      WHERE e.directory_profile_id = p.id
        AND e.source = 'app_subscription'::text
        AND (e.active_until IS NULL OR e.active_until > now())
    ) THEN 'app'
    WHEN EXISTS (
      SELECT 1
      FROM public.directory_profile_top_entitlements e
      WHERE e.directory_profile_id = p.id
        AND e.source = ANY (ARRAY['directory_subscription'::text, 'manual'::text])
        AND (e.active_until IS NULL OR e.active_until > now())
    ) THEN 'paid'
    ELSE 'none'
  END;
