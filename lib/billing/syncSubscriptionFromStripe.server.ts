import 'server-only'

import type Stripe from 'stripe'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { getStripe } from '@/lib/stripe/stripe'
import type { BillingAccountRow } from '@/lib/billing/types'

function asIsoSeconds(s: number | null | undefined): string | null {
  if (!s) return null
  const d = new Date(s * 1000)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function subscriptionHasAppMonthlyPrice(sub: Stripe.Subscription, appMonthlyPriceId: string | null): boolean {
  const itemPriceIds = sub.items.data
    .map((it) => it.price?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (!appMonthlyPriceId) return itemPriceIds.length > 0
  return itemPriceIds.includes(appMonthlyPriceId)
}

/** Mehrere Test-/Alt-Abos am gleichen Kunden: höchste Priorität zuerst (active > trialing > past_due …). */
const STATUS_RANK: Record<string, number> = {
  active: 100,
  trialing: 90,
  past_due: 50,
  unpaid: 40,
  incomplete: 30,
  paused: 25,
  canceled: 5,
  incomplete_expired: 0,
}

function pickPreferredAppSubscription(
  subs: Stripe.Subscription[],
  appMonthlyPriceId: string | null
): Stripe.Subscription | null {
  const filtered = subs.filter((s) => subscriptionHasAppMonthlyPrice(s, appMonthlyPriceId))
  if (filtered.length === 0) return null
  return [...filtered].sort((a, b) => {
    const ra = STATUS_RANK[(a.status ?? '').toString()] ?? 0
    const rb = STATUS_RANK[(b.status ?? '').toString()] ?? 0
    if (rb !== ra) return rb - ra
    return (b.created ?? 0) - (a.created ?? 0)
  })[0]
}

/**
 * Holt den aktuellen Stripe-Subscription-Status und schreibt ihn nach `billing_accounts`.
 * Bei mehreren Abos (Tests, alte Stornos) wird das **passende App-Abo** anhand der Price-ID gewählt.
 */
export async function syncBillingSubscriptionFromStripeForUser(userId: string): Promise<{
  account: BillingAccountRow | null
  synced: boolean
}> {
  const admin = createSupabaseServiceRoleClient()
  const { data: row, error: readErr } = await admin
    .from('billing_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (readErr || !row) {
    return { account: (row as BillingAccountRow | null) ?? null, synced: false }
  }

  const appMonthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null
  const stripe = getStripe()

  const customerIdRaw = (row as { stripe_customer_id?: string | null }).stripe_customer_id?.trim() ?? ''
  const subIdStored = (row as { stripe_subscription_id?: string | null }).stripe_subscription_id?.trim() ?? ''

  let sub: Stripe.Subscription | null = null

  if (customerIdRaw) {
    try {
      const list = await stripe.subscriptions.list({
        customer: customerIdRaw,
        status: 'all',
        limit: 50,
      })
      sub = pickPreferredAppSubscription(list.data, appMonthlyPriceId)
    } catch {
      sub = null
    }
  }

  if (!sub && subIdStored) {
    try {
      const retrieved = await stripe.subscriptions.retrieve(subIdStored)
      if (subscriptionHasAppMonthlyPrice(retrieved, appMonthlyPriceId)) {
        sub = retrieved
      }
    } catch {
      /* ignore */
    }
  }

  if (!sub) {
    return { account: row as BillingAccountRow, synced: false }
  }

  const priceId = sub.items.data[0]?.price?.id ?? null
  const st = (sub.status ?? '').toString()
  const nowIso = new Date().toISOString()

  let postCancelAccessUntil: string | null | undefined
  if (st === 'canceled') {
    const periodEndSec = sub.current_period_end
    const baseMs = periodEndSec ? Math.max(Date.now(), periodEndSec * 1000) : Date.now()
    postCancelAccessUntil = new Date(baseMs + 10 * 24 * 60 * 60 * 1000).toISOString()
  } else if (st === 'active' || st === 'trialing') {
    postCancelAccessUntil = null
  }

  const patch: Record<string, unknown> = {
    stripe_customer_id:
      typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id?: string })?.id ?? null,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status ?? null,
    subscription_price_id: priceId,
    subscription_current_period_end: asIsoSeconds(sub.current_period_end) ?? null,
    subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    subscription_cancel_at: asIsoSeconds(sub.cancel_at) ?? null,
    trial_ends_at: asIsoSeconds(sub.trial_end) ?? null,
    last_stripe_event_at: nowIso,
    updated_at: nowIso,
  }
  if (postCancelAccessUntil !== undefined) {
    patch.post_cancel_access_until = postCancelAccessUntil
  }

  const { error: upErr } = await admin.from('billing_accounts').update(patch).eq('user_id', userId)
  if (upErr) {
    return { account: row as BillingAccountRow, synced: false }
  }

  const { data: fresh } = await admin.from('billing_accounts').select('*').eq('user_id', userId).maybeSingle()

  return { account: (fresh as BillingAccountRow | null) ?? (row as BillingAccountRow), synced: true }
}
