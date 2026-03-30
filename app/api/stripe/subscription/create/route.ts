import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { requireEnv } from '@/lib/env'
import { getStripe } from '@/lib/stripe/stripe'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'
import { buildIdempotencyKey } from '@/lib/stripe/idempotency'

function trialEndUnixFromIso(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const now = Date.now()
  if (d.getTime() <= now + 60_000) return undefined
  return Math.floor(d.getTime() / 1000)
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { paymentMethodId } = (await request.json().catch(() => ({}))) as {
    paymentMethodId?: string
  }
  if (!paymentMethodId || typeof paymentMethodId !== 'string') {
    return NextResponse.json({ error: 'paymentMethodId fehlt.' }, { status: 400 })
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
  if (status === 'active') {
    return NextResponse.json({ error: 'Abo ist bereits aktiv.' }, { status: 409 })
  }

  const customerId = account?.stripe_customer_id ?? null
  if (!customerId) {
    return NextResponse.json({ error: 'Stripe-Kunde fehlt.' }, { status: 500 })
  }

  // Hard guard: if we already have a subscription id, do not create another one.
  const existingSubId = account?.stripe_subscription_id ?? null
  if (existingSubId) {
    try {
      const sub = await stripe.subscriptions.retrieve(existingSubId)
      const s = (sub.status ?? '').toString()
      if (s && s !== 'canceled' && s !== 'incomplete_expired' && s !== 'unpaid') {
        return NextResponse.json({ subscriptionId: sub.id, status: sub.status })
      }
    } catch {
      // ignore, proceed to create below
    }
  }

  // Attach PM to customer if needed
  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
  } catch {
    // ignore if already attached
  }

  const trialEnd = trialEndUnixFromIso(account?.trial_ends_at ?? null)

  const idempotencyKey = buildIdempotencyKey([
    'subscription_create_v1',
    user.id,
    customerId,
    priceId,
    trialEnd ?? 'no_trial',
  ])

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_end: trialEnd,
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: { supabase_user_id: user.id },
    },
    { idempotencyKey }
  )

  const { error: saveErr } = await supabaseAdmin
    .from('billing_accounts')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status ?? null,
      subscription_price_id: priceId,
      subscription_current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : (account?.trial_ends_at ?? null),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (saveErr) {
    return NextResponse.json({ error: 'Subscription konnte nicht gespeichert werden.' }, { status: 500 })
  }

  return NextResponse.json({
    subscriptionId: subscription.id,
    status: subscription.status,
  })
}

