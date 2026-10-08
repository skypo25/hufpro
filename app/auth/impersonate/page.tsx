'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

/**
 * Schliesst Admin-Impersonation ab: bestehende Session verwerfen,
 * Magic-Link-Token einlösen, dann zur App (nicht Verzeichnis-Wizard).
 */
function ImpersonateInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Support-Ansicht wird geladen…')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function run() {
      const tokenHash = searchParams.get('token_hash')?.trim()
      if (!tokenHash) {
        setMessage('Token fehlt.')
        router.replace('/login?error=impersonate')
        return
      }

      // Admin-Session muss weg, sonst bleibt man oft als Admin eingeloggt
      // und landet (Verzeichnis-Metadaten) im Behandler-Profil.
      await supabase.auth.signOut({ scope: 'local' })

      let result = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      })
      if (result.error) {
        result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'email',
        })
      }

      if (result.error || !result.data.user) {
        console.error('impersonate verifyOtp', result.error)
        setMessage('Login als Nutzer fehlgeschlagen.')
        router.replace(
          `/login?error=impersonate&msg=${encodeURIComponent(
            result.error?.message?.slice(0, 120) ?? 'verify'
          )}`
        )
        return
      }

      router.replace('/dashboard')
    }

    void run()
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

export default function ImpersonatePage() {
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
      <ImpersonateInner />
    </Suspense>
  )
}
