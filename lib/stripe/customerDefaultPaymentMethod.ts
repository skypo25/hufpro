import type Stripe from 'stripe'

/** Ermittelt eine Zahlungsmethode für Abbuchungen (Default → erste am Kunden). */
export async function getCustomerDefaultPaymentMethodId(
  stripe: Stripe,
  customerId: string
): Promise<string | null> {
  try {
    const cust = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    })
    const dpm = (cust as Stripe.Customer).invoice_settings?.default_payment_method
    if (typeof dpm === 'string') return dpm
    if (dpm && typeof dpm === 'object' && 'id' in dpm && typeof (dpm as Stripe.PaymentMethod).id === 'string') {
      return (dpm as Stripe.PaymentMethod).id
    }
  } catch {
    // ignore
  }
  try {
    const list = await stripe.paymentMethods.list({ customer: customerId, limit: 5 })
    return list.data[0]?.id ?? null
  } catch {
    return null
  }
}

/**
 * Versucht, ein offenes Abo mit bereits hinterlegter Zahlungsmethode abzuschließen
 * (z. B. nach SetupIntent + Subscription ohne sofortige Zahlung).
 */
export async function tryFinalizeSubscriptionWithDefaultPaymentMethod(
  stripe: Stripe,
  customerId: string,
  subscription: Stripe.Subscription
): Promise<Stripe.Subscription | null> {
  const st = (subscription.status ?? '').toString()
  if (!['incomplete', 'unpaid', 'past_due'].includes(st)) return null

  const pmId = await getCustomerDefaultPaymentMethodId(stripe, customerId)
  if (!pmId) return null

  await stripe.subscriptions.update(subscription.id, {
    default_payment_method: pmId,
  })

  const li = subscription.latest_invoice
  const invId = typeof li === 'string' ? li : li?.id
  if (!invId) {
    return stripe.subscriptions.retrieve(subscription.id, {
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
    })
  }

  let inv = await stripe.invoices.retrieve(invId)
  if (inv.status === 'draft') {
    await stripe.invoices.finalizeInvoice(invId)
    inv = await stripe.invoices.retrieve(invId)
  }
  if (inv.status === 'open') {
    try {
      await stripe.invoices.pay(invId, { payment_method: pmId })
    } catch {
      return null
    }
  }

  return stripe.subscriptions.retrieve(subscription.id, {
    expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
  })
}
