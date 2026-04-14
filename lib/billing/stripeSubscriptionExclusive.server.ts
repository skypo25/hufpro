import 'server-only'

import type Stripe from 'stripe'
import { syncBillingSubscriptionFromStripeForUser } from '@/lib/billing/syncSubscriptionFromStripe.server'

/** Gleiche Priorität wie syncSubscriptionFromStripe (bestes „aktives“ Abo behalten). */
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

export type ExclusiveSubscriptionKind = 'app' | 'directory_premium' | 'other'

export function isLiveStripeSubscriptionStatus(status: string | undefined): boolean {
  const s = (status ?? '').toString()
  return s === 'active' || s === 'trialing' || s === 'past_due'
}

function itemPriceIds(sub: Stripe.Subscription): string[] {
  return sub.items.data
    .map((it) => it.price?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export function classifyExclusiveSubscription(sub: Stripe.Subscription): ExclusiveSubscriptionKind {
  const ids = itemPriceIds(sub)
  const appId = process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null
  const dirPrem = process.env.STRIPE_PRICE_ID_DIRECTORY_PREMIUM_MONTHLY?.trim() || null
  const top30 = process.env.STRIPE_PRICE_ID_DIRECTORY_TOP_PROFILE_30D?.trim() || null
  if (appId && ids.includes(appId)) return 'app'
  if ((dirPrem && ids.includes(dirPrem)) || (top30 && ids.includes(top30))) return 'directory_premium'
  return 'other'
}

export function pickPreferredSubscription(subs: Stripe.Subscription[]): Stripe.Subscription {
  if (subs.length === 0) {
    throw new Error('pickPreferredSubscription: empty')
  }
  return [...subs].sort((a, b) => {
    const ra = STATUS_RANK[(a.status ?? '').toString()] ?? 0
    const rb = STATUS_RANK[(b.status ?? '').toString()] ?? 0
    if (rb !== ra) return rb - ra
    return (b.created ?? 0) - (a.created ?? 0)
  })[0]
}

export async function listLiveSubscriptions(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = []
  for (const status of ['active', 'trialing', 'past_due'] as const) {
    const list = await stripe.subscriptions.list({ customer: customerId, status, limit: 100 })
    out.push(...list.data)
  }
  return out
}

async function cancelSubscriptions(stripe: Stripe, ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await stripe.subscriptions.cancel(id)
    } catch {
      /* bereits storniert / Race */
    }
  }
}

/**
 * Vor App-Checkout: Duplikate bereinigen, Premium→App-Upgrade erkennen.
 * - Live-App: nach Dedupe → blockiert (Nutzer hat bereits App-Abo).
 * - Live-Premium: ein Abo behalten, Upgrade per Price-Wechsel.
 * - Sonstiges Live-Abo: blockieren (manuelle Klärung).
 */
export async function prepareExclusiveAppSubscriptionCheckout(args: {
  stripe: Stripe
  customerId: string
  appPriceId: string
}): Promise<
  | { ok: true; action: 'new_checkout' }
  | { ok: false; code: 'already_app'; message: string }
  | { ok: false; code: 'unknown_subscription'; message: string }
  | { ok: true; action: 'upgrade_from_premium'; subscriptionId: string }
> {
  const live = await listLiveSubscriptions(args.stripe, args.customerId)
  const apps = live.filter((s) => classifyExclusiveSubscription(s) === 'app')
  const premiums = live.filter((s) => classifyExclusiveSubscription(s) === 'directory_premium')
  const others = live.filter((s) => classifyExclusiveSubscription(s) === 'other')

  if (apps.length > 0) {
    const keep = pickPreferredSubscription(apps)
    const cancelIds = apps.filter((s) => s.id !== keep.id).map((s) => s.id)
    await cancelSubscriptions(args.stripe, cancelIds)
    return {
      ok: false,
      code: 'already_app',
      message: 'Du hast bereits ein App-Abo.',
    }
  }

  if (premiums.length > 0) {
    const keep = pickPreferredSubscription(premiums)
    const cancelIds = premiums.filter((s) => s.id !== keep.id).map((s) => s.id)
    await cancelSubscriptions(args.stripe, cancelIds)
    return { ok: true, action: 'upgrade_from_premium', subscriptionId: keep.id }
  }

  if (others.length > 0) {
    return {
      ok: false,
      code: 'unknown_subscription',
      message:
        'Am Zahlungskonto ist ein weiteres Abo hinterlegt. Bitte wende dich an den Support, damit wir das für dich bereinigen können.',
    }
  }

  return { ok: true, action: 'new_checkout' }
}

/** Verzeichnis-Premium-Checkout: nicht starten, wenn schon ein App-Abo oder (bei Abo) schon Premium läuft. */
export async function assertCanStartDirectoryPremiumSubscriptionCheckout(args: {
  stripe: Stripe
  customerId: string
  /** true = Abo-Checkout (kein zweites Premium-Monatsabo). */
  isRecurringPremiumCheckout: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const live = await listLiveSubscriptions(args.stripe, args.customerId)
  const apps = live.filter((s) => classifyExclusiveSubscription(s) === 'app')
  if (apps.length > 0) {
    return {
      ok: false,
      message:
        'Du hast bereits ein App-Abo. Verzeichnis-Premium und App-Abo schließen sich aus — ein Wechsel ist über ein Upgrade zum App-Abo möglich.',
    }
  }
  if (args.isRecurringPremiumCheckout) {
    const premiums = live.filter((s) => classifyExclusiveSubscription(s) === 'directory_premium')
    if (premiums.length > 0) {
      return {
        ok: false,
        message: 'Dein Verzeichnis-Premium-Abo läuft bereits.',
      }
    }
  }
  return { ok: true }
}

/**
 * Ein gemeinsamer Ablauf für App-Monatsabo: ggf. Premium→App per Price-Wechsel, sonst Stripe Checkout.
 */
export async function runExclusiveAppSubscriptionCheckout(args: {
  stripe: Stripe
  customerId: string
  userId: string
  appPriceId: string
  upgradedRedirectUrl: string
  createCheckoutSession: () => Promise<Stripe.Response<Stripe.Checkout.Session>>
}): Promise<
  | { ok: true; url: string }
  | { ok: true; upgraded: true; redirect: string }
  | { ok: false; message: string; status: number }
> {
  const prep = await prepareExclusiveAppSubscriptionCheckout({
    stripe: args.stripe,
    customerId: args.customerId,
    appPriceId: args.appPriceId,
  })
  if (!prep.ok) {
    return { ok: false, message: prep.message, status: 409 }
  }
  if (prep.action === 'upgrade_from_premium') {
    try {
      const updated = await upgradePremiumSubscriptionToAppPrice({
        stripe: args.stripe,
        subscriptionId: prep.subscriptionId,
        appPriceId: args.appPriceId,
      })
      const st = (updated.status ?? '').toString()
      if (st === 'incomplete' || st === 'incomplete_expired' || st === 'unpaid') {
        return {
          ok: false,
          message:
            'Das Upgrade konnte nicht abgeschlossen werden (Zahlung ausstehend). Bitte hinterlege eine Zahlungsmethode oder kontaktiere den Support.',
          status: 402,
        }
      }
      await syncBillingSubscriptionFromStripeForUser(args.userId)
      return { ok: true, upgraded: true, redirect: args.upgradedRedirectUrl }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upgrade fehlgeschlagen.'
      return { ok: false, message: msg, status: 500 }
    }
  }
  const session = await args.createCheckoutSession()
  if (!session.url) {
    return { ok: false, message: 'Checkout konnte nicht gestartet werden.', status: 500 }
  }
  return { ok: true, url: session.url }
}

export async function upgradePremiumSubscriptionToAppPrice(args: {
  stripe: Stripe
  subscriptionId: string
  appPriceId: string
}): Promise<Stripe.Subscription> {
  const sub = await args.stripe.subscriptions.retrieve(args.subscriptionId, {
    expand: ['items.data.price'],
  })
  const items = sub.items.data
  if (items.length === 0) {
    throw new Error('Subscription ohne Positionen.')
  }
  const replaceItems: Stripe.SubscriptionUpdateParams['items'] = [
    ...items.map((it) => ({ id: it.id, deleted: true as const })),
    { price: args.appPriceId, quantity: 1 },
  ]
  const updated = await args.stripe.subscriptions.update(args.subscriptionId, {
    items: replaceItems,
    proration_behavior: 'create_prorations',
    payment_settings: { save_default_payment_method: 'on_subscription' },
  })
  return updated
}
