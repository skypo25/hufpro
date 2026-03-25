-- Indizes für documentation_photos.

CREATE INDEX documentation_photos_record_id_idx
  ON public.documentation_photos (documentation_record_id);

CREATE INDEX documentation_photos_user_id_idx
  ON public.documentation_photos (user_id);

CREATE INDEX documentation_photos_user_record_idx
  ON public.documentation_photos (user_id, documentation_record_id);
