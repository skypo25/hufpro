-- Top-Entitlements: Owner dürfen eigene Zeilen lesen (Mein Profil UI).
-- Vorher fehlte GRANT/Policy → SELECT lief leer, obwohl Webhook Daten geschrieben hat.

ALTER TABLE public.directory_profile_top_entitlements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.directory_profile_top_entitlements TO authenticated;

DROP POLICY IF EXISTS directory_profile_top_entitlements_owner_select
  ON public.directory_profile_top_entitlements;

CREATE POLICY directory_profile_top_entitlements_owner_select
  ON public.directory_profile_top_entitlements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.directory_profiles p
      WHERE p.id = directory_profile_top_entitlements.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );
