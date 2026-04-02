'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/onboarding'
  return raw
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
      const next = safeNext(searchParams.get('next'))

      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!cancelled && !error) {
          router.replace(next)
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
          router.replace(next)
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
            router.replace(next)
            return
          }
          if (!cancelled && error) {
            console.error('auth callback setSession', error)
          }
        }
      }

      if (!cancelled) {
        router.replace('/login?error=auth')
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
        background: '#f7f7f7',
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
            background: '#f7f7f7',
          }}
        />
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}
