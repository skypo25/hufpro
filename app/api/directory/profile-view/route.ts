import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { classifyProfileViewReferrer } from '@/lib/directory/stats/classifyProfileViewReferrer'

function looksLikeBotUa(ua: string | null): boolean {
  if (!ua) return true
  const s = ua.toLowerCase()
  return (
    s.includes('bot') ||
    s.includes('crawl') ||
    s.includes('spider') ||
    s.includes('slurp') ||
    s.includes('facebookexternalhit') ||
    s.includes('preview')
  )
}

/**
 * Erhöht den Profilaufruf-Zähler für veröffentlichte Einträge (öffentliche Profilseite).
 * Aufruf per Client-Beacon; einfache Bot-Heuristik über User-Agent.
 */
export async function POST(request: Request) {
  const ua = request.headers.get('user-agent')
  if (looksLikeBotUa(ua)) {
    return new NextResponse(null, { status: 204 })
  }

  let body: { slug?: unknown; referrer?: unknown }
  try {
    body = (await request.json()) as { slug?: unknown; referrer?: unknown }
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const referrerFromBody = typeof body.referrer === 'string' ? body.referrer.trim() : ''
  const referrerHeader = request.headers.get('referer')?.trim() ?? ''
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: 'Profil fehlt.' }, { status: 400 })
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

  const combinedReferrer = referrerFromBody || referrerHeader || ''
  const source = classifyProfileViewReferrer(combinedReferrer || null)

  const { error: rpcErr } = await admin.rpc('directory_analytics_record_view', {
    p_profile_id: profileId,
    p_source: source,
  })

  if (rpcErr) {
    console.warn('[directory/profile-view]', rpcErr.message)
  }

  return new NextResponse(null, { status: 204 })
}
