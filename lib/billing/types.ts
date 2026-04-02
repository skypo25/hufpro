export type StripeSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | string

export type BillingAccountRow = {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: StripeSubscriptionStatus | null
  subscription_price_id: string | null
  subscription_current_period_end: string | null
  trial_ends_at: string | null
  /** Nach Kündigung: Ende des 10-Tage-Exportfensters (UTC, aus Webhook). Fehlt, solange Migration nicht angewendet. */
  post_cancel_access_until?: string | null
  /** Stripe: Kündigung zum Periodenende — Status bleibt oft noch "active". */
  subscription_cancel_at_period_end?: boolean | null
  /** Stripe subscription.cancel_at (UTC). */
  subscription_cancel_at?: string | null
  billing_email: string | null
  last_stripe_event_at: string | null
  created_at: string
  updated_at: string
}

export type BillingState = {
  plan: {
    key: 'monthly'
    label: string
    priceLabel: string
    priceId: string | null
  }
  subscription: {
    status: StripeSubscriptionStatus | 'none'
    currentPeriodEnd: Date | null
    priceId: string | null
    /** true = Kündigung vorgemerkt (Stripe-Status oft noch active). */
    cancelAtPeriodEnd: boolean
    /** Ende des Zugangs bei vorgemerktem Ende (cancel_at oder Periodenende). */
    cancelAt: Date | null
  }
  trial: {
    isActive: boolean
    endsAt: Date | null
    daysRemaining: number | null
    isExpired: boolean
  }
  access: {
    allowed: boolean
    /** full = normal; read_only = gekündigt, nur Lesen + Export bis graceEndsAt; none = gesperrt */
    mode: 'full' | 'read_only' | 'none'
    reason:
      | 'active_subscription'
      | 'trial_active'
      | 'past_due_grace'
      | 'trial_expired_no_subscription'
      | 'subscription_inactive'
      | 'post_cancel_readonly'
      | 'unknown'
    /** Nur bei mode read_only: Export bis inkl. dieses Zeitpunkts */
    graceEndsAt: Date | null
  }
}

export type PaymentMethodSummary =
  | {
      kind: 'card'
      brand: string | null
      last4: string | null
      expMonth: number | null
      expYear: number | null
    }
  | {
      kind: 'sepa_debit'
      last4: string | null
      bankCode: string | null
    }
  | {
      kind: 'unknown'
      label: string
    }

