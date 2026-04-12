-- Kontaktanfragen (Premium) + View-Spalte premium_contact_enabled (nach allen bisherigen directory_public_profiles-View-Migrationen).

CREATE TABLE IF NOT EXISTS public.directory_contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_phone text,
  message text NOT NULL,
  ip_hash text NOT NULL,
  user_agent_snip text,
  mail_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_contact_inquiries_name_len CHECK (
    char_length(trim(sender_name)) >= 2
    AND char_length(sender_name) <= 120
  ),
  CONSTRAINT directory_contact_inquiries_email_len CHECK (char_length(sender_email) <= 254),
  CONSTRAINT directory_contact_inquiries_message_len CHECK (
    char_length(trim(message)) >= 1
    AND char_length(message) <= 4000
  ),
  CONSTRAINT directory_contact_inquiries_phone_len CHECK (
    sender_phone IS NULL
    OR char_length(sender_phone) <= 40
  )
);

CREATE INDEX IF NOT EXISTS directory_contact_inquiries_profile_created_idx
  ON public.directory_contact_inquiries (directory_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS directory_contact_inquiries_ip_created_idx
  ON public.directory_contact_inquiries (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS directory_contact_inquiries_retention_idx
  ON public.directory_contact_inquiries (created_at);

COMMENT ON TABLE public.directory_contact_inquiries IS
  'Kontaktformular (nur Premium/Top-Profil). Retention: z. B. geplante Job-Löschung nach 30 Tagen (siehe DOCS/directory/premium-contact-gdpr.md).';

ALTER TABLE public.directory_contact_inquiries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.directory_contact_inquiries FROM anon;
REVOKE ALL ON public.directory_contact_inquiries FROM authenticated;

DROP VIEW IF EXISTS public.directory_public_profiles;

CREATE VIEW public.directory_public_profiles
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.slug,
  p.display_name,
  p.practice_name,
  p.first_name,
  p.last_name,
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
  p.opening_hours,
  p.opening_hours_note,
  p.phone_public,
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
  ) AS top_sources,
  (
    EXISTS (
      SELECT 1
      FROM public.directory_profile_top_entitlements e
      WHERE e.directory_profile_id = p.id
        AND (e.active_until IS NULL OR e.active_until > now())
    )
    AND p.email_public IS NOT NULL
    AND length(trim(p.email_public)) > 0
  ) AS premium_contact_enabled
FROM public.directory_profiles p
WHERE p.listing_status = 'published'::text
  AND p.country IN ('DE', 'AT', 'CH');

COMMENT ON VIEW public.directory_public_profiles IS
  'Öffentliche Verzeichnisprofile: published, DE/AT/CH. premium_contact_enabled = Top aktiv + hinterlegte Kontakt-E-Mail (ohne Ausgabe der Adresse).';

GRANT SELECT ON public.directory_public_profiles TO anon, authenticated;
