-- Exponiere verification_state im Public Listing (für "verifiziert" Icon).
-- Security: weiterhin nur über View; keine privaten Kontaktfelder.
--
-- WICHTIG:
-- In bestehenden Umgebungen kann die View schon andere Spalten haben (z.B. premium_active).
-- CREATE OR REPLACE VIEW mappt Spalten positionsbasiert und führt dann zu 42P16 (Rename).
-- Daher: View explizit droppen und neu anlegen.

DROP VIEW IF EXISTS public.directory_public_profiles;

CREATE VIEW public.directory_public_profiles
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.slug,
  p.display_name,
  p.practice_name,
  p.short_description,
  p.description,
  p.postal_code,
  p.city,
  p.state,
  p.country,
  p.service_type,
  p.service_area_text,
  p.service_radius_km,
  p.created_at,
  p.latitude,
  p.longitude,
  p.verification_state,
  -- Top-Profil Status aus Entitlements (Quelle(n) nachvollziehbar)
  EXISTS (
    SELECT 1
    FROM public.directory_profile_top_entitlements e
    WHERE e.directory_profile_id = p.id
      AND (e.active_until IS NULL OR e.active_until > now())
  ) AS top_active,
  (
    SELECT max(e.active_until)
    FROM public.directory_profile_top_entitlements e
    WHERE e.directory_profile_id = p.id
      AND (e.active_until IS NULL OR e.active_until > now())
      AND e.active_until IS NOT NULL
  ) AS top_until,
  (
    SELECT array_agg(e.source ORDER BY e.source)
    FROM public.directory_profile_top_entitlements e
    WHERE e.directory_profile_id = p.id
      AND (e.active_until IS NULL OR e.active_until > now())
  ) AS top_sources
FROM public.directory_profiles p
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

COMMENT ON VIEW public.directory_public_profiles IS
  'Öffentliche Verzeichnisprofile: nur published und nur Länder DE/AT/CH. Enthält created_at, Geo für Umkreissuche, verification_state (UI: verifiziert) sowie Top-Profil Status (top_active/top_until/top_sources) aus directory_profile_top_entitlements.';

GRANT SELECT ON public.directory_public_profiles TO anon, authenticated;

