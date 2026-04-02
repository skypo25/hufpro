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
  const cancelAtPeriodEnd = args.account?.subscription_cancel_at_period_end === true
  const cancelAtStripe = parseDate(args.account?.subscription_cancel_at ?? null)
  /** Ende des Zugangs bei „Kündigung zum Periodenende“: Stripe cancel_at, sonst Periodenende. */
  const cancelAt: Date | null = cancelAtPeriodEnd ? (cancelAtStripe ?? currentPeriodEnd) : cancelAtStripe
  const trialEndsAt = parseDate(args.account?.trial_ends_at ?? null)
  const trialIsActive = !!trialEndsAt && trialEndsAt.getTime() > now.getTime()
  const trialDaysRemaining = trialEndsAt ? daysBetweenCeil(now, trialEndsAt) : null
  const trialExpired = !!trialEndsAt && !trialIsActive

  const isActiveSub = status === 'active' || status === 'trialing'
  const isPastDue = status === 'past_due'
  const postCancelEnd = parseDate(args.account?.post_cancel_access_until ?? null)
  const inPostCancelGrace =
    status === 'canceled' && !!postCancelEnd && now.getTime() < postCancelEnd.getTime()

  let allowed = false
  let mode: BillingState['access']['mode'] = 'none'
  let reason: BillingState['access']['reason'] = 'unknown'
  let graceEndsAt: Date | null = null

  if (isActiveSub) {
    allowed = true
    mode = 'full'
    reason = 'active_subscription'
  } else if (trialIsActive) {
    allowed = true
    mode = 'full'
    reason = 'trial_active'
  } else if (isPastDue) {
    allowed = true
    mode = 'full'
    reason = 'past_due_grace'
  } else if (inPostCancelGrace) {
    allowed = true
    mode = 'read_only'
    reason = 'post_cancel_readonly'
    graceEndsAt = postCancelEnd
  } else if (trialExpired && status === 'none') {
    allowed = false
    mode = 'none'
    reason = 'trial_expired_no_subscription'
  } else if (status !== 'none') {
    allowed = false
    mode = 'none'
    reason = 'subscription_inactive'
  } else {
    allowed = false
    mode = 'none'
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
      cancelAtPeriodEnd,
      cancelAt,
    },
    trial: {
      isActive: trialIsActive,
      endsAt: trialEndsAt,
      daysRemaining: trialIsActive ? trialDaysRemaining : (trialEndsAt ? 0 : null),
      isExpired: trialExpired,
    },
    access: {
      allowed,
      mode,
      reason,
      graceEndsAt,
    },
  }
}

export function isTrialExpired(state: BillingState): boolean {
  return state.trial.isExpired && state.subscription.status === 'none'
}

export function canAccessApp(state: BillingState): boolean {
  return state.access.allowed
}

/** Schreibzugriff (CRUD) — bei gekündigtem Abo gesperrt (RLS + UI). */
export function canWriteAppData(state: BillingState): boolean {
  return state.access.allowed && state.access.mode === 'full'
}

/** Stripe: Abo läuft (Zahlung oder Testphase des Abos). Nicht verwechseln mit `trial` aus billing_accounts vor Abo-Abschluss. */
export function isSubscriptionStatusLive(
  status: BillingState['subscription']['status'] | null | undefined
): boolean {
  const s = (status ?? 'none').toString()
  return s === 'active' || s === 'trialing'
}

