/** Konsistente Spaltenliste für billing_accounts (kein select('*')). */
export const BILLING_ACCOUNT_COLUMNS =
  'user_id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_price_id, subscription_current_period_end, trial_ends_at, post_cancel_access_until, billing_email, last_stripe_event_at, created_at, updated_at'
