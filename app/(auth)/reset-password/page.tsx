'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const token = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('token') ?? ''
  }, [])

  useEffect(() => {
    setReady(true)
    if (!token) {
      setError('Der Link ist ungültig oder unvollständig. Bitte fordere einen neuen Reset-Link an.')
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (password.trim().length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      setLoading(false)
      return
    }
    const res = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: password.trim() }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (data?.error === 'invalid_or_expired' || data?.error === 'invalid_token') {
        setError('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Reset-Link an.')
      } else if (data?.error === 'weak_password') {
        setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      } else {
        setError('Passwort konnte nicht gesetzt werden. Bitte versuche es erneut.')
      }
      setLoading(false)
      return
    }
    setOk(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/login')
    }, 1200)
  }

  return (
    <AuthShell>
      <h2
        style={{
          fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
          fontSize: 22,
          fontWeight: 700,
          color: '#111',
          margin: '0 0 4px',
          letterSpacing: '-0.3px',
        }}
      >
        Neues Passwort setzen
      </h2>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
        Bitte wähle ein neues Passwort für dein Konto.
      </p>

      {!ready ? (
        <div className="animate-pulse text-[#6b7280]">Laden…</div>
      ) : ok ? (
        <p
          style={{
            fontSize: 14,
            color: '#166534',
            padding: '12px 14px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            margin: 0,
          }}
        >
          Passwort aktualisiert. Du wirst zum Login weitergeleitet…
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Neues Passwort</label>
            <input
              type="password"
              placeholder="Mindestens 8 Zeichen"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 13px',
                border: '1.5px solid #cdcdd0',
                borderRadius: 10,
                background: '#faf9f7',
                fontSize: 15,
                fontFamily: 'inherit',
                color: '#111',
                outline: 'none',
                WebkitAppearance: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error ? (
            <p
              style={{
                fontSize: 13,
                color: '#dc2626',
                padding: '8px 12px',
                background: '#fef2f2',
                borderRadius: 8,
                margin: 0,
              }}
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !!error || !token}
            style={{
              width: '100%',
              padding: '14px 16px',
              border: 'none',
              borderRadius: 12,
              background: loading ? '#555' : '#111',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Speichern…' : 'Passwort speichern'}
          </button>
        </form>
      )}

      <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '16px 0 0' }}>
        <Link href="/forgot-password" style={{ color: '#52b788', textDecoration: 'none', fontWeight: 500 }}>
          Neuen Reset-Link anfordern
        </Link>
      </p>
    </AuthShell>
  )
}

