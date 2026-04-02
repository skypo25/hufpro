import type Stripe from 'stripe'

/**
 * Liefert clientSecret für Embedded Checkout (PaymentElement / SetupElement).
 * Deckt Fälle ab, in denen expand in der Subscription nicht greift (IDs statt Objekte).
 */
export async function resolveSubscriptionPaymentSecrets(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<{ clientSecret: string; intentType: 'payment' | 'setup' } | null> {
  const pending = subscription.pending_setup_intent
  if (pending) {
    if (typeof pending === 'string') {
      const si = await stripe.setupIntents.retrieve(pending)
      if (si.client_secret) return { clientSecret: si.client_secret, intentType: 'setup' }
    } else if (pending.client_secret) {
      return { clientSecret: pending.client_secret, intentType: 'setup' }
    }
  }

  const resolveFromInvoice = async (inv: Stripe.Invoice | string): Promise<{ clientSecret: string; intentType: 'payment' } | null> => {
    const invoice =
      typeof inv === 'string'
        ? await stripe.invoices.retrieve(inv, { expand: ['payment_intent'] })
        : inv

    let pi = invoice.payment_intent
    if (typeof pi === 'string') {
      const retrieved = await stripe.paymentIntents.retrieve(pi)
      if (retrieved.client_secret) return { clientSecret: retrieved.client_secret, intentType: 'payment' }
      return null
    }
    if (pi && typeof pi === 'object' && 'client_secret' in pi && pi.client_secret) {
      return { clientSecret: pi.client_secret, intentType: 'payment' }
    }
    return null
  }

  if (subscription.latest_invoice) {
    const s = await resolveFromInvoice(subscription.latest_invoice as Stripe.Invoice | string)
    if (s) return s
  }

  const list = await stripe.invoices.list({ subscription: subscription.id, limit: 10 })
  for (const inv of list.data) {
    const s = await resolveFromInvoice(inv.id)
    if (s) return s
  }

  return null
}

/** App-interne Testphase (trial_ends_at) ist vorbei. */
export function isAppTrialEnded(trialEndsAtIso: string | null | undefined): boolean {
  if (!trialEndsAtIso) return false
  const d = new Date(trialEndsAtIso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() <= Date.now() - 60_000
}
