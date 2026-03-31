'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import AuthShell from '@/components/auth/AuthShell'

export default function RegisterPage() {
  const router = useRouter()
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
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
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
      router.push('/onboarding')
    } else {
      setSuccess('Bitte bestätige deine E-Mail. Wir haben dir einen Link geschickt – klicke darauf, um fortzufahren.')
    }
    setLoading(false)
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    })
    if (error) setError(translateAuthError(error.message))
  }

  return (
    <AuthShell step={1} totalSteps={3}>
      {/* Social */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
        <SocialBtn onClick={() => handleOAuth('google')} icon={<GoogleIcon />}>
          Mit Google registrieren
        </SocialBtn>
        <SocialBtn
          onClick={() => handleOAuth('apple')}
          icon={<i className="bi bi-apple" aria-hidden style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }} />}
        >
          Mit Apple registrieren
        </SocialBtn>
      </div>

      <Divider />

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
          fontSize: 13, color: '#374151', lineHeight: 1.5, cursor: 'pointer',
        }}>
          <input
            type="checkbox" checked={agb} onChange={e => setAgb(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: '#52b788', cursor: 'pointer', flexShrink: 0 }}
          />
          <span>
            Ich akzeptiere die{' '}
            <a href="/agb" target="_blank" style={{ color: '#52b788', textDecoration: 'none', fontWeight: 500 }}>AGB</a>
            {' '}und{' '}
            <a href="/datenschutz" target="_blank" style={{ color: '#52b788', textDecoration: 'none', fontWeight: 500 }}>Datenschutzerklärung</a>
          </span>
        </label>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {error && error.includes('bereits registriert') ? (
          <div style={{ display: 'flex', gap: 10, marginTop: -6 }}>
            <button
              type="button"
              onClick={() => router.push('/login')}
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
        <Link href="/login" style={{ color: '#52b788', textDecoration: 'none', fontWeight: 500 }}>
          Anmelden
        </Link>
      </p>
    </AuthShell>
  )
}

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

function SocialBtn({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, width: '100%', padding: '13px 16px',
        border: '1.5px solid #cdcdd0', borderRadius: 12, background: '#fff',
        fontSize: 15, fontWeight: 500, color: '#111', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {icon}{children}
    </button>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', color: '#9ca3af', fontSize: 13 }}>
      <div style={{ flex: 1, height: 1, background: '#e5e2dc' }} />
      <span>oder mit E-Mail</span>
      <div style={{ flex: 1, height: 1, background: '#e5e2dc' }} />
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</label>
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
        borderRadius: 10, background: '#faf9f7', fontSize: 15, fontFamily: 'inherit',
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// ─── Error translation ────────────────────────────────────────────────────────

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('email rate limit') || m.includes('rate limit exceeded'))
    return 'Zu viele Versuche. Bitte warte einige Minuten und versuche es erneut.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.'
  if (m.includes('invalid email'))
    return 'Bitte gib eine gültige E-Mail-Adresse ein.'
  if (m.includes('password') && m.includes('short'))
    return 'Das Passwort ist zu kurz. Mindestens 8 Zeichen erforderlich.'
  if (m.includes('weak password'))
    return 'Das Passwort ist zu schwach. Nutze Groß- und Kleinbuchstaben sowie Zahlen.'
  if (m.includes('email not confirmed'))
    return 'Bitte bestätige zuerst deine E-Mail-Adresse.'
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'E-Mail oder Passwort falsch.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Netzwerkfehler. Bitte prüfe deine Internetverbindung.'
  return 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.'
}
