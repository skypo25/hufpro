'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AUTH_RETURN_SESSION_KEY,
  DIRECTORY_WIZARD_PAKET_COOKIE,
  DIRECTORY_WIZARD_PAKET_SESSION_KEY,
} from '@/lib/auth/safeNextPath'
import { translateAuthError } from '@/lib/auth/translateAuthError'
import {
  DIRECTORY_PUBLIC_PAKET_USER_META_KEY,
  directoryAuthEmailRedirectUrl,
  directoryProfileWizardHref,
} from '@/lib/directory/public/appBaseUrl'
import { supabase } from '@/lib/supabase-client'

const SALUTATION_OPTIONS = [
  { value: '', label: 'Keine Angabe' },
  { value: 'herr', label: 'Herr' },
  { value: 'frau', label: 'Frau' },
  { value: 'divers', label: 'Divers' },
] as const

type Props = {
  paket: 'gratis' | 'premium'
}

export function DirectoryVerzeichnisRegisterClient({ paket }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [salutation, setSalutation] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agb, setAgb] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingEmail, setAwaitingEmail] = useState(false)

  const wizardAfterAuth = directoryProfileWizardHref({ paket })
  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(wizardAfterAuth)}`,
    [wizardAfterAuth]
  )

  useEffect(() => {
    try {
      sessionStorage.setItem(AUTH_RETURN_SESSION_KEY, wizardAfterAuth)
      sessionStorage.setItem(DIRECTORY_WIZARD_PAKET_SESSION_KEY, paket)
      const maxAge = 60 * 60 * 24 * 7
      const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${DIRECTORY_WIZARD_PAKET_COOKIE}=${paket}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
    } catch {
      /* ignore */
    }
  }, [paket, wizardAfterAuth])

  useEffect(() => {
    if (searchParams.get('auth_error') === '1') {
      setError('Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.')
    }
  }, [searchParams])

  function callbackUrl(): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    /** Kurz (`?vz=`), damit Supabase-Redirect-Allowlist + E-Mail-Links `next` nicht verlieren. */
    return directoryAuthEmailRedirectUrl(origin, paket)
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    if (!agb) {
      setError('Bitte akzeptiere die AGB und Datenschutzerklärung.')
      return
    }
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    setLoading(true)
    setError('')
    setAwaitingEmail(false)

    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          salutation: salutation.trim() || null,
          [DIRECTORY_PUBLIC_PAKET_USER_META_KEY]: paket,
        },
        emailRedirectTo: callbackUrl(),
      },
    })

    if (signErr) {
      setError(translateAuthError(signErr.message))
      setLoading(false)
      return
    }

    if (data?.user && Array.isArray((data.user as { identities?: unknown[] }).identities)) {
      const ids = (data.user as { identities?: unknown[] }).identities
      if ((ids?.length ?? 0) === 0) {
        setError('Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich mit deinem bestehenden Konto an.')
        setLoading(false)
        return
      }
    }

    if (data.session) {
      router.replace(wizardAfterAuth)
      setLoading(false)
      return
    }

    setAwaitingEmail(true)
    setLoading(false)
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError('')
    setAwaitingEmail(false)
    const { error: oErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl(),
        data: { [DIRECTORY_PUBLIC_PAKET_USER_META_KEY]: paket },
      },
    })
    if (oErr) setError(translateAuthError(oErr.message))
  }

  const isPremium = paket === 'premium'
  const title = isPremium ? 'Premium im Verzeichnis' : 'Gratis-Profil im Verzeichnis'
  const lead = isPremium
    ? 'Zuerst legst du deinen Zugang an. Nach der Bestätigung deiner E-Mail und dem Login vervollständigst du dein Profil. Premium kannst du später im Profil freischalten — nicht hier.'
    : 'Zuerst legst du deinen Zugang an. Nach der Bestätigung deiner E-Mail und dem Login vervollständigst du dein Profil — Schritt für Schritt im Verzeichnis-Assistenten.'

  return (
    <div className="dir-vz-reg-page">
      <div className="mx-auto max-w-[480px] px-4 py-10 md:py-14">
        <aside className="dir-vz-reg-card" aria-labelledby="dir-vz-reg-title">
          <div className="dir-vz-reg-card__head">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#52b788]">
              Verzeichnis · {isPremium ? 'Premium' : 'Gratis'}
            </p>
            <h1
              id="dir-vz-reg-title"
              className="mb-3 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[#1a1a1a] md:text-[24px]"
              style={{ fontFamily: 'var(--font-directory-display, Outfit, sans-serif)' }}
            >
              {title}
            </h1>
            <p className="mx-auto max-w-[40ch] text-[14px] leading-relaxed text-[#6b7280]">{lead}</p>
          </div>

          <div className="dir-vz-reg-card__body">
            {awaitingEmail ? (
              <div
                className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-5 py-5 text-left"
                role="status"
              >
                <h2 className="mb-2 text-base font-bold text-emerald-950">Fast geschafft</h2>
                <p className="mb-0 text-[14px] leading-relaxed text-emerald-900">
                  Bitte bestätige deine E-Mail-Adresse. Danach kannst du dich einloggen und dein Profil fertigstellen.
                  Der Link führt dich zurück in den Verzeichnis-Assistenten — ohne Umweg über die normale
                  App-Registrierung.
                </p>
              </div>
            ) : null}

            {!awaitingEmail ? (
              <>
                <div className="mb-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleOAuth('google')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cdcdd0] bg-white py-3 text-[15px] font-medium text-[#111]"
                  >
                    Mit Google
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOAuth('apple')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cdcdd0] bg-white py-3 text-[15px] font-medium text-[#111]"
                  >
                    <i className="bi bi-apple text-lg leading-none" aria-hidden />
                    Mit Apple
                  </button>
                </div>

                <div className="mb-5 flex items-center gap-3 text-xs text-[#9ca3af]">
                  <span className="h-px flex-1 bg-[#e5e2dc]" />
                  oder mit E-Mail
                  <span className="h-px flex-1 bg-[#e5e2dc]" />
                </div>

                {error ? (
                  <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {error}
                  </p>
                ) : null}

                <form className="flex flex-col gap-3.5" onSubmit={(e) => void handleRegister(e)}>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-[#374151]">Anrede</label>
                    <select
                      className="w-full rounded-[10px] border border-[#cdcdd0] bg-[#faf9f7] px-3 py-2.5 text-[15px] text-[#111]"
                      value={salutation}
                      onChange={(e) => setSalutation(e.target.value)}
                      aria-label="Anrede"
                    >
                      {SALUTATION_OPTIONS.map((o) => (
                        <option key={o.value || 'none'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] font-medium text-[#374151]">
                        Vorname<span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-[10px] border border-[#cdcdd0] bg-[#faf9f7] px-3 py-2.5 text-[15px]"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        required
                        placeholder="Vorname"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] font-medium text-[#374151]">
                        Nachname<span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-[10px] border border-[#cdcdd0] bg-[#faf9f7] px-3 py-2.5 text-[15px]"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                        required
                        placeholder="Nachname"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-[#374151]">
                      E-Mail<span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-[10px] border border-[#cdcdd0] bg-[#faf9f7] px-3 py-2.5 text-[15px]"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      placeholder="name@beispiel.de"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] font-medium text-[#374151]">
                      Passwort<span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-[10px] border border-[#cdcdd0] bg-[#faf9f7] px-3 py-2.5 text-[15px]"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      placeholder="Mind. 8 Zeichen"
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#374151]">
                    <input
                      type="checkbox"
                      checked={agb}
                      onChange={(e) => setAgb(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#52b788]"
                    />
                    <span>
                      Ich akzeptiere die{' '}
                      <a href="/agb" target="_blank" rel="noreferrer" className="font-medium text-[#52b788]">
                        AGB
                      </a>{' '}
                      und{' '}
                      <a href="/datenschutz" target="_blank" rel="noreferrer" className="font-medium text-[#52b788]">
                        Datenschutzerklärung
                      </a>
                      .
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 rounded-xl bg-[#111] py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
                  >
                    {loading ? 'Wird gesendet…' : 'Konto anlegen & Bestätigung anfordern'}
                  </button>
                </form>

                <p className="mt-5 text-center text-[13px] text-[#6b7280]">
                  Bereits ein Konto?{' '}
                  <Link href={loginHref} className="font-semibold text-[#52b788] no-underline">
                    Zum Einloggen
                  </Link>
                </p>
              </>
            ) : null}
          </div>
        </aside>

        <p className="mt-8 text-center text-[13px] text-[#9ca3af]">
          <Link href="/behandler/paket-waehlen" className="font-medium text-[#52b788] no-underline">
            ← Zur Paketwahl
          </Link>
        </p>
      </div>
    </div>
  )
}
