import AppLayoutClient from '@/components/AppLayoutClient'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let readOnlyBanner: { graceEndsAtIso: string } | null = null
  let accessScope: 'app' | 'directory_only' = 'app'
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: scopeRow } = await supabase
      .from('directory_user_access')
      .select('access_scope')
      .eq('user_id', user.id)
      .maybeSingle()
    if ((scopeRow?.access_scope as string | null | undefined) === 'directory_only') {
      accessScope = 'directory_only'
    }

    const { data: row } = await supabase
      .from('billing_accounts')
      .select(BILLING_ACCOUNT_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()
    const state = getBillingState({
      account: (row as BillingAccountRow | null) ?? null,
      priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
    })
    if (state.access.mode === 'read_only' && state.access.graceEndsAt) {
      readOnlyBanner = { graceEndsAtIso: state.access.graceEndsAt.toISOString() }
    }
  }

  return (
    <AppLayoutClient accessScope={accessScope} readOnlyBanner={readOnlyBanner}>
      {children}
    </AppLayoutClient>
  )
}