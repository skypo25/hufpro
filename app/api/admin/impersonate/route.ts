import { NextResponse } from 'next/server'
import { prepareImpersonation } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Startet Impersonation und redirected auf den Magic-Link.
 * Formulare nutzen target="_blank", damit die Admin-Ansicht im ursprünglichen Tab bleibt.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const userId = String(form?.get('userId') ?? '').trim()
  const result = await prepareImpersonation(userId)

  if (!result.ok) {
    return NextResponse.redirect(new URL(result.redirectTo, request.url), 303)
  }

  return NextResponse.redirect(result.actionLink, 303)
}
