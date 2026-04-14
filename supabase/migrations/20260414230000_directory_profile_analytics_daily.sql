-- Tägliche Profil-Analytics (Aufrufe nach Quelle, Anruf-Klicks, Teilen) + RPCs nur für service_role.

CREATE TABLE IF NOT EXISTS public.directory_profile_analytics_daily (
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  bucket_date date NOT NULL,
  profile_views integer NOT NULL DEFAULT 0,
  views_directory_search integer NOT NULL DEFAULT 0,
  views_search_engine integer NOT NULL DEFAULT 0,
  views_direct integer NOT NULL DEFAULT 0,
  views_social integer NOT NULL DEFAULT 0,
  views_other integer NOT NULL DEFAULT 0,
  phone_clicks integer NOT NULL DEFAULT 0,
  share_clicks integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT directory_profile_analytics_daily_pkey PRIMARY KEY (directory_profile_id, bucket_date),
  CONSTRAINT directory_profile_analytics_daily_views_nonneg CHECK (profile_views >= 0),
  CONSTRAINT directory_profile_analytics_daily_phone_nonneg CHECK (phone_clicks >= 0),
  CONSTRAINT directory_profile_analytics_daily_share_nonneg CHECK (share_clicks >= 0)
);

COMMENT ON TABLE public.directory_profile_analytics_daily IS
  'Tägliche Kennzahlen je Profil (UTC-Datum). Nur per Service-Role geschrieben.';

ALTER TABLE public.directory_profile_analytics_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.directory_profile_analytics_daily FROM anon;
REVOKE ALL ON public.directory_profile_analytics_daily FROM authenticated;

CREATE OR REPLACE FUNCTION public.directory_analytics_record_view(p_profile_id uuid, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (timezone('UTC', now()))::date;
  src text := lower(trim(coalesce(p_source, '')));
BEGIN
  IF src NOT IN ('directory_search', 'search_engine', 'direct', 'social', 'other') THEN
    src := 'other';
  END IF;

  PERFORM public.directory_increment_profile_view(p_profile_id);

  INSERT INTO public.directory_profile_analytics_daily (
    directory_profile_id,
    bucket_date,
    profile_views,
    views_directory_search,
    views_search_engine,
    views_direct,
    views_social,
    views_other,
    updated_at
  )
  VALUES (
    p_profile_id,
    d,
    1,
    CASE WHEN src = 'directory_search' THEN 1 ELSE 0 END,
    CASE WHEN src = 'search_engine' THEN 1 ELSE 0 END,
    CASE WHEN src = 'direct' THEN 1 ELSE 0 END,
    CASE WHEN src = 'social' THEN 1 ELSE 0 END,
    CASE WHEN src = 'other' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (directory_profile_id, bucket_date) DO UPDATE SET
    profile_views = public.directory_profile_analytics_daily.profile_views + 1,
    views_directory_search = public.directory_profile_analytics_daily.views_directory_search
      + (CASE WHEN src = 'directory_search' THEN 1 ELSE 0 END),
    views_search_engine = public.directory_profile_analytics_daily.views_search_engine
      + (CASE WHEN src = 'search_engine' THEN 1 ELSE 0 END),
    views_direct = public.directory_profile_analytics_daily.views_direct
      + (CASE WHEN src = 'direct' THEN 1 ELSE 0 END),
    views_social = public.directory_profile_analytics_daily.views_social
      + (CASE WHEN src = 'social' THEN 1 ELSE 0 END),
    views_other = public.directory_profile_analytics_daily.views_other
      + (CASE WHEN src = 'other' THEN 1 ELSE 0 END),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.directory_analytics_record_phone_click(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (timezone('UTC', now()))::date;
BEGIN
  INSERT INTO public.directory_profile_analytics_daily (
    directory_profile_id,
    bucket_date,
    profile_views,
    views_directory_search,
    views_search_engine,
    views_direct,
    views_social,
    views_other,
    phone_clicks,
    share_clicks,
    updated_at
  )
  VALUES (p_profile_id, d, 0, 0, 0, 0, 0, 0, 1, 0, now())
  ON CONFLICT (directory_profile_id, bucket_date) DO UPDATE SET
    phone_clicks = public.directory_profile_analytics_daily.phone_clicks + 1,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.directory_analytics_record_share_click(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (timezone('UTC', now()))::date;
BEGIN
  INSERT INTO public.directory_profile_analytics_daily (
    directory_profile_id,
    bucket_date,
    profile_views,
    views_directory_search,
    views_search_engine,
    views_direct,
    views_social,
    views_other,
    phone_clicks,
    share_clicks,
    updated_at
  )
  VALUES (p_profile_id, d, 0, 0, 0, 0, 0, 0, 0, 1, now())
  ON CONFLICT (directory_profile_id, bucket_date) DO UPDATE SET
    share_clicks = public.directory_profile_analytics_daily.share_clicks + 1,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.directory_analytics_record_view(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_analytics_record_view(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.directory_analytics_record_phone_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_analytics_record_phone_click(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.directory_analytics_record_share_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_analytics_record_share_click(uuid) TO service_role;
