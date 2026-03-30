import 'server-only'
import { redirect } from 'next/navigation'
import { getBillingAccountForCurrentUser } from '@/lib/billing/supabaseBilling'
import { getBillingState, canAccessApp } from '@/lib/billing/state'
import type { BillingState } from '@/lib/billing/types'

/**
 * Zentrale Billing-Guard-Logik, um Bereiche später leicht zu sperren.
 * Nutzt die synchronisierte Supabase-Sicht (Stripe bleibt Source of Truth via Webhooks).
 */
export async function requireBillingAccess(): Promise<BillingState> {
  const { account } = await getBillingAccountForCurrentUser()
  const state = getBillingState({
    account,
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
  })

  if (!canAccessApp(state)) {
    redirect('/billing?blocked=1')
  }
  return state
}

