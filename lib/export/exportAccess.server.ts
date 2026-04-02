import 'server-only'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { canAccessApp, getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'

export async function requireExportAccess(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 }) }
  }

  const { data: row, error } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Billing-Status konnte nicht geladen werden.' }, { status: 500 }),
    }
  }

  const state = getBillingState({
    account: (row as BillingAccountRow | null) ?? null,
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
  })

  if (!canAccessApp(state)) {
    return { ok: false, response: NextResponse.json({ error: 'Kein Zugriff auf den Export.' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}
