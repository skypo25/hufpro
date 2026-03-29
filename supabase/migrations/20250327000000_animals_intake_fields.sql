-- Erweiterung horses -> generisches "Tier"-Intake für Profile mit Kleintieren.
-- Bestehende Pferde-Flows bleiben kompatibel (alles optional, IF NOT EXISTS).

ALTER TABLE horses
  ADD COLUMN IF NOT EXISTS animal_type text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS neutered text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(12,2),
  ADD COLUMN IF NOT EXISTS coat_color text,
  ADD COLUMN IF NOT EXISTS chip_id text,
  ADD COLUMN IF NOT EXISTS intake jsonb;

COMMENT ON COLUMN horses.animal_type IS 'Tierart/Typ (horse/dog/cat/small/other) für Profile mit Kleintieren; NULL/horse = Pferd';
COMMENT ON COLUMN horses.intake IS 'Zusatzdaten (Vorgeschichte, Haltung, Verhalten, etc.) als JSON für Kleintier-Intake';

