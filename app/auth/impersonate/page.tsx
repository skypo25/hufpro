'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/safeNextPath'
import { supabase } from '@/lib/supabase-client'

/**
 * Session-Wechsel per Magic-Link-Token (Impersonation starten oder Admin wiederherstellen).
 */
function ImpersonateInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'), '/dashboard')
  const restoringAdmin = nextPath.startsWith('/admin')
  const [message, setMessage] = useState(
    restoringAdmin ? 'Admin-Sitzung wird wiederhergestellt…' : 'Support-Ansicht wird geladen…'
  )
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
        setMessage(restoringAdmin ? 'Admin-Login fehlgeschlagen.' : 'Login als Nutzer fehlgeschlagen.')
        router.replace(
          `/login?error=impersonate&msg=${encodeURIComponent(
            result.error?.message?.slice(0, 120) ?? 'verify'
          )}`
        )
        return
      }

      router.replace(nextPath)
    }

    void run()
  }, [router, searchParams, nextPath, restoringAdmin])

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
