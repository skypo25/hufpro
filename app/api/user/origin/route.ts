import { NextResponse } from 'next/server'
import { requireUserSession } from '@/lib/auth/requireUserSession.server'

const PHOTON_URL = 'https://photon.komoot.io/api'

/**
 * Liefert die Koordinaten des Betriebsstandorts (aus Einstellungen) für Entfernungsberechnung.
 * Wird von der Adress-Autovervollständigung genutzt, um "ca. X km" anzuzeigen.
 */
export async function GET() {
  const session = await requireUserSession()
  if (!session.ok) return session.response
  const { user, supabase } = session

  const { data: row } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const s = (row?.settings ?? {}) as { street?: string; zip?: string; city?: string }
  const parts = [s.street, s.zip, s.city].filter(Boolean) as string[]
  const query = parts.join(', ')
  if (!query.trim()) return NextResponse.json({ lat: null, lon: null })

  try {
    const params = new URLSearchParams({ q: query, limit: '1', lang: 'de' })
    const res = await fetch(`${PHOTON_URL}?${params}`)
    const data = await res.json()
    const feature = data?.features?.[0]
    const [lon, lat] = feature?.geometry?.coordinates ?? []
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json({ lat: null, lon: null })
    }
    return NextResponse.json({ lat, lon })
  } catch {
    return NextResponse.json({ lat: null, lon: null })
  }
}
