-- Hufbearbeitung bleibt Legacy-Zeile (FK), erscheint nicht im öffentlichen Verzeichnis / Wizard.

UPDATE public.directory_specialties
SET is_active = false
WHERE code = 'hufbearbeitung';
