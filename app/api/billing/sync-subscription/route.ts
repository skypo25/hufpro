import { NextResponse } from 'next/server'
import { requireUserSession } from '@/lib/auth/requireUserSession.server'
import { syncBillingSubscriptionFromStripeForUser } from '@/lib/billing/syncSubscriptionFromStripe.server'
import type { BillingAccountRow } from '@/lib/billing/types'

/**
 * Einmaliger Abgleich App-Abo ↔ Stripe (löst veralteten `past_due` in der DB nach erfolgreicher Zahlung).
 */
export async function POST() {
  const session = await requireUserSession()
  if (!session.ok) return session.response

  try {
    const { account, synced } = await syncBillingSubscriptionFromStripeForUser(session.user.id)
    return NextResponse.json({
      account: account as BillingAccountRow | null,
      synced,
    })
  } catch (e) {
    console.warn('[billing/sync-subscription]', e)
    return NextResponse.json({ error: 'Abgleich fehlgeschlagen.' }, { status: 500 })
  }
}
