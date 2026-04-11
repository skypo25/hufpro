-- Referenzdaten: Fachrichtungen und Tierarten für das Tierbehandler-Verzeichnis.
-- Idempotent: ON CONFLICT (code) aktualisiert Anzeigenamen/Sortierung/Aktiv-Flag (kein Löschen von parent_links).
--
-- MVP-Hierarchie: eine klare Unterkategorie (Barhuf unter Hufbearbeitung). Weitere Unterkategorien
-- können später per Migration oder Admin (Service Role) ergänzt werden.

-- ---------------------------------------------------------------------------
-- directory_specialties (Eltern zuerst)
-- ---------------------------------------------------------------------------

INSERT INTO public.directory_specialties (code, name, sort_order, is_active, parent_specialty_id)
VALUES
  ('tierphysiotherapie', 'Tierphysiotherapie', 10, true, NULL),
  ('tierosteopathie', 'Tierosteopathie', 20, true, NULL),
  ('tierheilpraktik', 'Tierheilpraktik', 30, true, NULL),
  ('hufbearbeitung', 'Hufbearbeitung', 40, true, NULL),
  ('hufschmied', 'Hufschmied / Hufbeschlag', 50, true, NULL)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

INSERT INTO public.directory_specialties (code, name, sort_order, is_active, parent_specialty_id)
SELECT
  'barhufbearbeitung',
  'Barhufbearbeitung',
  45,
  true,
  p.id
FROM public.directory_specialties p
WHERE p.code = 'hufbearbeitung'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  parent_specialty_id = EXCLUDED.parent_specialty_id;

-- ---------------------------------------------------------------------------
-- directory_animal_types
-- ---------------------------------------------------------------------------

INSERT INTO public.directory_animal_types (code, name, sort_order, is_active)
VALUES
  ('pferd', 'Pferde', 10, true),
  ('hund', 'Hunde', 20, true),
  ('katze', 'Katzen', 30, true),
  ('kleintiere', 'Kleintiere', 40, true),
  ('nutztiere', 'Nutztiere', 50, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

COMMENT ON TABLE public.directory_specialties IS
  'Verzeichnis: Fachrichtungen. Seed: tierphysiotherapie, tierosteopathie, tierheilpraktik, hufbearbeitung, barhufbearbeitung (Kind von hufbearbeitung), hufschmied.';

COMMENT ON TABLE public.directory_animal_types IS
  'Verzeichnis: Tierarten/Zielgruppen. Seed: pferd, hund, katze, kleintiere, nutztiere.';
