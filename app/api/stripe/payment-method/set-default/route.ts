import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { getStripe } from '@/lib/stripe/stripe'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'
import { buildIdempotencyKey } from '@/lib/stripe/idempotency'

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
  const customerId = account?.stripe_customer_id ?? null
  if (!customerId) {
    return NextResponse.json({ error: 'Stripe-Kunde fehlt.' }, { status: 500 })
  }

  // Attach to customer (no-op if already attached)
  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
  } catch {
    // ignore
  }

  const idem = buildIdempotencyKey(['pm_set_default_v1', user.id, customerId, paymentMethodId])

  // Set customer default for future invoices
  await stripe.customers.update(
    customerId,
    { invoice_settings: { default_payment_method: paymentMethodId } },
    { idempotencyKey: idem }
  )

  // If there is an active-ish subscription, set subscription default too
  const subId = account?.stripe_subscription_id ?? null
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      const s = (sub.status ?? '').toString()
      if (s && s !== 'canceled' && s !== 'incomplete_expired') {
        await stripe.subscriptions.update(
          subId,
          { default_payment_method: paymentMethodId },
          { idempotencyKey: buildIdempotencyKey([idem, 'sub', subId]) }
        )
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true })
}

