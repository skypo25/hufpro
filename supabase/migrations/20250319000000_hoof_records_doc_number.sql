-- doc_number für Dokumentations-ID (z.B. DOK-2025-A5B2)
ALTER TABLE hoof_records
  ADD COLUMN IF NOT EXISTS doc_number text DEFAULT NULL;

COMMENT ON COLUMN hoof_records.doc_number IS 'Lesbare Dokumentationsnummer (z.B. DOK-2025-A5B2)';
