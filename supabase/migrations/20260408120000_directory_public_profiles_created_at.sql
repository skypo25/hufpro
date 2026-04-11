-- Expose created_at on public listing view for "neueste Behandler" ordering (read-only, published rows only).

CREATE OR REPLACE VIEW public.directory_public_profiles
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
  p.created_at
FROM public.directory_profiles p
WHERE p.listing_status = 'published'::text;

COMMENT ON VIEW public.directory_public_profiles IS
  'Öffentliche Verzeichnisprofile (nur listing_status=published). Enthält created_at für Sortierung auf der Startseite.';
