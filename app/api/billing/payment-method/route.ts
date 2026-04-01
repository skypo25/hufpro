import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow, PaymentMethodSummary } from '@/lib/billing/types'
import { getStripe } from '@/lib/stripe/stripe'

function toSummary(pm: any): PaymentMethodSummary | null {
  if (!pm || typeof pm !== 'object') return null
  if (pm.type === 'card' && pm.card) {
    return {
      kind: 'card',
      brand: (pm.card.brand as string | null) ?? null,
      last4: (pm.card.last4 as string | null) ?? null,
      expMonth: (pm.card.exp_month as number | null) ?? null,
      expYear: (pm.card.exp_year as number | null) ?? null,
    }
  }
  if (pm.type === 'sepa_debit' && pm.sepa_debit) {
    return {
      kind: 'sepa_debit',
      last4: (pm.sepa_debit.last4 as string | null) ?? null,
      bankCode: (pm.sepa_debit.bank_code as string | null) ?? null,
    }
  }
  if (typeof pm.type === 'string') {
    return { kind: 'unknown', label: pm.type }
  }
  return null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
  const customerId = account?.stripe_customer_id ?? null
  if (!customerId) {
    return NextResponse.json({ paymentMethod: null })
  }

  const stripe = getStripe()

  let paymentMethodId: string | null = null
  const subId = account?.stripe_subscription_id ?? null
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId, {
        expand: ['default_payment_method'],
      })
      const dpm = (sub.default_payment_method as any) ?? null
      if (typeof dpm === 'string') paymentMethodId = dpm
      else if (dpm && typeof dpm.id === 'string') paymentMethodId = dpm.id
    } catch {
      // ignore
    }
  }

  if (!paymentMethodId) {
    try {
      const cust = await stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      })
      const dpm = (cust as any).invoice_settings?.default_payment_method ?? null
      if (typeof dpm === 'string') paymentMethodId = dpm
      else if (dpm && typeof dpm.id === 'string') paymentMethodId = dpm.id
    } catch {
      // ignore
    }
  }

  // Nach SetupIntent ist die Karte oft nur angehängt, aber noch nicht als Default gesetzt.
  if (!paymentMethodId) {
    try {
      const attached = await stripe.paymentMethods.list({
        customer: customerId,
        limit: 5,
      })
      const first = attached.data?.[0]
      if (first?.id) paymentMethodId = first.id
    } catch {
      // ignore
    }
  }

  if (!paymentMethodId) {
    return NextResponse.json({ paymentMethod: null })
  }

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    const summary = toSummary(pm)
    return NextResponse.json({ paymentMethod: summary })
  } catch {
    // Fallback: pick the most recent PM if default cannot be retrieved
    try {
      const cards = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
      if (cards.data?.[0]) {
        return NextResponse.json({ paymentMethod: toSummary(cards.data[0]) })
      }
      const sep = await stripe.paymentMethods.list({ customer: customerId, type: 'sepa_debit', limit: 1 })
      if (sep.data?.[0]) {
        return NextResponse.json({ paymentMethod: toSummary(sep.data[0]) })
      }
    } catch {
      // ignore
    }
    return NextResponse.json({ paymentMethod: null })
  }
}

