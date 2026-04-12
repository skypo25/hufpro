'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'

type Props = {
  /** Nutzer ist eingeloggt und hat noch keinen App-Zugang (kein aktives Abo / kein Test). */
  showCheckout: boolean
}

async function postCheckout(): Promise<{ url: string } | { error: string }> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ successPath: 'app_starten' }),
  })
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Checkout konnte nicht gestartet werden.'
    return { error: msg }
  }
  if (!data || typeof data !== 'object' || !('url' in data) || typeof (data as { url: unknown }).url !== 'string') {
    return { error: 'Unerwartete Antwort vom Server.' }
  }
  return { url: (data as { url: string }).url }
}

/**
 * Startet das App-Monatsabo (Stripe Checkout). Trial-Ende aus billing_accounts setzt ggf. Stripe trial_end (Server).
 */
export function AppStartCheckoutClient({ showCheckout }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await postCheckout()
      if ('error' in r) {
        setError(r.error)
        return
      }
      window.location.href = r.url
    } finally {
      setBusy(false)
    }
  }, [])

  if (!showCheckout) return null

  return (
    <div className="dir-app-start-cta-wrap">
      {error ? (
        <p className="dir-app-start-err" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="dir-app-start-cta" onClick={onClick} disabled={busy}>
        {busy ? 'Wird vorbereitet…' : 'AniDocs App starten'}
      </button>
      <p className="dir-app-start-cta-hint">
        Sichere Zahlung über Stripe. Wenn für dein Konto ein Testzeitraum vorgesehen ist, wird er beim Checkout
        automatisch berücksichtigt.
      </p>
    </div>
  )
}

export function AppStartAuthLinks({ nextPath }: { nextPath: string }) {
  const enc = encodeURIComponent(nextPath)
  return (
    <div className="dir-app-start-auth">
      <Link href={`/register?next=${enc}`} className="dir-app-start-cta dir-app-start-cta--accent">
        Konto erstellen
      </Link>
      <Link href={`/login?next=${enc}`} className="dir-app-start-link-login">
        Bereits Konto? Anmelden
      </Link>
    </div>
  )
}
