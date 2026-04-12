import { NextResponse } from 'next/server'

import {
  handlePublicDirectoryContactPost,
  type PublicDirectoryContactBody,
} from '@/lib/directory/contact/publicDirectoryContact.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: PublicDirectoryContactBody
  try {
    body = (await request.json()) as PublicDirectoryContactBody
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const result = await handlePublicDirectoryContactPost(body, request.headers)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
}
