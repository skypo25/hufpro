import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { getOptionalEnv, requireEnv } from '@/lib/env'
import { getStripe } from '@/lib/stripe/stripe'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'

function parsePaymentMethodTypes(): string[] {
  const raw = getOptionalEnv('STRIPE_SETUP_PAYMENT_METHOD_TYPES')
  const list = (raw ?? 'card,sepa_debit')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const unique = Array.from(new Set(list))
  return unique.length > 0 ? unique : ['card']
}

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Keep price env check here so misconfig surfaces early in billing.
  requireEnv('STRIPE_PRICE_ID_MONTHLY')

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

  // SetupIntents should be fresh to avoid stale/consumed client_secrets
  // (Stripe Elements can fail to load when reusing an old/used SetupIntent).
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: parsePaymentMethodTypes(),
    usage: 'off_session',
    metadata: { supabase_user_id: user.id },
  })

  if (!setupIntent.client_secret) {
    return NextResponse.json({ error: 'Zahlung konnte nicht initialisiert werden.' }, { status: 500 })
  }

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    intentType: 'setup' as const,
    customerId,
  })
}

