import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Profil anlegen – anidocs',
  description: 'Weiterleitung zum Profil-Assistenten.',
}

function normalizePaket(raw: string | string[] | undefined): 'gratis' | 'premium' {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toLowerCase() ?? ''
  if (v === 'premium') return 'premium'
  return 'gratis'
}

/**
 * Kanonischer Profil-Wizard: `/directory/mein-profil` (nach Paketwahl → Registrierung → Login).
 * Diese URL bleibt für alte Links und leitet mit gleicher Query weiter.
 */
export default async function DirectoryProfileCreateRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const paketRaw = (Array.isArray(sp.paket) ? sp.paket[0] : sp.paket)?.toString().trim().toLowerCase() ?? ''
  if (paketRaw === 'app') {
    redirect('/behandler/app-starten')
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const paket = normalizePaket(sp.paket)
    const authErrRaw = (Array.isArray(sp.auth_error) ? sp.auth_error[0] : sp.auth_error)?.toString().trim() ?? ''
    const q = new URLSearchParams({ paket })
    if (authErrRaw === '1') q.set('auth_error', '1')
    redirect(`/behandler/profil/registrieren?${q.toString()}`)
  }

  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue
    if (Array.isArray(val)) val.forEach((v) => qs.append(key, String(v)))
    else qs.set(key, String(val))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/directory/mein-profil${suffix}`)
}
