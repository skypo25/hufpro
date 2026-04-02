-- Fallback für Datenexport-ZIPs in hoof-photos (__anidocs-export-temp/…): ZIP-MIME erlauben.
UPDATE storage.buckets
SET allowed_mime_types =
  COALESCE(allowed_mime_types, ARRAY[]::text[])
  || ARRAY['application/zip', 'application/octet-stream']::text[]
WHERE id = 'hoof-photos'
  AND NOT (COALESCE(allowed_mime_types, ARRAY[]::text[]) @> ARRAY['application/zip']::text[]);
