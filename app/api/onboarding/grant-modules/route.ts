import { NextResponse } from 'next/server'
import { getSupabaseAndUser } from '@/lib/supabase-auth'
import { grantModulesFromOnboardingOnce } from '@/lib/modules/entitlements.server'
import { MODULE_CATALOG } from '@/lib/modules/catalog'

export const dynamic = 'force-dynamic'

/**
 * Einmalige Modulfreischaltung nach Onboarding.
 * Idempotent — erneuter Aufruf vergibt keine zusätzlichen Rechte.
 * Auth: Cookie (PWA) oder Bearer (Flutter).
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAndUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const professions =
    typeof body === 'object' && body !== null && 'professions' in body
      ? (body as { professions: unknown }).professions
      : null

  // Fallback: aus user_settings lesen
  let professionsValue = professions
  if (professionsValue == null) {
    const { data } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
    const settings = (data?.settings ?? {}) as Record<string, unknown>
    professionsValue = settings.profession
  }

  try {
    const result = await grantModulesFromOnboardingOnce({
      userId: user.id,
      professions: professionsValue,
    })
    const labels = result.granted.map((id) => MODULE_CATALOG[id]?.label ?? id)
    return NextResponse.json({
      ok: true,
      granted: result.granted,
      grantedLabels: labels,
      skipped: result.skipped,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Freischaltung fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
