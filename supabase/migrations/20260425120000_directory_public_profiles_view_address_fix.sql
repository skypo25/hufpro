-- Sicherstellen: directory_public_profiles enthält Straße (und Hausnummer für Import-Split).
-- Hintergrund: Ältere Migrationen nutzten CREATE OR REPLACE VIEW ohne diese Spalten; bei abweichender
-- Migrationshistorie konnte die View ohne p.street landen — dann liefert die API kein Straßenfeld.
-- house_number: Import/Wizard trennt teils Straße und Nr.; öffentliche Anzeige soll beides nutzen können.

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
  p.street,
  p.house_number,
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
  p.claim_state,
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
  'Öffentliche Verzeichnisprofile: published, DE/AT/CH. Straße + Hausnummer, claim_state, Top-Profil-Felder.';

GRANT SELECT ON public.directory_public_profiles TO anon, authenticated;
