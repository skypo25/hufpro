import { NextResponse } from 'next/server'
import { consumeImpersonationExchange } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Einmaliger Abruf des token_hash aus dem httpOnly Exchange-Cookie.
 * Kein Query-String — Token landet nicht in History/Referrer.
 */
export async function POST() {
  try {
    const payload = await consumeImpersonationExchange()
    if (!payload) {
      return NextResponse.json({ error: 'exchange_missing_or_expired' }, { status: 400 })
    }
    return NextResponse.json({
      tokenHash: payload.tokenHash,
      next: payload.next,
    })
  } catch {
    return NextResponse.json({ error: 'exchange_failed' }, { status: 500 })
  }
}
