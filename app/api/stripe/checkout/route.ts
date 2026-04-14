import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { requireEnv } from '@/lib/env'
import { runExclusiveAppSubscriptionCheckout } from '@/lib/billing/stripeSubscriptionExclusive.server'
import { getAppUrl, getStripe } from '@/lib/stripe/stripe'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'

type CheckoutBody = {
  /** Nach erfolgreichem Checkout: Billing (Standard) oder Verzeichnis-App-Einstieg. */
  successPath?: 'billing' | 'app_starten'
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let successPath: CheckoutBody['successPath'] = 'billing'
  try {
    const raw = (await request.json()) as unknown
    if (raw && typeof raw === 'object' && raw !== null) {
      const sp = (raw as CheckoutBody).successPath
      if (sp === 'app_starten') successPath = 'app_starten'
    }
  } catch {
    /* leerer Body: Standard Billing */
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

  const successUrl =
    successPath === 'app_starten'
      ? `${appUrl}/behandler/app-starten?checkout=success`
      : `${appUrl}/billing?success=1`
  const cancelUrl =
    successPath === 'app_starten'
      ? `${appUrl}/behandler/app-starten?checkout=canceled`
      : `${appUrl}/billing?canceled=1`

  const upgradedRedirect =
    successPath === 'app_starten'
      ? `${appUrl}/behandler/app-starten?checkout=success&upgraded=1`
      : `${appUrl}/billing?success=1&upgraded=1`

  const result = await runExclusiveAppSubscriptionCheckout({
    stripe,
    customerId,
    userId: user.id,
    appPriceId: priceId,
    upgradedRedirectUrl: upgradedRedirect,
    createCheckoutSession: () =>
      stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: trialEndUnix ? { trial_end: trialEndUnix } : undefined,
        metadata: { supabase_user_id: user.id },
      }),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }
  if ('upgraded' in result && result.upgraded) {
    return NextResponse.json({ upgraded: true as const, redirect: result.redirect })
  }
  return NextResponse.json({ url: result.url })
}

