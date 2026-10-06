-- Vollprofil-Fotos am Pferd (links/rechts), unabhängig von einer Dokumentation.
ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS photo_whole_left_path text NULL,
  ADD COLUMN IF NOT EXISTS photo_whole_right_path text NULL;

COMMENT ON COLUMN public.horses.photo_whole_left_path IS 'Storage-Pfad hoof-photos: Ganzkörper links (Vollprofil).';
COMMENT ON COLUMN public.horses.photo_whole_right_path IS 'Storage-Pfad hoof-photos: Ganzkörper rechts (Vollprofil).';
