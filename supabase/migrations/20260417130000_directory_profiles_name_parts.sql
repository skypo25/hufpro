-- Verzeichnis: Anrede, Titel, Vor- und Nachname (Wizard); display_name bleibt die öffentliche Anzeige.

ALTER TABLE public.directory_profiles
  ADD COLUMN IF NOT EXISTS name_salutation text,
  ADD COLUMN IF NOT EXISTS name_title text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.directory_profiles.name_salutation IS
  'Anrede (herr, frau, divers); optional, nicht Teil von display_name.';
COMMENT ON COLUMN public.directory_profiles.name_title IS
  'Akademischer/beruflicher Titel (z. B. Dr., Prof. Dr.); Teil von display_name wenn gesetzt.';
COMMENT ON COLUMN public.directory_profiles.first_name IS 'Vorname Ansprechpartner; Teil von display_name.';
COMMENT ON COLUMN public.directory_profiles.last_name IS 'Nachname Ansprechpartner; Teil von display_name.';
