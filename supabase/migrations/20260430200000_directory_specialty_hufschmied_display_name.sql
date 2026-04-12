-- Anzeigename: nur „Hufschmied“ (ohne „/ Hufbeschlag“)
UPDATE public.directory_specialties
SET name = 'Hufschmied'
WHERE code = 'hufschmied'
  AND name ILIKE '%hufbeschlag%';
