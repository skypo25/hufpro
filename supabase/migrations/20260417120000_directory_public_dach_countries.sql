-- Öffentliches Verzeichnis: nur Profile in Deutschland, Österreich, Schweiz (ISO-3166-1 alpha-2).
-- Betrifft alle Public-Views, die auf directory_profiles joinen — Listing, Umkreis, Zähler, Featured.

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
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

COMMENT ON VIEW public.directory_public_profiles IS
  'Öffentliche Verzeichnisprofile: nur published und nur Länder DE/AT/CH. Enthält created_at, Geo für Umkreissuche.';

CREATE OR REPLACE VIEW public.directory_public_profile_specialties
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_specialty_id,
  j.is_primary
FROM public.directory_profile_specialties j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

CREATE OR REPLACE VIEW public.directory_public_profile_animal_types
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_animal_type_id
FROM public.directory_profile_animal_types j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

CREATE OR REPLACE VIEW public.directory_public_profile_media
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.directory_profile_id,
  m.media_type,
  m.url,
  m.sort_order,
  m.alt_text
FROM public.directory_profile_media m
INNER JOIN public.directory_profiles p ON p.id = m.directory_profile_id
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

CREATE OR REPLACE VIEW public.directory_public_profile_social_links
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.directory_profile_id,
  s.platform,
  s.url,
  s.sort_order
FROM public.directory_profile_social_links s
INNER JOIN public.directory_profiles p ON p.id = s.directory_profile_id
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

CREATE OR REPLACE VIEW public.directory_public_profile_subcategories
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_subcategory_id
FROM public.directory_profile_subcategories j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

CREATE OR REPLACE VIEW public.directory_public_profile_methods
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_method_id
FROM public.directory_profile_methods j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');
