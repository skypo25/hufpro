-- Fotos zu documentation_records; photo_type: bestehende Huf-Slot-Keys oder tx.* (Therapie).

CREATE TABLE public.documentation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  documentation_record_id uuid NOT NULL REFERENCES public.documentation_records (id) ON DELETE CASCADE,

  file_path text NOT NULL,
  photo_type text NOT NULL,

  annotations_json jsonb NULL,
  width integer NULL,
  height integer NULL,
  file_size integer NULL,
  mime_type text NULL,
  sort_order integer NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documentation_photos IS 'Bilder zu documentation_records; Storage-Pfad wie bisher (z. B. Bucket hoof-photos).';
COMMENT ON COLUMN public.documentation_photos.photo_type IS 'Huf: bestehende Slot-Keys (z. B. VL_solar). Therapie: Präfix tx.*.';
COMMENT ON COLUMN public.documentation_photos.annotations_json IS 'Markierungen / Zeichenlayer (JSON), analog hoof_photos.';
