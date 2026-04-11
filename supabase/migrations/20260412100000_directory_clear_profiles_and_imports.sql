-- Directory: Alle Profildaten und Import-Historie entfernen (sauberer Start für neue Daten).
--
-- Entfernt:
--   directory_profiles und alles mit ON DELETE CASCADE (Spezialitäten, Tiere, Medien,
--   Social, Claims, Profile Sources, Subkategorien, Methoden-Verknüpfungen).
--   directory_import_batches (nach Profilen leer sind keine Sources mehr).
--
-- Bleibt unangetastet (Referenz / Taxonomie):
--   directory_specialties, directory_animal_types, directory_subcategories, directory_methods.

TRUNCATE TABLE public.directory_profiles CASCADE;

TRUNCATE TABLE public.directory_import_batches CASCADE;
