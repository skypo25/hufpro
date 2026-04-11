-- Barhuf-Spezialisierungen/Methoden fehlen in directory_public_*:
-- Oft zeigen directory_subcategories / directory_methods noch auf directory_specialties
-- mit code = 'hufbearbeitung' (nach Migration 10120000 is_active = false).
-- Die Public-View filtert sp.is_active = true → diese Zeilen fallen komplett raus.
--
-- Fix: bh_* / m_bh_* auf die aktive Hauptfachrichtung barhufbearbeitung umhängen.

UPDATE public.directory_specialties
SET
  is_active = true,
  parent_specialty_id = NULL
WHERE code = 'barhufbearbeitung';

UPDATE public.directory_subcategories sc
SET directory_specialty_id = b.id
FROM public.directory_specialties h
INNER JOIN public.directory_specialties b ON b.code = 'barhufbearbeitung'
WHERE sc.directory_specialty_id = h.id
  AND h.code = 'hufbearbeitung'
  AND sc.code LIKE 'bh_%';

UPDATE public.directory_methods m
SET directory_specialty_id = b.id
FROM public.directory_specialties h
INNER JOIN public.directory_specialties b ON b.code = 'barhufbearbeitung'
WHERE m.directory_specialty_id = h.id
  AND h.code = 'hufbearbeitung'
  AND m.code LIKE 'm_bh_%';
