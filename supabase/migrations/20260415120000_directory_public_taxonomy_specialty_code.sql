-- Öffentliche Taxonomie-Views: Fachrichtungs-Code mitliefern für stabile UI-Gruppierung
-- (Subcategories/Methods nach tierphysiotherapie, hufschmied, barhufbearbeitung, …).
-- Nur Zeilen, deren Fachrichtung aktiv ist (keine verwaisten Einträge zu inaktiven Parents).
--
-- DROP + CREATE statt CREATE OR REPLACE: PG erlaubt kein Ersetzen, wenn sich die
-- Spaltenliste so ändert, dass bestehende Spalten „umbenannt“ würden (42P16).
--
-- Hinweis: directory_public_subcategories ist eine VIEW (keine Tabelle). „Leer“ = keine passenden
-- Zeilen in directory_subcategories nach JOIN/Filtern, oder Basistabelle leer.
-- Diese Datei erstellt KEINE Tabellen — sicher im SQL-Editor ausführbar, wenn Tabellen schon da sind.

DROP VIEW IF EXISTS public.directory_public_methods;
DROP VIEW IF EXISTS public.directory_public_subcategories;

CREATE VIEW public.directory_public_subcategories
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.code,
  s.name,
  s.directory_specialty_id,
  sp.code AS directory_specialty_code,
  s.sort_order
FROM public.directory_subcategories s
INNER JOIN public.directory_specialties sp ON sp.id = s.directory_specialty_id
WHERE s.is_active = true
  AND sp.is_active = true;

CREATE VIEW public.directory_public_methods
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.code,
  m.name,
  m.directory_specialty_id,
  sp.code AS directory_specialty_code,
  m.sort_order
FROM public.directory_methods m
LEFT JOIN public.directory_specialties sp ON sp.id = m.directory_specialty_id
WHERE m.is_active = true
  AND (
    m.directory_specialty_id IS NULL
    OR (sp.id IS NOT NULL AND sp.is_active = true)
  );

GRANT SELECT ON public.directory_public_subcategories TO anon, authenticated;
GRANT SELECT ON public.directory_public_methods TO anon, authenticated;
