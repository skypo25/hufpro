-- Strukturierte Felder für Allgemeiner Eindruck + Hufbefund pro Huf + Checkliste
ALTER TABLE hoof_records
  ADD COLUMN IF NOT EXISTS general_condition text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gait text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS handling_behavior text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS horn_quality text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hoofs_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checklist_json jsonb DEFAULT NULL;

COMMENT ON COLUMN hoof_records.general_condition IS 'Allgemeinzustand (z.B. Gut, Auffällig)';
COMMENT ON COLUMN hoof_records.gait IS 'Gangbild (z.B. Frei / gleichmäßig)';
COMMENT ON COLUMN hoof_records.handling_behavior IS 'Verhalten beim Aufheben';
COMMENT ON COLUMN hoof_records.horn_quality IS 'Hornqualität insgesamt';
COMMENT ON COLUMN hoof_records.hoofs_json IS 'Befund pro Huf (VL, VR, HL, HR) als JSON-Array';
COMMENT ON COLUMN hoof_records.checklist_json IS 'Abgehakte Checklistenpunkte als JSON-Array';
