-- =============================================================================
-- Backfill: hoof_records → documentation_records, hoof_photos → documentation_photos
-- =============================================================================
-- Form: reines SQL (bewusst KEINE Datei unter supabase/migrations/), damit
--       `supabase db push` diesen Schritt nicht automatisch ausführt.
--
-- Eigenschaften:
--   - idempotent (NOT EXISTS auf legacy_hoof_record_id bzw. Foto-Schlüssel)
--   - photo_type: NULL/leer in hoof_photos → 'legacy_unknown' (documentation_photos NOT NULL)
--   - metadata.legacy_hoof_record_id, legacy_record_type, backfill_version
--   - documentation_kind / therapy_discipline aus user_settings.settings->profession
--   - hoof_payload nur bei kind=hoof; therapy_payload Minimalobjekt bei therapy
--
-- AUSFÜHRUNG (manuell, nach Backup):
--   Supabase Dashboard → SQL Editor → gesamte Datei ausführen
--   ODER: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/backfill/backfill_hoof_to_documentation.sql
--
-- Rolle: Postgres / Service Role (RLS umgehen). Nicht als anon/authenticated JWT.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) documentation_records aus hoof_records
-- ---------------------------------------------------------------------------
INSERT INTO public.documentation_records (
  id,
  user_id,
  animal_id,
  session_date,
  documentation_kind,
  therapy_discipline,
  animal_type,
  session_type,
  title,
  summary_html,
  recommendations_html,
  internal_notes,
  doc_number,
  hoof_payload,
  therapy_payload,
  metadata,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS id,
  hr.user_id,
  hr.horse_id AS animal_id,
  COALESCE(hr.record_date::date, (hr.created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE) AS session_date,

  CASE
    WHEN COALESCE(NULLIF(trim(us.settings ->> 'profession'), ''), 'hufbearbeiter') = 'hufbearbeiter'
    THEN 'hoof'
    ELSE 'therapy'
  END AS documentation_kind,

  CASE
    WHEN COALESCE(NULLIF(trim(us.settings ->> 'profession'), ''), 'hufbearbeiter') = 'hufbearbeiter'
    THEN NULL
    WHEN (us.settings ->> 'profession') = 'tierphysiotherapeut' THEN 'physio'
    WHEN (us.settings ->> 'profession') = 'osteopath' THEN 'osteo'
    WHEN (us.settings ->> 'profession') = 'tierheilpraktiker' THEN 'heilpraktik'
    ELSE 'other'
  END AS therapy_discipline,

  'horse'::text AS animal_type,

  CASE
    WHEN hr.record_type IS NULL OR trim(hr.record_type) = '' THEN NULL
    WHEN lower(trim(hr.record_type)) IN ('ersttermin', 'first', 'first_visit') THEN 'first'
    WHEN lower(trim(hr.record_type)) IN ('regeltermin', 'regular', 'follow_up', 'folge', 'folgebehandlung') THEN 'regular'
    WHEN lower(trim(hr.record_type)) IN ('kontrolle', 'control') THEN 'control'
    ELSE 'other'
  END AS session_type,

  NULL::text AS title,
  hr.hoof_condition AS summary_html,
  hr.treatment AS recommendations_html,
  hr.notes AS internal_notes,
  -- doc_number: nicht aus hr lesen — Spalte existiert nur nach Migration 20250319000000;
  -- bei Bedarf nachträglich: UPDATE documentation_records dr SET doc_number = hr.doc_number FROM hoof_records hr WHERE dr.metadata->>'legacy_hoof_record_id' = hr.id::text AND hr.doc_number IS NOT NULL;
  NULL::text AS doc_number,

  CASE
    WHEN COALESCE(NULLIF(trim(us.settings ->> 'profession'), ''), 'hufbearbeiter') = 'hufbearbeiter'
    THEN jsonb_build_object(
      'schema_version', 1,
      'general', jsonb_build_object(
        'general_condition', hr.general_condition,
        'gait', hr.gait,
        'handling_behavior', hr.handling_behavior,
        'horn_quality', hr.horn_quality
      ),
      'hoofs', COALESCE(hr.hoofs_json, '[]'::jsonb),
      'checklist', COALESCE(hr.checklist_json, '[]'::jsonb)
    )
    ELSE NULL
  END AS hoof_payload,

  CASE
    WHEN COALESCE(NULLIF(trim(us.settings ->> 'profession'), ''), 'hufbearbeiter') <> 'hufbearbeiter'
    THEN '{"schema_version":1,"focus":{"regions":[],"notes":null},"modalities":[],"extensions":{}}'::jsonb
    ELSE NULL
  END AS therapy_payload,

  jsonb_build_object(
    'legacy_hoof_record_id', hr.id::text,
    'legacy_record_type', hr.record_type,
    'backfill_version', 1,
    'backfill_source', 'hoof_records'
  ) AS metadata,

  COALESCE(hr.created_at, now()) AS created_at,
  COALESCE(hr.updated_at, hr.created_at, now()) AS updated_at

FROM public.hoof_records hr
LEFT JOIN public.user_settings us ON us.user_id = hr.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.documentation_records dr
  WHERE dr.metadata ->> 'legacy_hoof_record_id' = hr.id::text
);

-- ---------------------------------------------------------------------------
-- 2) documentation_photos aus hoof_photos (über legacy_hoof_record_id)
-- ---------------------------------------------------------------------------
INSERT INTO public.documentation_photos (
  id,
  user_id,
  documentation_record_id,
  file_path,
  photo_type,
  annotations_json,
  width,
  height,
  file_size,
  mime_type,
  sort_order,
  created_at
)
SELECT
  gen_random_uuid(),
  hp.user_id,
  dr.id,
  hp.file_path,
  COALESCE(NULLIF(trim(hp.photo_type), ''), 'legacy_unknown') AS photo_type,
  hp.annotations_json,
  hp.width,
  hp.height,
  hp.file_size,
  hp.mime_type,
  NULL::integer,
  now()
FROM public.hoof_photos hp
INNER JOIN public.documentation_records dr
  ON dr.metadata ->> 'legacy_hoof_record_id' = hp.hoof_record_id::text
WHERE NOT EXISTS (
  SELECT 1
  FROM public.documentation_photos dp
  WHERE dp.documentation_record_id = dr.id
    AND dp.file_path = hp.file_path
    AND dp.photo_type = COALESCE(NULLIF(trim(hp.photo_type), ''), 'legacy_unknown')
);

-- ---------------------------------------------------------------------------
-- 3) Optional: harte Idempotenz-Schranke für spätere Läufe (empfohlen)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS documentation_records_legacy_hoof_record_id_key
  ON public.documentation_records ((metadata ->> 'legacy_hoof_record_id'))
  WHERE (metadata ? 'legacy_hoof_record_id');

COMMIT;

-- =============================================================================
-- Ende Backfill
-- =============================================================================
