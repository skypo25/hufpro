'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import {
  AUTH_RETURN_SESSION_KEY,
  DIRECTORY_WIZARD_PAKET_SESSION_KEY,
  safeInternalPath,
} from '@/lib/auth/safeNextPath'
import {
  clientDirectoryWizardHrefFromPaketSession,
  DIRECTORY_EMAIL_REDIRECT_PARAM,
  directoryPaketFromEmailRedirectParam,
  directoryProfileWizardHref,
  directoryPublicPaketFromUserMetadata,
  isDirectoryBehandlerProfilFlowReturnPath,
} from '@/lib/directory/public/appBaseUrl'
import { supabase } from '@/lib/supabase-client'

async function resolveRedirectAfterSession(preferredNext: string | null): Promise<string> {
  let next = preferredNext ?? '/onboarding'
  if (next !== '/onboarding' && isDirectoryBehandlerProfilFlowReturnPath(next)) return next
  const { data: { user } } = await supabase.auth.getUser()
  const dp = directoryPublicPaketFromUserMetadata(user)
  if (dp && (next === '/onboarding' || !preferredNext)) {
    return directoryProfileWizardHref({ paket: dp })
  }
  return next
}

function isEmailOtpType(v: string | null): v is EmailOtpType {
  return (
    v === 'signup' ||
    v === 'invite' ||
    v === 'magiclink' ||
    v === 'recovery' ||
    v === 'email_change' ||
    v === 'email'
  )
}

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message] = useState('Anmeldung wird abgeschlossen…')

  useEffect(() => {
    let cancelled = false

    async function finish() {
      const fromQuery = safeInternalPath(searchParams.get('next'))
      const vzPaket = directoryPaketFromEmailRedirectParam(searchParams.get(DIRECTORY_EMAIL_REDIRECT_PARAM))
      /** Alte E-Mail-Templates setzen oft `next=/onboarding` — nicht mit Verzeichnis-`vz` oder Wizard-`next` überschreiben. */
      const forcedAppOnboarding =
        fromQuery === '/onboarding' || Boolean(fromQuery?.startsWith('/onboarding?'))
      if (fromQuery && typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(AUTH_RETURN_SESSION_KEY)
        } catch {
          /* ignore */
        }
      }
      let next = fromQuery
      if (vzPaket && (!next || forcedAppOnboarding)) {
        next = directoryProfileWizardHref({ paket: vzPaket })
      }
      if (!next && typeof window !== 'undefined') {
        try {
          const stored = sessionStorage.getItem(AUTH_RETURN_SESSION_KEY)
          const parsed = safeInternalPath(stored)
          if (parsed) {
            next = parsed
            sessionStorage.removeItem(AUTH_RETURN_SESSION_KEY)
          }
        } catch {
          /* ignore */
        }
      }
      if (!next && typeof window !== 'undefined') {
        const fromPaket = clientDirectoryWizardHrefFromPaketSession()
        if (fromPaket) next = fromPaket
      }

      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!cancelled && !error) {
          const dest = await resolveRedirectAfterSession(next ?? null)
          router.replace(dest)
          return
        }
        if (!cancelled && error) {
          console.error('auth callback exchangeCodeForSession', error)
        }
      }

      const token_hash = searchParams.get('token_hash')
      const typeParam = searchParams.get('type')
      if (token_hash && isEmailOtpType(typeParam)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: typeParam,
        })
        if (!cancelled && !error) {
          const dest = await resolveRedirectAfterSession(next ?? null)
          router.replace(dest)
          return
        }
        if (!cancelled && error) {
          console.error('auth callback verifyOtp', error)
        }
      }

      const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
      if (hash) {
        const h = new URLSearchParams(hash)
        const access_token = h.get('access_token')
        const refresh_token = h.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (!cancelled && !error) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            const dest = await resolveRedirectAfterSession(next ?? null)
            router.replace(dest)
            return
          }
          if (!cancelled && error) {
            console.error('auth callback setSession', error)
          }
        }
      }

      if (!cancelled) {
        let dest = '/login?error=auth'
        if (typeof window !== 'undefined') {
          try {
            const stored = sessionStorage.getItem(AUTH_RETURN_SESSION_KEY)
            const parsed = safeInternalPath(stored)
            if (parsed && isDirectoryBehandlerProfilFlowReturnPath(parsed)) {
              dest = `${parsed}${parsed.includes('?') ? '&' : '?'}auth_error=1`
            } else if (vzPaket) {
              dest = `${directoryProfileWizardHref({ paket: vzPaket })}&auth_error=1`
            } else {
              const pk = sessionStorage.getItem(DIRECTORY_WIZARD_PAKET_SESSION_KEY)
              if (pk === 'premium' || pk === 'gratis') {
                dest = `${directoryProfileWizardHref({ paket: pk })}&auth_error=1`
              }
            }
          } catch {
            /* ignore */
          }
        }
        router.replace(dest)
      }
    }

    void finish()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f8f8',
        fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
        color: '#6b7280',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8f8f8',
          }}
        />
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}
