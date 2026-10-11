import { NextResponse } from 'next/server'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import type { BillingAccountRow } from '@/lib/billing/types'
import { getSupabaseAndUser } from '@/lib/supabase-auth'

export async function GET() {
  // Cookie (PWA) + Bearer (Flutter)
  const { user, supabase } = await getSupabaseAndUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { data: row1, error: err1 } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()

  if (err1) {
    return NextResponse.json({ error: 'Billing-Daten konnten nicht geladen werden.' }, { status: 500 })
  }

  if (row1) {
    return NextResponse.json({ account: row1 as BillingAccountRow })
  }

  await ensureBillingAccountRow({ userId: user.id, email: user.email })

  const { data: row2, error } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Billing-Daten konnten nicht geladen werden.' }, { status: 500 })
  }

  return NextResponse.json({ account: (row2 as BillingAccountRow | null) ?? null })
}

