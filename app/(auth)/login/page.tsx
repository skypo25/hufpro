'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DIRECTORY_WIZARD_PAKET_SESSION_KEY, safeInternalPath } from '@/lib/auth/safeNextPath'
import { translateAuthError } from '@/lib/auth/translateAuthError'
import {
  DIRECTORY_PACKAGE_CHOOSE_PATH,
  directoryProfileWizardHref,
  directoryPublicPaketFromUserMetadata,
  isDirectoryBehandlerProfilFlowReturnPath,
} from '@/lib/directory/public/appBaseUrl'
import { supabase } from '@/lib/supabase-client'
import AuthShell from '@/components/auth/AuthShell'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const intendedNext = safeInternalPath(searchParams.get('next'))
  const [alreadySignedIn, setAlreadySignedIn] = useState(false)

  useEffect(() => {
    /** `getSession` = lokaler Auth-Zustand (nach Abmelden zuverlässig leer; `getUser` kann kurz „hängen“). */
    void supabase.auth.getSession().then(({ data: { session } }) => setAlreadySignedIn(Boolean(session)))
  }, [])

  function directoryNextFallbackFromSession(): string | null {
    if (typeof window === 'undefined') return null
    try {
      const pk = sessionStorage.getItem(DIRECTORY_WIZARD_PAKET_SESSION_KEY)
      if (pk === 'premium' || pk === 'gratis') return directoryProfileWizardHref({ paket: pk })
    } catch {
      /* ignore */
    }
    return null
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(translateAuthError(error.message))
      setLoading(false)
      return
    }
    let onboardingComplete = false
    if (user) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle()
      onboardingComplete = (settings?.settings as { onboarding_complete?: boolean } | null)?.onboarding_complete === true
    }
    const directoryNext =
      (intendedNext && isDirectoryBehandlerProfilFlowReturnPath(intendedNext) ? intendedNext : null) ??
      directoryNextFallbackFromSession()
    if (directoryNext) {
      router.push(directoryNext)
      router.refresh()
      return
    }
    const metaPaket = directoryPublicPaketFromUserMetadata(user)
    if (!onboardingComplete && metaPaket) {
      router.push(directoryProfileWizardHref({ paket: metaPaket }))
      router.refresh()
      return
    }
    if (onboardingComplete) {
      router.push(intendedNext ?? '/dashboard')
    } else {
      router.push(intendedNext ?? '/onboarding')
    }
    router.refresh()
  }

  return (
    <AuthShell>
      {alreadySignedIn ? (
        <div
          style={{
            width: '100%',
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 10,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#14532d',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 8 }}>Du bist bereits angemeldet.</strong>
          <span style={{ color: '#166534' }}>
            Wenn du das Verzeichnis-Profil einrichten willst, nutze den Verzeichnis-Einstieg. Für die App-Kundenverwaltung
            die Einrichtung fortsetzen — oder abmelden, um ein anderes Konto zu nutzen.
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <Link
              href={DIRECTORY_PACKAGE_CHOOSE_PATH}
              style={{ color: '#15803d', fontWeight: 600, textDecoration: 'none' }}
            >
              Zum Verzeichnis (Profil anlegen)
            </Link>
            <Link href="/onboarding" style={{ color: '#15803d', fontWeight: 600, textDecoration: 'none' }}>
              App-Einrichtung fortsetzen
            </Link>
            <button
              type="button"
              onClick={() => {
                void supabase.auth.signOut().then(() => {
                  setAlreadySignedIn(false)
                  router.refresh()
                })
              }}
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #86efac',
                background: '#fff',
                color: '#14532d',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Abmelden
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="E-Mail">
          <AuthInput
            type="email" placeholder="name@beispiel.de" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
        </Field>
        <Field label="Passwort">
          <AuthInput
            type="password" placeholder="Dein Passwort" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
        </Field>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <PrimaryBtn type="submit" disabled={loading}>
          {loading ? 'Anmelden…' : 'Anmelden'}
        </PrimaryBtn>
      </form>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <Link
          href="/forgot-password"
          style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}
        >
          Passwort vergessen?
        </Link>
      </div>

      <FooterText>
        Noch kein Konto?{' '}
        <Link
          href={intendedNext ? `/register?next=${encodeURIComponent(intendedNext)}` : '/register'}
          className="link-accent font-medium"
        >
          Kostenlos registrieren
        </Link>
      </FooterText>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell><div className="animate-pulse text-[#6b7280]">Laden…</div></AuthShell>}>
      <LoginContent />
    </Suspense>
  )
}

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label>{label}</label>
      {children}
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
        fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

function FooterText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '16px 0 0' }}>
      {children}
    </p>
  )
}

