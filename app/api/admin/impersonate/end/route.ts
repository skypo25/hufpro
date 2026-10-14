import { NextResponse } from 'next/server'
import { prepareEndImpersonation, setImpersonationExchangeCookie } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/** Beendet Support-Ansicht und stellt die Admin-Session wieder her. */
export async function POST(request: Request) {
  let result: Awaited<ReturnType<typeof prepareEndImpersonation>>
  try {
    result = await prepareEndImpersonation()
  } catch {
    return NextResponse.redirect(new URL('/login?hint=impersonation_ended', request.url), 303)
  }

  if (!result.ok) {
    return NextResponse.redirect(new URL(result.redirectTo, request.url), 303)
  }

  await setImpersonationExchangeCookie({
    tokenHash: result.tokenHash,
    next: result.next,
  })

  return NextResponse.redirect(new URL('/auth/impersonate', request.url), 303)
}
