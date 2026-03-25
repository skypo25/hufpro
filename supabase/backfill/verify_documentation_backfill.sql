-- =============================================================================
-- Verifikation nach Backfill (nur lesen; beliebig oft ausführbar)
-- =============================================================================
-- Ausführung: SQL Editor oder psql — keine Datenänderung.
-- =============================================================================

-- A) Zeilenanzahl Alt vs. Neu (documentation_records mit Legacy-Marker)
SELECT
  'hoof_records' AS tbl,
  count(*)::bigint AS cnt
FROM public.hoof_records
UNION ALL
SELECT
  'documentation_records (alle)',
  count(*)::bigint
FROM public.documentation_records
UNION ALL
SELECT
  'documentation_records (mit legacy_hoof_record_id)',
  count(*)::bigint
FROM public.documentation_records
WHERE metadata ? 'legacy_hoof_record_id';

-- B) Fehlende Zuordnung: hoof_records ohne documentation_records-Zeile
SELECT
  count(*)::bigint AS hoof_records_ohne_dokumentation
FROM public.hoof_records hr
WHERE NOT EXISTS (
  SELECT 1
  FROM public.documentation_records dr
  WHERE dr.metadata ->> 'legacy_hoof_record_id' = hr.id::text
);

-- C) Doppelte Legacy-IDs (sollte 0 sein, wenn Unique-Index aus Backfill existiert)
SELECT
  metadata ->> 'legacy_hoof_record_id' AS legacy_id,
  count(*)::bigint AS cnt
FROM public.documentation_records
WHERE metadata ? 'legacy_hoof_record_id'
GROUP BY 1
HAVING count(*) > 1;

-- D) Fotos ohne passenden Parent in documentation_records (orphan hoof_photos)
SELECT
  count(*)::bigint AS hoof_photos_ohne_gematchtes_documentation_record
FROM public.hoof_photos hp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.documentation_records dr
  WHERE dr.metadata ->> 'legacy_hoof_record_id' = hp.hoof_record_id::text
);

-- E) documentation_photos, die nicht aus einem Legacy-Record stammen könnten
--    (alle unsere Backfill-Fotos hängen an Records mit legacy_hoof_record_id)
SELECT
  count(*)::bigint AS doc_photos_an_records_ohne_legacy
FROM public.documentation_photos dp
JOIN public.documentation_records dr ON dr.id = dp.documentation_record_id
WHERE NOT (dr.metadata ? 'legacy_hoof_record_id');

-- F) Alt-Fotos vs. Neu-Fotos (gleiche Zuordnungslogik wie Backfill)
SELECT
  'hoof_photos' AS tbl,
  count(*)::bigint AS cnt
FROM public.hoof_photos
UNION ALL
SELECT
  'documentation_photos (gesamt)',
  count(*)::bigint
FROM public.documentation_photos
UNION ALL
SELECT
  'documentation_photos (unter legacy documentation_records)',
  count(*)::bigint
FROM public.documentation_photos dp
JOIN public.documentation_records dr ON dr.id = dp.documentation_record_id
WHERE dr.metadata ? 'legacy_hoof_record_id';

-- G) hoof_photos-Zeilen, die noch kein documentation_photos-Pendant haben
--    (gleicher Match wie im Backfill: record + file_path + normalisierter photo_type)
SELECT
  count(*)::bigint AS hoof_photos_noch_nicht_gespiegelt
FROM public.hoof_photos hp
JOIN public.documentation_records dr
  ON dr.metadata ->> 'legacy_hoof_record_id' = hp.hoof_record_id::text
WHERE NOT EXISTS (
  SELECT 1
  FROM public.documentation_photos dp
  WHERE dp.documentation_record_id = dr.id
    AND dp.file_path = hp.file_path
    AND dp.photo_type = COALESCE(NULLIF(trim(hp.photo_type), ''), 'legacy_unknown')
);

-- H) Stichprobe: ein Pferd mit meisten Einträgen (IDs anpassen nach Bedarf)
--    Ersetze :horse_id durch konkrete UUID oder nutze Unterabfrage:
WITH pick AS (
  SELECT horse_id
  FROM public.hoof_records
  GROUP BY horse_id
  ORDER BY count(*) DESC
  LIMIT 1
)
SELECT
  hr.id AS hoof_record_id,
  dr.id AS documentation_record_id,
  dr.documentation_kind,
  dr.session_date,
  (SELECT count(*) FROM public.documentation_photos dp WHERE dp.documentation_record_id = dr.id) AS doc_photo_cnt,
  (SELECT count(*) FROM public.hoof_photos hp WHERE hp.hoof_record_id = hr.id) AS hoof_photo_cnt
FROM public.hoof_records hr
JOIN pick ON pick.horse_id = hr.horse_id
LEFT JOIN public.documentation_records dr
  ON dr.metadata ->> 'legacy_hoof_record_id' = hr.id::text
ORDER BY hr.record_date DESC NULLS LAST
LIMIT 20;

-- I) Verteilung documentation_kind / therapy_discipline nach Backfill
SELECT
  documentation_kind,
  therapy_discipline,
  count(*)::bigint
FROM public.documentation_records
WHERE metadata ? 'legacy_hoof_record_id'
GROUP BY 1, 2
ORDER BY 1, 2;

-- J) hoof_photos mit ungültigem hoof_record_id (Datenintegrität vor/nach Backfill)
SELECT
  count(*)::bigint AS hoof_photos_ohne_hoof_record_zeile
FROM public.hoof_photos hp
WHERE NOT EXISTS (
  SELECT 1 FROM public.hoof_records hr WHERE hr.id = hp.hoof_record_id
);
