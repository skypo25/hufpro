import type { BillingAccountRow, BillingState, StripeSubscriptionStatus } from '@/lib/billing/types'

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function daysBetweenCeil(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export function getBillingState(args: {
  account: BillingAccountRow | null
  now?: Date
  priceIdMonthly?: string | null
}): BillingState {
  const now = args.now ?? new Date()
  const priceId = args.priceIdMonthly ?? null

  const statusRaw = (args.account?.subscription_status ?? null) as StripeSubscriptionStatus | null
  const status: StripeSubscriptionStatus | 'none' = statusRaw ? statusRaw : 'none'

  const currentPeriodEnd = parseDate(args.account?.subscription_current_period_end ?? null)
  const trialEndsAt = parseDate(args.account?.trial_ends_at ?? null)
  const trialIsActive = !!trialEndsAt && trialEndsAt.getTime() > now.getTime()
  const trialDaysRemaining = trialEndsAt ? daysBetweenCeil(now, trialEndsAt) : null
  const trialExpired = !!trialEndsAt && !trialIsActive

  const isActiveSub = status === 'active' || status === 'trialing'
  const isPastDue = status === 'past_due'

  let allowed = false
  let reason: BillingState['access']['reason'] = 'unknown'

  if (isActiveSub) {
    allowed = true
    reason = 'active_subscription'
  } else if (trialIsActive) {
    allowed = true
    reason = 'trial_active'
  } else if (isPastDue) {
    allowed = true
    reason = 'past_due_grace'
  } else if (trialExpired && status === 'none') {
    allowed = false
    reason = 'trial_expired_no_subscription'
  } else if (status !== 'none') {
    allowed = false
    reason = 'subscription_inactive'
  } else {
    allowed = false
    reason = 'trial_expired_no_subscription'
  }

  return {
    plan: {
      key: 'monthly',
      label: 'AniDocs Pro',
      priceLabel: '39,95 € / Monat',
      priceId,
    },
    subscription: {
      status,
      currentPeriodEnd,
      priceId: args.account?.subscription_price_id ?? null,
    },
    trial: {
      isActive: trialIsActive,
      endsAt: trialEndsAt,
      daysRemaining: trialIsActive ? trialDaysRemaining : (trialEndsAt ? 0 : null),
      isExpired: trialExpired,
    },
    access: {
      allowed,
      reason,
    },
  }
}

export function isTrialExpired(state: BillingState): boolean {
  return state.trial.isExpired && state.subscription.status === 'none'
}

export function canAccessApp(state: BillingState): boolean {
  return state.access.allowed
}

