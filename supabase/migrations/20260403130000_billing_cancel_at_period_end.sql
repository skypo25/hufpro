-- Stripe: Bei „Kündigung zum Periodenende“ bleibt subscription.status oft noch "active".
-- Wir speichern cancel_at_period_end + cancel_at für korrekte Anzeige in der App.

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false;

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS subscription_cancel_at timestamptz;

COMMENT ON COLUMN billing_accounts.subscription_cancel_at_period_end IS
  'Stripe: true, wenn Kündigung zum Laufzeitende vorgemerkt (Status kann noch active sein).';

COMMENT ON COLUMN billing_accounts.subscription_cancel_at IS
  'Stripe subscription.cancel_at (UTC): voraussichtliches Ende bei geplanter Kündigung.';
