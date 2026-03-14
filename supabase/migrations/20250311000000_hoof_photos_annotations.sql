-- Ergänzungen für hoof_photos: Annotationen, Maße, Datei-Infos
-- Bestehende Spalten (user_id, hoof_record_id, file_path, photo_type) unverändert.
-- Optional: horse_id für klare Zuordnung (kann auch über hoof_record geholt werden).

ALTER TABLE hoof_photos
  ADD COLUMN IF NOT EXISTS annotations_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS width integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS file_size integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mime_type text DEFAULT NULL;

COMMENT ON COLUMN hoof_photos.annotations_json IS 'Linien, Punkte, Strokes, Winkelhilfen pro Bild (JSON)';
COMMENT ON COLUMN hoof_photos.photo_type IS 'Slot/View z.B. VL_solar, VR_solar, whole_left, whole_right';
