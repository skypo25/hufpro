-- Aggregierte Statistik für Verzeichnisprofile (Profilaufrufe; Kontaktanfragen bleiben in directory_contact_inquiries).

CREATE TABLE IF NOT EXISTS public.directory_profile_stats (
  directory_profile_id uuid PRIMARY KEY REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  profile_views_total bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_profile_stats_views_nonnegative CHECK (profile_views_total >= 0)
);

COMMENT ON TABLE public.directory_profile_stats IS
  'Nur per Service-Role: Zähler für öffentliche Profilaufrufe (Beacon/API). Anzeige im internen Bereich für Inhaber:innen mit Top-Profil.';

ALTER TABLE public.directory_profile_stats ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.directory_profile_stats FROM anon;
REVOKE ALL ON public.directory_profile_stats FROM authenticated;

CREATE OR REPLACE FUNCTION public.directory_increment_profile_view(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.directory_profile_stats (directory_profile_id, profile_views_total, updated_at)
  VALUES (p_profile_id, 1, now())
  ON CONFLICT (directory_profile_id)
  DO UPDATE SET
    profile_views_total = public.directory_profile_stats.profile_views_total + 1,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.directory_increment_profile_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_increment_profile_view(uuid) TO service_role;
