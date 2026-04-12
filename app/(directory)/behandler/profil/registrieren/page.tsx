import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { DirectoryVerzeichnisRegisterClient } from '@/components/directory/onboarding/DirectoryVerzeichnisRegisterClient'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { directoryProfileWizardHref } from '@/lib/directory/public/appBaseUrl'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Zugang fürs Verzeichnis – anidocs',
  description: 'Kompakter Einstieg: Zugang anlegen, danach Profil im Verzeichnis vervollständigen.',
}

function normalizePaket(raw: string | string[] | undefined): 'gratis' | 'premium' {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toLowerCase() ?? ''
  if (v === 'premium') return 'premium'
  return 'gratis'
}

export default async function DirectoryProfileRegisterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const paketRaw = (Array.isArray(sp.paket) ? sp.paket[0] : sp.paket)?.toString().trim().toLowerCase() ?? ''
  if (paketRaw === 'app') {
    redirect('/behandler/app-starten')
  }

  const paket = normalizePaket(sp.paket)

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(directoryProfileWizardHref({ paket }))
  }

  return (
    <Suspense
      fallback={
        <div className="dir-vz-reg-page">
          <div className="mx-auto max-w-[480px] px-4 py-16 text-center text-[15px] text-[#6b7280]">Laden…</div>
        </div>
      }
    >
      <DirectoryVerzeichnisRegisterClient paket={paket} />
    </Suspense>
  )
}
