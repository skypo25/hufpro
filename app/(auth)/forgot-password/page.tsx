'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    if (!res.ok) {
      setError('Konnte E-Mail nicht senden. Bitte prüfe die Adresse und versuche es erneut.')
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
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
        Passwort zurücksetzen
      </h2>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
        Du bekommst einen Link per E-Mail, um ein neues Passwort zu setzen.
      </p>

      {sent ? (
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
          Wenn ein Konto zu dieser E-Mail existiert, haben wir dir einen Link geschickt.
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label>E-Mail</label>
            <input
              type="email"
              placeholder="name@beispiel.de"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 13px',
                border: '1.5px solid #cdcdd0',
                borderRadius: 10,
                background: '#faf9f7',
                fontSize: 13,
                fontWeight: 400,
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
            disabled={loading}
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
            {loading ? 'Senden…' : 'Link senden'}
          </button>
        </form>
      )}

      <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '16px 0 0' }}>
        Zurück zum{' '}
        <Link href="/login" style={{ color: '#52b788', textDecoration: 'none', fontWeight: 500 }}>
          Login
        </Link>
      </p>
    </AuthShell>
  )
}

