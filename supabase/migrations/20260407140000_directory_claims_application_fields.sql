-- Claim-Anträge: Freitext & Kontakt-Snapshots für Admin-Review + ein pending Claim pro Profil.
-- RLS bleibt unverändert (INSERT nur authenticated, Profil unclaimed).

ALTER TABLE public.directory_claims
  ADD COLUMN IF NOT EXISTS claimant_display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS claimant_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS proof_url text;

COMMENT ON COLUMN public.directory_claims.claimant_display_name IS 'Snapshot Name zum Zeitpunkt des Antrags (Review/Anzeige).';
COMMENT ON COLUMN public.directory_claims.claimant_email IS 'Snapshot E-Mail zum Zeitpunkt des Antrags.';
COMMENT ON COLUMN public.directory_claims.message IS 'Begründung / Nachricht des Antragstellers.';
COMMENT ON COLUMN public.directory_claims.proof_url IS 'Optionaler Link zu Nachweis (extern).';

-- Genau ein offener Claim pro Profil (verhindert parallele Pending-Queues).
CREATE UNIQUE INDEX IF NOT EXISTS directory_claims_one_pending_per_profile
  ON public.directory_claims (directory_profile_id)
  WHERE (status = 'pending'::text);
