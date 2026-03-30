import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import type { BillingAccountRow } from '@/lib/billing/types'
import BillingPageClient from '@/components/billing/BillingPageClient'

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: row1, error: row1Err } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()

  let initError: string | null = null
  let account = (row1 as BillingAccountRow | null) ?? null

  if (row1Err) {
    initError = `Billing-Daten konnten nicht geladen werden: ${row1Err.message}`
  } else if (!row1) {
    try {
      await ensureBillingAccountRow({ userId: user.id, email: user.email })
    } catch (e) {
      initError = e instanceof Error ? e.message : 'Billing-Konto konnte nicht initialisiert werden.'
    }
    if (!initError) {
      const { data: row2, error: row2Err } = await supabase
        .from('billing_accounts')
        .select(BILLING_ACCOUNT_COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle()
      account = (row2 as BillingAccountRow | null) ?? null
      if (row2Err) {
        initError = `Billing-Daten konnten nicht geladen werden: ${row2Err.message}`
      }
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Billing</span>
      </div>

      <div>
        <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">
          Billing
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Verwalten Sie Ihr Abo, Rechnungen und Zahlungsdaten sicher über Stripe.
        </p>
      </div>

      <BillingPageClient
        account={account}
        priceIdMonthly={process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null}
        loadError={initError ?? undefined}
        stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null}
      />
    </div>
  )
}

