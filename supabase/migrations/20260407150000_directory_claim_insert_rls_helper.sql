-- Claim-INSERT: WITH CHECK nutzt EXISTS auf directory_profiles. Bisher durften
-- authenticated nur claimed eigene Zeilen SELECTen → EXISTS war immer false → RLS-Fehler.
-- Lösung: boolesche Prüfung als SECURITY DEFINER (kein Leak der Basistabelle).

CREATE OR REPLACE FUNCTION public.directory_profile_is_claimable(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.directory_profiles p
    WHERE p.id = p_profile_id
      AND p.claim_state = 'unclaimed'::text
      AND p.listing_status = 'published'::text
  );
$$;

COMMENT ON FUNCTION public.directory_profile_is_claimable(uuid) IS
  'RLS-Hilfe für directory_claims INSERT: Profil öffentlich gelistet und noch nicht beansprucht.';

REVOKE ALL ON FUNCTION public.directory_profile_is_claimable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_profile_is_claimable(uuid) TO authenticated;

DROP POLICY IF EXISTS directory_claims_claimant_insert ON public.directory_claims;

CREATE POLICY directory_claims_claimant_insert
  ON public.directory_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    claimant_user_id = auth.uid()
    AND public.directory_profile_is_claimable(directory_profile_id)
  );
