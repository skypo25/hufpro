import { NextResponse } from 'next/server'
import { prepareImpersonation, setImpersonationExchangeCookie } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Startet Impersonation. token_hash wandert nur im httpOnly Exchange-Cookie, nicht in der URL.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const userId = String(form?.get('userId') ?? '').trim()

  let result: Awaited<ReturnType<typeof prepareImpersonation>>
  try {
    result = await prepareImpersonation(userId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Impersonation fehlgeschlagen'
    return NextResponse.redirect(
      new URL(`/admin/users/${userId || ''}?err=impersonate&msg=${encodeURIComponent(msg.slice(0, 120))}`, request.url),
      303
    )
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
