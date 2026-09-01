import 'server-only'
import { redirect } from 'next/navigation'
import { isAdminUserId } from '@/lib/admin/config'
import { getBillingAccountForCurrentUser } from '@/lib/billing/supabaseBilling'
import { getBillingState, canAccessApp } from '@/lib/billing/state'
import type { BillingState } from '@/lib/billing/types'

/**
 * Zentrale Billing-Guard-Logik für Seiten (Redirect).
 * Für APIs bitte {@link requireAppAccess} aus `@/lib/billing/requireAppAccess` nutzen.
 */
export async function requireBillingAccess(): Promise<BillingState> {
  const { userId, account } = await getBillingAccountForCurrentUser()
  const state = getBillingState({
    account,
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
  })

  if (isAdminUserId(userId)) {
    return state
  }

  if (!canAccessApp(state)) {
    redirect('/billing?blocked=1')
  }
  return state
}

