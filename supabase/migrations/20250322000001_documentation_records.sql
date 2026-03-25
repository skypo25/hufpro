-- Neutrale Dokumentations-Haupttabelle (vorerst ohne App-Nutzung, ohne Backfill).
-- animal_id referenziert v1 weiterhin horses.id.

CREATE OR REPLACE FUNCTION public.documentation_records_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.documentation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES public.horses (id) ON DELETE CASCADE,

  session_date date NOT NULL,

  documentation_kind text NOT NULL,
  therapy_discipline text NULL,
  animal_type text NOT NULL DEFAULT 'horse',
  session_type text NULL,

  title text NULL,
  summary_html text NULL,
  recommendations_html text NULL,
  internal_notes text NULL,
  doc_number text NULL,

  hoof_payload jsonb NULL,
  therapy_payload jsonb NULL,
  metadata jsonb NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT documentation_records_kind_check
    CHECK (documentation_kind IN ('hoof', 'therapy')),

  CONSTRAINT documentation_records_therapy_discipline_check
    CHECK (
      therapy_discipline IS NULL
      OR therapy_discipline IN ('physio', 'osteo', 'heilpraktik', 'other')
    ),

  CONSTRAINT documentation_records_animal_type_check
    CHECK (animal_type IN ('horse', 'small_animal')),

  CONSTRAINT documentation_records_session_type_check
    CHECK (
      session_type IS NULL
      OR session_type IN ('first', 'regular', 'control', 'other')
    )
);

CREATE TRIGGER documentation_records_set_updated_at
  BEFORE UPDATE ON public.documentation_records
  FOR EACH ROW
  EXECUTE PROCEDURE public.documentation_records_set_updated_at();

COMMENT ON TABLE public.documentation_records IS 'Neutrale Sitzungs-/Dokumentationszeile (Huf & Therapie); App-Umstellung folgt separat.';
COMMENT ON COLUMN public.documentation_records.animal_id IS 'Tier-Referenz; v1: FK auf horses.id.';
COMMENT ON COLUMN public.documentation_records.documentation_kind IS 'hoof | therapy';
COMMENT ON COLUMN public.documentation_records.therapy_discipline IS 'Nur bei therapy sinnvoll: physio | osteo | heilpraktik | other';
COMMENT ON COLUMN public.documentation_records.hoof_payload IS 'Strukturierter Hufbefund (JSON), nur bei documentation_kind = hoof.';
COMMENT ON COLUMN public.documentation_records.therapy_payload IS 'Strukturierte Therapie-Ergänzung (JSON), nur bei documentation_kind = therapy.';
COMMENT ON COLUMN public.documentation_records.metadata IS 'Legacy-Mapping, Schema-Hinweise, Quelle; kein Ersatz für fachliche Felder.';
