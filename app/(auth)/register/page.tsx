'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AUTH_RETURN_SESSION_KEY, safeInternalPath, safeNextPath } from '@/lib/auth/safeNextPath'
import { translateAuthError } from '@/lib/auth/translateAuthError'
import { supabase } from '@/lib/supabase-client'
import AuthShell from '@/components/auth/AuthShell'
import { BRAND_COLORS } from '@/lib/branding'

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextRaw = searchParams.get('next')
  const postAuthPath = nextRaw ? safeNextPath(nextRaw, '/onboarding') : '/onboarding'

  useEffect(() => {
    const p = safeInternalPath(nextRaw)
    if (!p) return
    try {
      sessionStorage.setItem(AUTH_RETURN_SESSION_KEY, p)
    } catch {
      /* private mode */
    }
  }, [nextRaw])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agb, setAgb] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!agb) { setError('Bitte akzeptiere die AGB und Datenschutzerklärung.'); return }
    if (password.length < 8) { setError('Das Passwort muss mindestens 8 Zeichen lang sein.'); return }
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(postAuthPath)}`,
      },
    })
    if (error) { setError(translateAuthError(error.message)); setLoading(false); return }
    // Supabase can return a "successful" signUp response for an already-registered email
    // (e.g. when the user exists but is not confirmed). In that case identities is empty.
    // We intentionally show a clear SaaS-style message instead of a misleading "confirm your email" hint.
    if (data?.user && Array.isArray((data.user as any).identities) && ((data.user as any).identities?.length ?? 0) === 0) {
      setError('Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.')
      setSuccess('')
      setLoading(false)
      return
    }
    setSuccess('')
    if (data.session) {
      router.push(postAuthPath)
    } else {
      setSuccess('Bitte bestätige deine E-Mail. Wir haben dir einen Link geschickt – klicke darauf, um fortzufahren.')
    }
    setLoading(false)
  }

  return (
    <AuthShell step={1} totalSteps={3}>
      <h2 style={{
        fontFamily: 'var(--font-outfit, "Outfit", sans-serif)',
        fontSize: 22, fontWeight: 700, color: '#111',
        margin: '0 0 4px', letterSpacing: '-0.3px',
      }}>
        Konto erstellen
      </h2>
      <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
        Teste AniDocs 14 Tage kostenlos – ohne Risiko.
      </p>

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Name row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Vorname">
            <AuthInput
              type="text" placeholder="Vorname" autoComplete="given-name" required
              value={firstName} onChange={e => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Nachname">
            <AuthInput
              type="text" placeholder="Nachname" autoComplete="family-name" required
              value={lastName} onChange={e => setLastName(e.target.value)}
            />
          </Field>
        </div>

        <Field label="E-Mail">
          <AuthInput
            type="email" placeholder="name@beispiel.de" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Passwort" hint="Mind. 8 Zeichen, ein Großbuchstabe, eine Zahl">
          <AuthInput
            type="password" placeholder="Mindestens 8 Zeichen" autoComplete="new-password" required
            value={password} onChange={e => setPassword(e.target.value)}
          />
        </Field>

        {/* AGB */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          lineHeight: 1.5, cursor: 'pointer',
        }}>
          <input
            type="checkbox" checked={agb} onChange={e => setAgb(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: BRAND_COLORS.accent, cursor: 'pointer', flexShrink: 0 }}
          />
          <span>
            Ich akzeptiere die{' '}
            <a href="/agb" target="_blank" className="link-accent font-medium">AGB</a>
            {' '}und{' '}
            <a href="/datenschutz" target="_blank" className="link-accent font-medium">Datenschutzerklärung</a>
          </span>
        </label>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {error && error.includes('bereits registriert') ? (
          <div style={{ display: 'flex', gap: 10, marginTop: -6 }}>
            <button
              type="button"
              onClick={() => router.push(`/login?next=${encodeURIComponent(postAuthPath)}`)}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1.5px solid #cdcdd0',
                background: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Zum Login
            </button>
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1.5px solid #cdcdd0',
                background: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Passwort vergessen
            </button>
          </div>
        ) : null}
        {success && (
          <p style={{
            fontSize: 14, color: '#166534', padding: '12px 14px',
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, margin: 0,
          }}>
            {success}
          </p>
        )}

        <PrimaryBtn type="submit" disabled={loading}>
          {loading ? 'Konto wird erstellt…' : 'Jetzt kostenlos starten'}
        </PrimaryBtn>
      </form>

      <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '16px 0 0' }}>
        Bereits ein Konto?{' '}
        <Link
          href={`/login?next=${encodeURIComponent(postAuthPath)}`}
          className="link-accent font-medium"
        >
          Anmelden
        </Link>
      </p>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell step={1} totalSteps={3}>
          <div className="animate-pulse text-[#6b7280]">Laden…</div>
        </AuthShell>
      }
    >
      <RegisterContent />
    </Suspense>
  )
}

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 12, color: '#9ca3af' }}>{hint}</span>}
    </div>
  )
}

function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '11px 13px', border: '1.5px solid #cdcdd0',
        borderRadius: 10, background: '#faf9f7', fontSize: 13, fontWeight: 400, fontFamily: 'inherit',
        color: '#111', outline: 'none', WebkitAppearance: 'none', boxSizing: 'border-box',
      }}
    />
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 13, color: '#dc2626', padding: '8px 12px',
      background: '#fef2f2', borderRadius: 8, margin: 0,
    }}>{children}</p>
  )
}

function PrimaryBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        width: '100%', padding: '14px 16px', border: 'none', borderRadius: 12,
        background: props.disabled ? '#555' : '#111', color: '#fff',
        fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
        cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

