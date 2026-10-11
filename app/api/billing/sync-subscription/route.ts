import { NextResponse } from 'next/server'
import { syncBillingSubscriptionFromStripeForUser } from '@/lib/billing/syncSubscriptionFromStripe.server'
import type { BillingAccountRow } from '@/lib/billing/types'
import { getSupabaseAndUser } from '@/lib/supabase-auth'

/**
 * Einmaliger Abgleich App-Abo ↔ Stripe (löst veralteten `past_due` in der DB nach erfolgreicher Zahlung).
 */
export async function POST() {
  // Cookie (PWA) + Bearer (Flutter)
  const { user } = await getSupabaseAndUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  try {
    const { account, synced } = await syncBillingSubscriptionFromStripeForUser(user.id)
    return NextResponse.json({
      account: account as BillingAccountRow | null,
      synced,
    })
  } catch (e) {
    console.warn('[billing/sync-subscription]', e)
    return NextResponse.json({ error: 'Abgleich fehlgeschlagen.' }, { status: 500 })
  }
}
