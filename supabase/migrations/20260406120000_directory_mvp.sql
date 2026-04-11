-- Tierbehandler-Verzeichnis (MVP): Tabellen, Constraints, Indizes.
--
-- Annahmen:
-- - User-FKs auf auth.users(id) wie im restlichen AniDocs-Schema.
-- - Statusfelder als text + CHECK (keine Postgres-ENUMs).
-- - country als ISO-3166-1 alpha-2, Großbuchstaben (App/Import normalisiert).
-- - directory_claims.claimant_user_id: ON DELETE RESTRICT (Löschung Auth-User blockiert solange Claims existieren).
-- - Social: höchstens ein Link pro platform pro Profil (UNIQUE).
-- - RLS, Seeds, RPCs: nicht Teil dieser Migration.

-- ---------------------------------------------------------------------------
-- updated_at (nur directory_profiles laut Spezifikation)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.directory_profiles_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Referenztabellen
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  parent_specialty_id uuid REFERENCES public.directory_specialties (id) ON DELETE SET NULL,

  CONSTRAINT directory_specialties_code_unique UNIQUE (code),
  CONSTRAINT directory_specialties_sort_order_check CHECK (sort_order >= 0)
);

CREATE TABLE public.directory_animal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  CONSTRAINT directory_animal_types_code_unique UNIQUE (code),
  CONSTRAINT directory_animal_types_sort_order_check CHECK (sort_order >= 0)
);

-- ---------------------------------------------------------------------------
-- Zentrales Profil
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  slug text NOT NULL,
  display_name text NOT NULL,
  practice_name text,
  short_description text,
  description text,

  street text,
  house_number text,
  postal_code text,
  city text,
  state text,
  country varchar(2) NOT NULL,

  latitude double precision,
  longitude double precision,

  service_type text NOT NULL,
  service_area_text text,
  service_radius_km numeric(6, 2),

  phone_public text,
  email_public text,

  listing_status text NOT NULL DEFAULT 'draft',
  claim_state text NOT NULL DEFAULT 'unclaimed',
  verification_state text NOT NULL DEFAULT 'none',

  premium_active boolean NOT NULL DEFAULT false,
  premium_until timestamptz,

  claimed_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  data_origin text NOT NULL DEFAULT 'manual',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_imported_at timestamptz,

  CONSTRAINT directory_profiles_slug_unique UNIQUE (slug),

  CONSTRAINT directory_profiles_country_check
    CHECK (country ~ '^[A-Z]{2}$'::text),

  CONSTRAINT directory_profiles_listing_status_check
    CHECK (
      listing_status = ANY (
        ARRAY['draft'::text, 'published'::text, 'hidden'::text, 'blocked'::text]
      )
    ),

  CONSTRAINT directory_profiles_claim_state_check
    CHECK (
      claim_state = ANY (
        ARRAY['unclaimed'::text, 'claim_pending'::text, 'claimed'::text]
      )
    ),

  CONSTRAINT directory_profiles_verification_state_check
    CHECK (
      verification_state = ANY (
        ARRAY['none'::text, 'pending'::text, 'verified'::text, 'rejected'::text]
      )
    ),

  CONSTRAINT directory_profiles_service_type_check
    CHECK (
      service_type = ANY (
        ARRAY['stationary'::text, 'mobile'::text, 'both'::text]
      )
    ),

  CONSTRAINT directory_profiles_data_origin_check
    CHECK (
      data_origin = ANY (
        ARRAY['import'::text, 'manual'::text, 'merged'::text]
      )
    ),

  CONSTRAINT directory_profiles_service_radius_check
    CHECK (service_radius_km IS NULL OR service_radius_km >= 0::numeric),

  CONSTRAINT directory_profiles_lat_lon_pair_check
    CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

CREATE TRIGGER directory_profiles_set_updated_at
  BEFORE UPDATE ON public.directory_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.directory_profiles_set_updated_at();

-- ---------------------------------------------------------------------------
-- n:m Zuordnungen
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_profile_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  directory_specialty_id uuid NOT NULL REFERENCES public.directory_specialties (id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,

  CONSTRAINT directory_profile_specialties_profile_specialty_unique
    UNIQUE (directory_profile_id, directory_specialty_id)
);

CREATE UNIQUE INDEX directory_profile_specialties_one_primary_per_profile
  ON public.directory_profile_specialties (directory_profile_id)
  WHERE is_primary = true;

CREATE TABLE public.directory_profile_animal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  directory_animal_type_id uuid NOT NULL REFERENCES public.directory_animal_types (id) ON DELETE RESTRICT,

  CONSTRAINT directory_profile_animal_types_profile_animal_unique
    UNIQUE (directory_profile_id, directory_animal_type_id)
);

-- ---------------------------------------------------------------------------
-- Import
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_system text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  notes text
);

CREATE TABLE public.directory_profile_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  directory_import_batch_id uuid REFERENCES public.directory_import_batches (id) ON DELETE SET NULL,
  external_key text,
  primary_source_url text,
  secondary_source_url text,
  source_type text NOT NULL,
  data_quality text NOT NULL,
  raw_reference jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT directory_profile_sources_source_type_check
    CHECK (
      source_type = ANY (
        ARRAY[
          'csv_import'::text,
          'manual_research'::text,
          'api_import'::text,
          'user_submission'::text,
          'other'::text
        ]
      )
    ),

  CONSTRAINT directory_profile_sources_data_quality_check
    CHECK (
      data_quality = ANY (
        ARRAY['raw'::text, 'reviewed'::text, 'verified'::text]
      )
    )
);

-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  rejection_reason text,
  admin_notes text,

  CONSTRAINT directory_claims_status_check
    CHECK (
      status = ANY (
        ARRAY[
          'pending'::text,
          'approved'::text,
          'rejected'::text,
          'withdrawn'::text
        ]
      )
    )
);

-- ---------------------------------------------------------------------------
-- Medien & Social
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_profile_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  media_type text NOT NULL,
  storage_key text,
  url text,
  sort_order integer NOT NULL DEFAULT 0,
  alt_text text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT directory_profile_media_type_check
    CHECK (
      media_type = ANY (
        ARRAY['logo'::text, 'photo'::text, 'other'::text]
      )
    ),

  CONSTRAINT directory_profile_media_sort_order_check CHECK (sort_order >= 0),

  CONSTRAINT directory_profile_media_storage_or_url_check
    CHECK (storage_key IS NOT NULL OR url IS NOT NULL)
);

CREATE TABLE public.directory_profile_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,

  CONSTRAINT directory_profile_social_links_platform_check
    CHECK (
      platform = ANY (
        ARRAY[
          'website'::text,
          'instagram'::text,
          'facebook'::text,
          'linkedin'::text,
          'youtube'::text,
          'tiktok'::text,
          'other'::text
        ]
      )
    ),

  CONSTRAINT directory_profile_social_links_sort_order_check CHECK (sort_order >= 0),

  CONSTRAINT directory_profile_social_links_profile_platform_unique
    UNIQUE (directory_profile_id, platform)
);

-- ---------------------------------------------------------------------------
-- Indizes (öffentliche Listen / Filter / Admin)
-- ---------------------------------------------------------------------------

CREATE INDEX directory_profiles_listing_status_idx
  ON public.directory_profiles (listing_status);

CREATE INDEX directory_profiles_claim_state_idx
  ON public.directory_profiles (claim_state);

CREATE INDEX directory_profiles_postal_code_idx
  ON public.directory_profiles (postal_code);

CREATE INDEX directory_profiles_city_idx
  ON public.directory_profiles (city);

CREATE INDEX directory_profiles_state_idx
  ON public.directory_profiles (state);

CREATE INDEX directory_profiles_country_idx
  ON public.directory_profiles (country);

CREATE INDEX directory_profiles_published_idx
  ON public.directory_profiles (listing_status)
  WHERE listing_status = 'published'::text;

CREATE INDEX directory_profiles_geo_idx
  ON public.directory_profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX directory_profiles_claimed_by_user_idx
  ON public.directory_profiles (claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

CREATE INDEX directory_profile_specialties_specialty_idx
  ON public.directory_profile_specialties (directory_specialty_id);

CREATE INDEX directory_profile_specialties_profile_idx
  ON public.directory_profile_specialties (directory_profile_id);

CREATE INDEX directory_profile_animal_types_animal_idx
  ON public.directory_profile_animal_types (directory_animal_type_id);

CREATE INDEX directory_profile_animal_types_profile_idx
  ON public.directory_profile_animal_types (directory_profile_id);

CREATE INDEX directory_claims_profile_idx
  ON public.directory_claims (directory_profile_id);

CREATE INDEX directory_claims_pending_idx
  ON public.directory_claims (submitted_at ASC)
  WHERE status = 'pending'::text;

CREATE INDEX directory_profile_sources_batch_idx
  ON public.directory_profile_sources (directory_import_batch_id);

CREATE INDEX directory_profile_sources_profile_idx
  ON public.directory_profile_sources (directory_profile_id);

COMMENT ON TABLE public.directory_specialties IS 'Verzeichnis: kanonische Fachrichtungen (Filter/SEO).';
COMMENT ON TABLE public.directory_animal_types IS 'Verzeichnis: kanonische Tierarten (Filter/SEO).';
COMMENT ON TABLE public.directory_profiles IS 'Verzeichnis: öffentliches Listings pro Behandler/Praxis; claimed_by_user_id optional bis Claim.';
COMMENT ON TABLE public.directory_profile_specialties IS 'Verzeichnis: n:m Profil ↔ Fachrichtung; partial unique max. ein is_primary pro Profil.';
COMMENT ON TABLE public.directory_profile_animal_types IS 'Verzeichnis: n:m Profil ↔ Tierart.';
COMMENT ON TABLE public.directory_import_batches IS 'Verzeichnis: logischer Importlauf.';
COMMENT ON TABLE public.directory_profile_sources IS 'Verzeichnis: Quelle/Qualität pro Profil; Re-Import & Audit.';
COMMENT ON TABLE public.directory_claims IS 'Verzeichnis: Claim-Workflow; claimant_user_id ON DELETE RESTRICT bewusst (User-Löschung siehe Produktregel).';
COMMENT ON TABLE public.directory_profile_media IS 'Verzeichnis: Medien; storage_key oder url Pflicht.';
COMMENT ON TABLE public.directory_profile_social_links IS 'Verzeichnis: Social-Links; eine Zeile pro Plattform pro Profil.';
