-- Stall-/Standort pro Tier (Pferd), nicht mehr am Kunden.
-- Backfill aus bisherigen Kunden-Stallfeldern, dann Kunden-Spalten entfernen.

ALTER TABLE horses
  ADD COLUMN IF NOT EXISTS stable_name text,
  ADD COLUMN IF NOT EXISTS stable_street text,
  ADD COLUMN IF NOT EXISTS stable_zip text,
  ADD COLUMN IF NOT EXISTS stable_city text,
  ADD COLUMN IF NOT EXISTS stable_country text,
  ADD COLUMN IF NOT EXISTS stable_contact text,
  ADD COLUMN IF NOT EXISTS stable_phone text,
  ADD COLUMN IF NOT EXISTS stable_directions text,
  ADD COLUMN IF NOT EXISTS stable_drive_time text;

COMMENT ON COLUMN horses.stable_name IS 'Name des Stalls / Standorts (Arbeitsort des Tiers)';
COMMENT ON COLUMN horses.stable_street IS 'Straße & Hausnummer Standort';
COMMENT ON COLUMN horses.stable_zip IS 'PLZ Standort';
COMMENT ON COLUMN horses.stable_city IS 'Ort Standort';
COMMENT ON COLUMN horses.stable_country IS 'Land Standort';
COMMENT ON COLUMN horses.stable_contact IS 'Ansprechpartner vor Ort';
COMMENT ON COLUMN horses.stable_phone IS 'Telefon vor Ort / Stall';
COMMENT ON COLUMN horses.stable_directions IS 'Anfahrtshinweis zum Standort';
COMMENT ON COLUMN horses.stable_drive_time IS 'Gecachte Entfernung/Fahrzeit zum Standort (Text)';

-- Pro Pferd: Daten vom zugehörigen Kunden übernehmen (letzter Zustand vor Umstellung)
UPDATE horses h
SET
  stable_name = c.stable_name,
  stable_street = c.stable_street,
  stable_zip = c.stable_zip,
  stable_city = c.stable_city,
  stable_country = c.stable_country,
  stable_contact = c.stable_contact,
  stable_phone = c.stable_phone,
  stable_directions = CASE WHEN c.stable_differs IS TRUE THEN c.directions ELSE NULL END,
  stable_drive_time = CASE WHEN c.stable_differs IS TRUE THEN c.drive_time ELSE NULL END
FROM customers c
WHERE c.id = h.customer_id;

-- drive_time am Kunden bezog sich bei abweichendem Stall auf den Stallweg — entfernen, Billing kann neu ermittelt werden
UPDATE customers
SET drive_time = NULL
WHERE stable_differs IS TRUE;

ALTER TABLE customers
  DROP COLUMN IF EXISTS stable_differs,
  DROP COLUMN IF EXISTS stable_name,
  DROP COLUMN IF EXISTS stable_street,
  DROP COLUMN IF EXISTS stable_zip,
  DROP COLUMN IF EXISTS stable_city,
  DROP COLUMN IF EXISTS stable_country,
  DROP COLUMN IF EXISTS stable_contact,
  DROP COLUMN IF EXISTS stable_phone,
  DROP COLUMN IF EXISTS directions;
