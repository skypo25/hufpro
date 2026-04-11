-- Öffentliche Anzeige: Tierarten-Labels in der Mehrzahl (Suche, Filter, Karten, Profil).
UPDATE public.directory_animal_types SET name = 'Pferde' WHERE code = 'pferd';
UPDATE public.directory_animal_types SET name = 'Hunde' WHERE code = 'hund';
UPDATE public.directory_animal_types SET name = 'Katzen' WHERE code = 'katze';
