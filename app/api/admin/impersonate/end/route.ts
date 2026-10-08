import { NextResponse } from 'next/server'
import { prepareEndImpersonation } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/** Beendet Support-Ansicht und stellt die Admin-Session wieder her. */
export async function POST(request: Request) {
  const result = await prepareEndImpersonation()

  if (!result.ok) {
    return NextResponse.redirect(new URL(result.redirectTo, request.url), 303)
  }

  const dest = new URL('/auth/impersonate', request.url)
  dest.searchParams.set('token_hash', result.tokenHash)
  dest.searchParams.set('next', result.next)
  return NextResponse.redirect(dest, 303)
}
