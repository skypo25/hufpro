-- Verzeichnis-Taxonomie: Fachrichtung „Pferdedentist“ inkl. Spezialisierungen und Methoden.
-- Idempotent: INSERT … ON CONFLICT (code) … Verknüpfung nur über directory_specialties.code = 'pferdedentist'.

-- ---------------------------------------------------------------------------
-- 1) Fachrichtung
-- ---------------------------------------------------------------------------
-- Reihenfolge: nach Hufschmied / Barhuf-Cluster (sort_order 50), vor inaktiven Platzhaltern ab 60.

INSERT INTO public.directory_specialties (code, name, sort_order, is_active, parent_specialty_id)
VALUES ('pferdedentist', 'Pferdedentist', 52, true, NULL)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  parent_specialty_id = EXCLUDED.parent_specialty_id;

-- ---------------------------------------------------------------------------
-- 2) Spezialisierungen (directory_subcategories)
-- ---------------------------------------------------------------------------

INSERT INTO public.directory_subcategories (code, name, directory_specialty_id, sort_order, is_active)
SELECT v.code, v.name, sp.id, v.sort_order, true
FROM (VALUES
  ('jungpferde', 'Jungpferde', 10),
  ('seniorenpferde', 'Seniorenpferde', 20),
  ('problempferde', 'Problempferde', 30),
  ('zahnkorrektur', 'Zahnkorrektur', 40),
  ('haken', 'Haken entfernen', 50),
  ('wellengebiss', 'Wellengebiss', 60),
  ('stufengebiss', 'Stufengebiss', 70),
  ('diastema', 'Diastema', 80),
  ('eotrh', 'EOTRH', 90),
  ('wolfszaehne', 'Wolfszähne', 100),
  ('schneidezaehne', 'Schneidezähne', 110),
  ('kiefergelenk', 'Kiefergelenk', 120),
  ('fressprobleme', 'Fressprobleme', 130),
  ('leistungsprobleme', 'Leistungsprobleme', 140)
) AS v(code, name, sort_order)
INNER JOIN public.directory_specialties sp ON sp.code = 'pferdedentist'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  directory_specialty_id = EXCLUDED.directory_specialty_id,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 3) Methoden / Leistungen (directory_methods)
-- ---------------------------------------------------------------------------

INSERT INTO public.directory_methods (code, name, directory_specialty_id, sort_order, is_active)
SELECT v.code, v.name, sp.id, v.sort_order, true
FROM (VALUES
  ('manuell', 'Manuelle Zahnkorrektur', 10),
  ('maschinell', 'Maschinelle Zahnkorrektur', 20),
  ('sedierung', 'Sedierung mit Tierarzt', 30),
  ('extraktion', 'Zahnextraktion', 40),
  ('wolfszaehne_entfernen', 'Wolfszähne entfernen', 50),
  ('schneidezahn', 'Schneidezahnkorrektur', 60),
  ('backenzahn', 'Backenzahnkorrektur', 70),
  ('maulhoehle', 'Maulhöhlenuntersuchung', 80),
  ('gebissberatung', 'Gebissberatung', 90),
  ('futterberatung', 'Futterberatung', 100)
) AS v(code, name, sort_order)
INNER JOIN public.directory_specialties sp ON sp.code = 'pferdedentist'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  directory_specialty_id = EXCLUDED.directory_specialty_id,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
