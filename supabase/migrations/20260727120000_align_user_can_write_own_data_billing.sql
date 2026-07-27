-- Schreib-Gate an App-Billing angleichen (canWriteAppData):
-- full write nur bei active/trialing/past_due oder aktivem Trial.
-- Kein Schreiben bei canceled (auch im Export-Grace), trial abgelaufen, inactive.

CREATE OR REPLACE FUNCTION public.user_can_write_own_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN ba.subscription_status IN ('active', 'trialing', 'past_due') THEN true
          WHEN ba.trial_ends_at IS NOT NULL AND ba.trial_ends_at > now() THEN true
          ELSE false
        END
      FROM public.billing_accounts ba
      WHERE ba.user_id = auth.uid()
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.user_can_write_own_data() IS
  'TRUE nur bei Abo active/trialing/past_due oder aktivem Trial — aligned mit canWriteAppData(); sonst Read-only/gesperrt.';
