import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { grantModulesFromOnboardingOnce } from '@/lib/modules/entitlements.server'

/**
 * Einmalige Modulfreischaltung nach Onboarding.
 * Idempotent — erneuter Aufruf vergibt keine zusätzlichen Rechte.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    return NextResponse.json({
      ok: true,
      granted: result.granted,
      skipped: result.skipped,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Freischaltung fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
