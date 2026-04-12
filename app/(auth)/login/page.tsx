'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DIRECTORY_WIZARD_PAKET_SESSION_KEY, safeInternalPath } from '@/lib/auth/safeNextPath'
import { translateAuthError } from '@/lib/auth/translateAuthError'
import { directoryProfileWizardHref, isDirectoryBehandlerProfilFlowReturnPath } from '@/lib/directory/public/appBaseUrl'
import { supabase } from '@/lib/supabase-client'
import AuthShell from '@/components/auth/AuthShell'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const oauthError = searchParams.get('error')
  const intendedNext = safeInternalPath(searchParams.get('next'))

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
    if (onboardingComplete) {
      router.push(intendedNext ?? '/dashboard')
    } else {
      router.push(intendedNext ?? '/onboarding')
    }
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError('')
    const nextPath = intendedNext ?? directoryNextFallbackFromSession() ?? '/onboarding'
    const callbackNext = encodeURIComponent(nextPath)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${callbackNext}`,
      },
    })
    if (error) setError(translateAuthError(error.message))
  }

  return (
    <AuthShell>
      {oauthError && (
        <div style={{
          fontSize: 13, color: '#dc2626', padding: '8px 12px',
          background: '#fef2f2', borderRadius: 8, marginBottom: 12,
        }}>
          Anmeldung fehlgeschlagen. Bitte erneut versuchen.
        </div>
      )}

      {/* Social */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
        <SocialBtn onClick={() => handleOAuth('google')} icon={<GoogleIcon />}>
          Mit Google anmelden
        </SocialBtn>
        <SocialBtn
          onClick={() => handleOAuth('apple')}
          icon={<i className="bi bi-apple" aria-hidden style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }} />}
        >
          Mit Apple anmelden
        </SocialBtn>
      </div>

      <Divider />

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
          style={{ color: '#52b788', textDecoration: 'none', fontWeight: 500 }}
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

function SocialBtn({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, width: '100%', padding: '13px 16px',
        border: '1.5px solid #cdcdd0', borderRadius: 12, background: '#fff',
        fontSize: 15, fontWeight: 500, color: '#111', cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {icon}{children}
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      margin: '16px 0', color: '#9ca3af', fontSize: 13,
    }}>
      <div style={{ flex: 1, height: 1, background: '#e5e2dc' }} />
      <span>oder mit E-Mail</span>
      <div style={{ flex: 1, height: 1, background: '#e5e2dc' }} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</label>
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

