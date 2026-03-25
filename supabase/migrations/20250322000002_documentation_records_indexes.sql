-- Indizes für documentation_records (Listen, Filter, Pferd-Akte).

CREATE INDEX documentation_records_user_id_idx
  ON public.documentation_records (user_id);

CREATE INDEX documentation_records_user_animal_idx
  ON public.documentation_records (user_id, animal_id);

CREATE INDEX documentation_records_user_session_date_idx
  ON public.documentation_records (user_id, session_date DESC);

CREATE INDEX documentation_records_user_kind_idx
  ON public.documentation_records (user_id, documentation_kind);

CREATE INDEX documentation_records_user_doc_number_idx
  ON public.documentation_records (user_id, doc_number)
  WHERE doc_number IS NOT NULL;
