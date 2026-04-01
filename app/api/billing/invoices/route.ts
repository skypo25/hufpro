import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'
import { getStripe } from '@/lib/stripe/stripe'

export type BillingInvoiceRow = {
  id: string
  number: string | null
  status: string | null
  amountPaidCents: number
  currency: string
  createdUnix: number
  /** Stripe-hosted page (PDF-Download dort) — nicht auf AniDocs gespeichert */
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  await ensureBillingAccountRow({ userId: user.id, email: user.email })

  const { data: accountRow, error: accErr } = await supabaseAdmin
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (accErr) {
    return NextResponse.json({ error: 'Billing-Konto konnte nicht geladen werden.' }, { status: 500 })
  }

  const account = (accountRow as Pick<BillingAccountRow, 'stripe_customer_id'> | null) ?? null
  const customerId = account?.stripe_customer_id ?? null
  if (!customerId) {
    return NextResponse.json({ invoices: [] as BillingInvoiceRow[] })
  }

  const stripe = getStripe()
  try {
    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
    })
    const invoices: BillingInvoiceRow[] = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number ?? null,
      status: inv.status ?? null,
      amountPaidCents: inv.amount_paid ?? 0,
      currency: (inv.currency ?? 'eur').toLowerCase(),
      createdUnix: inv.created ?? 0,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdfUrl: inv.invoice_pdf ?? null,
    }))
    return NextResponse.json({ invoices })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Rechnungen konnten nicht geladen werden.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
