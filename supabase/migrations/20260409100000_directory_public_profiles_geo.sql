-- Phase 1 Umkreissuche: Koordinaten für veröffentlichte Profile in der Public-View exponieren.
-- Hinweis: Keine Straße/Hausnummer in der View (Guardrails unverändert).

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
  p.created_at,
  p.latitude,
  p.longitude
FROM public.directory_profiles p
WHERE p.listing_status = 'published'::text;

COMMENT ON VIEW public.directory_public_profiles IS
  'Öffentliche Verzeichnisprofile (nur published). Enthält created_at, latitude/longitude für Umkreissuche (Phase 1). Kein Straße/Hausnr., keine Kontaktfelder.';
