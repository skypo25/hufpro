import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { requireEnv } from '@/lib/env'
import { getAppUrl, getStripe } from '@/lib/stripe/stripe'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const priceId = requireEnv('STRIPE_PRICE_ID_MONTHLY')
  const appUrl = getAppUrl()

  const supabaseAdmin = createSupabaseServiceRoleClient()

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

  const stripe = getStripe()

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

  const trialEndsAt = account?.trial_ends_at ? new Date(account.trial_ends_at) : null
  const now = Date.now()
  const trialEndUnix =
    trialEndsAt && !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt.getTime() > now + 60_000
      ? Math.floor(trialEndsAt.getTime() / 1000)
      : undefined

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?canceled=1`,
    subscription_data: trialEndUnix ? { trial_end: trialEndUnix } : undefined,
    metadata: { supabase_user_id: user.id },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Checkout konnte nicht gestartet werden.' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}

