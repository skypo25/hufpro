'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/safeNextPath'
import { supabase } from '@/lib/supabase-client'

/**
 * Session-Wechsel: holt token_hash einmalig per API (httpOnly Cookie), nie aus der URL.
 */
function ImpersonateInner() {
  const router = useRouter()
  const [message, setMessage] = useState('Sitzung wird vorbereitet…')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function run() {
      const res = await fetch('/api/admin/impersonate/exchange', {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => null)) as {
        tokenHash?: string
        next?: string
        error?: string
      } | null

      if (!res.ok || !data?.tokenHash) {
        setMessage('Sitzungswechsel fehlgeschlagen.')
        router.replace('/login?error=impersonate')
        return
      }

      const nextPath = safeNextPath(data.next ?? null, '/dashboard')
      const restoringAdmin = nextPath.startsWith('/admin')
      setMessage(
        restoringAdmin ? 'Admin-Sitzung wird wiederhergestellt…' : 'Support-Ansicht wird geladen…'
      )

      await supabase.auth.signOut({ scope: 'local' })

      let result = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'magiclink',
      })
      if (result.error) {
        result = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
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
  }, [router])

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
