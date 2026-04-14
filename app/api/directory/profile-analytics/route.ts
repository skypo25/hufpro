import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

type Body = { slug?: unknown; event?: unknown }

/**
 * Öffentliche Profil-Interaktionen (Anruf-Link, Teilen) — kein Login, nur gültiges veröffentlichtes Profil.
 */
export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const event = typeof body.event === 'string' ? body.event.trim() : ''
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Profil fehlt.' }, { status: 400 })
  }
  if (event !== 'phone_click' && event !== 'share') {
    return NextResponse.json({ error: 'Unbekanntes Ereignis.' }, { status: 400 })
  }

  let admin: ReturnType<typeof createSupabaseServiceRoleClient>
  try {
    admin = createSupabaseServiceRoleClient()
  } catch {
    return NextResponse.json({ error: 'Konfiguration fehlt.' }, { status: 500 })
  }

  const { data: row, error: profErr } = await admin
    .from('directory_profiles')
    .select('id, listing_status')
    .eq('slug', slug)
    .maybeSingle()

  if (profErr || !row) {
    return new NextResponse(null, { status: 204 })
  }

  const listing = (row as { listing_status?: string }).listing_status
  if (listing !== 'published') {
    return new NextResponse(null, { status: 204 })
  }

  const profileId = (row as { id: string }).id
  const rpcName =
    event === 'phone_click' ? 'directory_analytics_record_phone_click' : 'directory_analytics_record_share_click'

  const { error: rpcErr } = await admin.rpc(rpcName, { p_profile_id: profileId })
  if (rpcErr) {
    console.warn('[directory/profile-analytics]', rpcErr.message)
  }

  return new NextResponse(null, { status: 204 })
}
