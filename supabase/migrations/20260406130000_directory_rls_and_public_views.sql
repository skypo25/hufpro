-- Directory MVP: öffentliche Read-Views (security_invoker = false) + RLS auf Basistabellen.
--
-- Öffentlichkeit: anon/authenticated lesen Verzeichnisdaten nur über Views (keine direkten SELECTs
-- auf directory_profiles nötig). Konservativ weggelassen in directory_public_profiles:
-- street, house_number, latitude, longitude, phone_public, email_public (können später ergänzt werden).
--
-- Admin: Wie admin_user_meta — kein auth.uid()-Admin in Postgres; voller Zugriff über Service Role
-- (Next.js ADMIN_USER_IDS + createSupabaseServiceRoleClient), umgeht RLS.
--
-- Claims: INSERT + SELECT für authentifizierte Antragsteller (eigene Zeilen); kein UPDATE/DELETE im MVP.

-- ---------------------------------------------------------------------------
-- Öffentliche Views (Invoker = false → Zugriff mit View-Owner-Rechten, sichere Spaltenauswahl)
-- ---------------------------------------------------------------------------

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
  p.service_radius_km
FROM public.directory_profiles p
WHERE p.listing_status = 'published'::text;

COMMENT ON VIEW public.directory_public_profiles IS
  'Öffentliche Verzeichnisprofile (nur listing_status=published). Kein Straße/Hausnr., kein Geo, keine Kontaktfelder — bei Bedarf später erweitern.';

CREATE VIEW public.directory_public_specialties
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.code,
  s.name,
  s.description,
  s.sort_order,
  s.parent_specialty_id
FROM public.directory_specialties s
WHERE s.is_active = true;

CREATE VIEW public.directory_public_animal_types
WITH (security_invoker = false)
AS
SELECT
  t.id,
  t.code,
  t.name,
  t.sort_order
FROM public.directory_animal_types t
WHERE t.is_active = true;

CREATE VIEW public.directory_public_profile_specialties
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_specialty_id,
  j.is_primary
FROM public.directory_profile_specialties j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text;

CREATE VIEW public.directory_public_profile_animal_types
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_animal_type_id
FROM public.directory_profile_animal_types j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text;

CREATE VIEW public.directory_public_profile_media
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
WHERE p.listing_status = 'published'::text;

COMMENT ON VIEW public.directory_public_profile_media IS
  'Nur url/sort_order/alt für Public; storage_key nicht exponiert (Signed URLs später serverseitig).';

CREATE VIEW public.directory_public_profile_social_links
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
WHERE p.listing_status = 'published'::text;

-- ---------------------------------------------------------------------------
-- Grants: Public Read nur über Views; Basistabellen für anon ohne SELECT wo möglich
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.directory_public_profiles TO anon, authenticated;
GRANT SELECT ON public.directory_public_specialties TO anon, authenticated;
GRANT SELECT ON public.directory_public_animal_types TO anon, authenticated;
GRANT SELECT ON public.directory_public_profile_specialties TO anon, authenticated;
GRANT SELECT ON public.directory_public_profile_animal_types TO anon, authenticated;
GRANT SELECT ON public.directory_public_profile_media TO anon, authenticated;
GRANT SELECT ON public.directory_public_profile_social_links TO anon, authenticated;

REVOKE ALL ON public.directory_profiles FROM anon;
REVOKE ALL ON public.directory_profile_specialties FROM anon;
REVOKE ALL ON public.directory_profile_animal_types FROM anon;
REVOKE ALL ON public.directory_profile_media FROM anon;
REVOKE ALL ON public.directory_profile_social_links FROM anon;
REVOKE ALL ON public.directory_claims FROM anon;

REVOKE ALL ON public.directory_import_batches FROM anon, authenticated;
REVOKE ALL ON public.directory_profile_sources FROM anon, authenticated;

REVOKE ALL ON public.directory_profiles FROM authenticated;
REVOKE ALL ON public.directory_specialties FROM anon, authenticated;
REVOKE ALL ON public.directory_animal_types FROM anon, authenticated;

REVOKE ALL ON public.directory_profile_specialties FROM authenticated;
REVOKE ALL ON public.directory_profile_animal_types FROM authenticated;
REVOKE ALL ON public.directory_profile_media FROM authenticated;
REVOKE ALL ON public.directory_profile_social_links FROM authenticated;
REVOKE ALL ON public.directory_claims FROM authenticated;

-- authenticated: Basistabellen nur wo RLS Policies greifen
GRANT SELECT, UPDATE ON public.directory_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_profile_specialties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_profile_animal_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_profile_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_profile_social_links TO authenticated;
GRANT SELECT, INSERT ON public.directory_claims TO authenticated;

GRANT SELECT ON public.directory_specialties TO authenticated;
GRANT SELECT ON public.directory_animal_types TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS aktivieren (kein FORCE: sonst leeren security_invoker=false Views den Scan)
-- ---------------------------------------------------------------------------

ALTER TABLE public.directory_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_specialties ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_animal_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_profile_specialties ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_profile_animal_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_import_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_profile_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_claims ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_profile_media ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.directory_profile_social_links ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- directory_profiles: nur Owner (kein direkter Zugriff für anon)
-- ---------------------------------------------------------------------------

CREATE POLICY directory_profiles_owner_select
  ON public.directory_profiles
  FOR SELECT
  TO authenticated
  USING (claimed_by_user_id = auth.uid());

CREATE POLICY directory_profiles_owner_update
  ON public.directory_profiles
  FOR UPDATE
  TO authenticated
  USING (claimed_by_user_id = auth.uid())
  WITH CHECK (claimed_by_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Referenztabellen: alle aktiven lesbar (authenticated; anon nutzt Views)
-- ---------------------------------------------------------------------------

CREATE POLICY directory_specialties_authenticated_select_active
  ON public.directory_specialties
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY directory_animal_types_authenticated_select_active
  ON public.directory_animal_types
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ---------------------------------------------------------------------------
-- Junctions: Owner des Profils
-- ---------------------------------------------------------------------------

CREATE POLICY directory_profile_specialties_owner_select
  ON public.directory_profile_specialties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_specialties.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_specialties_owner_insert
  ON public.directory_profile_specialties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_specialties.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_specialties_owner_update
  ON public.directory_profile_specialties
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_specialties.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_specialties.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_specialties_owner_delete
  ON public.directory_profile_specialties
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_specialties.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_animal_types_owner_select
  ON public.directory_profile_animal_types
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_animal_types.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_animal_types_owner_insert
  ON public.directory_profile_animal_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_animal_types.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_animal_types_owner_update
  ON public.directory_profile_animal_types
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_animal_types.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_animal_types.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_animal_types_owner_delete
  ON public.directory_profile_animal_types
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_animal_types.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Media & Social: Owner des Profils
-- ---------------------------------------------------------------------------

CREATE POLICY directory_profile_media_owner_select
  ON public.directory_profile_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_media.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_media_owner_insert
  ON public.directory_profile_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_media.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_media_owner_update
  ON public.directory_profile_media
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_media.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_media.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_media_owner_delete
  ON public.directory_profile_media
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_media.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_social_links_owner_select
  ON public.directory_profile_social_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_social_links.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_social_links_owner_insert
  ON public.directory_profile_social_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_social_links.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_social_links_owner_update
  ON public.directory_profile_social_links
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_social_links.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_social_links.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_social_links_owner_delete
  ON public.directory_profile_social_links
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_social_links.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Claims: nur eigene Zeilen (kein Public); Admin über Service Role
-- ---------------------------------------------------------------------------

CREATE POLICY directory_claims_claimant_select_own
  ON public.directory_claims
  FOR SELECT
  TO authenticated
  USING (claimant_user_id = auth.uid());

CREATE POLICY directory_claims_claimant_insert
  ON public.directory_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    claimant_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_claims.directory_profile_id
        AND p.claim_state = 'unclaimed'::text
    )
  );

-- ---------------------------------------------------------------------------
-- Import: keine Policies für authenticated — nur Service Role (Bypass)
-- ---------------------------------------------------------------------------

-- directory_import_batches & directory_profile_sources: absichtlich keine authenticated/anon Policies.
