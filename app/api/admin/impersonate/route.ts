import { NextResponse } from 'next/server'
import { prepareImpersonation } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Startet Impersonation und redirected auf /auth/impersonate (Session-Wechsel).
 * Formulare nutzen target="_blank", damit der Admin-Tab sichtbar bleibt.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const userId = String(form?.get('userId') ?? '').trim()
  const result = await prepareImpersonation(userId)

  if (!result.ok) {
    return NextResponse.redirect(new URL(result.redirectTo, request.url), 303)
  }

  const dest = new URL('/auth/impersonate', request.url)
  dest.searchParams.set('token_hash', result.tokenHash)
  return NextResponse.redirect(dest, 303)
}
