import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { requireEnv } from '@/lib/env'
import { getStripe } from '@/lib/stripe/stripe'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'
import type Stripe from 'stripe'
import { buildIdempotencyKey } from '@/lib/stripe/idempotency'
import {
  isAppTrialEnded,
  resolveSubscriptionPaymentSecrets,
} from '@/lib/stripe/subscriptionPaymentSecrets'

function trialEndUnixFromIso(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const now = Date.now()
  if (d.getTime() <= now + 60_000) return undefined
  return Math.floor(d.getTime() / 1000)
}

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const priceId = requireEnv('STRIPE_PRICE_ID_MONTHLY')
  const supabaseAdmin = createSupabaseServiceRoleClient()
  const stripe = getStripe()

  await ensureBillingAccountRow({ userId: user.id, email: user.email })

  const { data: accountRow, error: accErr } = await supabaseAdmin
    .from('billing_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (accErr) {
    return NextResponse.json({ error: 'Billing-Konto konnte nicht geladen werden.' }, { status: 500 })
  }

  const account = (accountRow as BillingAccountRow | null) ?? null
  const status = (account?.subscription_status ?? null)?.toString() ?? 'none'
  const appTrialEnded = isAppTrialEnded(account?.trial_ends_at ?? null)
  /** Stripe „trialing“ blockt nur, solange die App-Testphase noch läuft — sonst Zahlung nach Ablauf ermöglichen. */
  const blockAsAlreadyCovered =
    status === 'active' || (status === 'trialing' && !appTrialEnded)
  if (blockAsAlreadyCovered) {
    return NextResponse.json({ error: 'Ihr Abo ist bereits aktiv oder in der Testphase.' }, { status: 409 })
  }

  let customerId = account?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    const { error: upErr } = await supabaseAdmin
      .from('billing_accounts')
      .update({
        stripe_customer_id: customerId,
        billing_email: user.email ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    if (upErr) {
      return NextResponse.json({ error: 'Stripe-Kunde konnte nicht gespeichert werden.' }, { status: 500 })
    }
  }

  let subscription: Stripe.Subscription | null = null
  const existingSubId = account?.stripe_subscription_id ?? null
  if (existingSubId) {
    try {
      subscription = await stripe.subscriptions.retrieve(existingSubId, {
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      })
    } catch {
      subscription = null
    }
  }

  if (subscription && appTrialEnded && subscription.status === 'trialing') {
    await stripe.subscriptions.update(subscription.id, { trial_end: 'now' })
    subscription = await stripe.subscriptions.retrieve(subscription.id, {
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
    })
  }

  // If no usable subscription exists, create one (default_incomplete so we can collect payment method in-app).
  if (!subscription || ['canceled', 'unpaid', 'incomplete_expired'].includes((subscription.status ?? '').toString())) {
    const trialEnd = trialEndUnixFromIso(account?.trial_ends_at ?? null)

    const idempotencyKey = buildIdempotencyKey([
      'subscription_prepare_v1',
      user.id,
      customerId,
      priceId,
      trialEnd ?? 'no_trial',
    ])

    subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        trial_end: trialEnd,
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        metadata: { supabase_user_id: user.id },
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      },
      { idempotencyKey }
    )
  }

  let secrets = await resolveSubscriptionPaymentSecrets(stripe, subscription as Stripe.Subscription)
  if (!secrets) {
    subscription = await stripe.subscriptions.retrieve((subscription as Stripe.Subscription).id, {
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
    })
    secrets = await resolveSubscriptionPaymentSecrets(stripe, subscription)
  }
  if (!secrets) {
    const st = (subscription?.status ?? '').toString()
    if (st === 'active' || st === 'trialing') {
      return NextResponse.json(
        {
          error:
            'Für Ihr Konto ist kein weiterer Zahlungsschritt nötig. Bitte laden Sie die Seite neu oder öffnen Sie das Stripe-Kundenportal.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Zahlung konnte nicht initialisiert werden.' }, { status: 500 })
  }

  const { error: saveErr } = await supabaseAdmin
    .from('billing_accounts')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status ?? 'incomplete',
      subscription_price_id: priceId,
      subscription_current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : (account?.trial_ends_at ?? null),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (saveErr) {
    return NextResponse.json({ error: 'Subscription konnte nicht gespeichert werden.' }, { status: 500 })
  }

  return NextResponse.json({
    clientSecret: secrets.clientSecret,
    intentType: secrets.intentType,
    subscriptionId: subscription.id,
    customerId,
  })
}

