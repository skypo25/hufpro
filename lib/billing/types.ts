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
  }
  trial: {
    isActive: boolean
    endsAt: Date | null
    daysRemaining: number | null
    isExpired: boolean
  }
  access: {
    allowed: boolean
    reason:
      | 'active_subscription'
      | 'trial_active'
      | 'past_due_grace'
      | 'trial_expired_no_subscription'
      | 'subscription_inactive'
      | 'unknown'
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

