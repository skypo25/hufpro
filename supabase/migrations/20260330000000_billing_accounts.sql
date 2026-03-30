-- Billing / Stripe Sync (AniDocs)
-- Stripe ist Source of Truth; Supabase hält eine synchronisierte Sicht für die App.

-- 1) Billing account snapshot per user
CREATE TABLE IF NOT EXISTS billing_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,

  subscription_status text,
  subscription_price_id text,

  subscription_current_period_end timestamptz,
  trial_ends_at timestamptz,

  billing_email text,
  last_stripe_event_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_subscription_status
  ON billing_accounts(subscription_status);

COMMENT ON TABLE billing_accounts IS 'Synchronisierte Billing-Sicht pro Nutzer (Stripe ist Source of Truth).';

-- 2) Idempotency / audit for Stripe webhook processing
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  stripe_created_at timestamptz,
  livemode boolean,
  user_id uuid
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_user_id
  ON stripe_webhook_events(user_id);

COMMENT ON TABLE stripe_webhook_events IS 'Idempotenz & Audit für Stripe Webhooks (Event IDs sind eindeutig).';

-- 3) Trial provisioning on signup (14 days)
CREATE OR REPLACE FUNCTION public.create_billing_account_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.billing_accounts (user_id, trial_ends_at, created_at, updated_at)
  VALUES (NEW.id, now() + interval '14 days', now(), now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_billing_account ON auth.users;
CREATE TRIGGER on_auth_user_created_billing_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_billing_account_for_new_user();

-- 4) RLS (User darf nur lesen; Schreiben nur serverseitig (Service Role) oder via Trigger)
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own billing account" ON billing_accounts;
CREATE POLICY "Users can read own billing account"
  ON billing_accounts FOR SELECT
  TO authenticated, anon
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own stripe events" ON stripe_webhook_events;
CREATE POLICY "Users can read own stripe events"
  ON stripe_webhook_events FOR SELECT
  TO authenticated, anon
  USING (auth.uid() = user_id);

