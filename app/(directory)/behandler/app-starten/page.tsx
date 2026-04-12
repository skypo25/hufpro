import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppStartAuthLinks, AppStartCheckoutClient } from '@/components/directory/onboarding/AppStartCheckoutClient'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { canAccessApp, getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import { directoryProfileWizardHref } from '@/lib/directory/public/appBaseUrl'
import { createSupabaseServerClient } from '@/lib/supabase-server'

import './app-starten.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AniDocs App starten – anidocs',
  description: 'AniDocs App mit Premium-Verzeichnisprofil: Zugang und Abo sicher über Stripe.',
}

const NEXT_SELF = '/behandler/app-starten'

export default async function BehandlerAppStartenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const checkout = typeof sp.checkout === 'string' ? sp.checkout : Array.isArray(sp.checkout) ? sp.checkout[0] : ''

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let account: BillingAccountRow | null = null
  if (user) {
    let initError: string | null = null
    const { data: row1, error: row1Err } = await supabase
      .from('billing_accounts')
      .select(BILLING_ACCOUNT_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()

    if (row1Err) {
      initError = row1Err.message
    } else if (!row1) {
      try {
        await ensureBillingAccountRow({ userId: user.id, email: user.email })
      } catch (e) {
        initError = e instanceof Error ? e.message : 'init'
      }
      if (!initError) {
        const { data: row2 } = await supabase
          .from('billing_accounts')
          .select(BILLING_ACCOUNT_COLUMNS)
          .eq('user_id', user.id)
          .maybeSingle()
        account = (row2 as BillingAccountRow | null) ?? null
      }
    } else {
      account = (row1 as BillingAccountRow | null) ?? null
    }
  }

  const priceIdMonthly = process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null
  const billingState = user ? getBillingState({ account, priceIdMonthly }) : null
  const hasAppAccess = billingState ? canAccessApp(billingState) : false
  const trialActive = billingState?.trial.isActive === true
  const showCheckout = Boolean(user) && !hasAppAccess

  const hrefDirectoryWizard = directoryProfileWizardHref({ paket: 'gratis' })

  return (
    <div className="dir-app-start-page">
      <Link href="/behandler/paket-waehlen" className="dir-app-start-back">
        ← Zur Paketwahl
      </Link>

      <h1>AniDocs App</h1>
      <p className="dir-app-start-lead">
        Die App für Dokumentation, Kunden und Termine — mit <strong>Premium-Verzeichnisprofil inklusive</strong>. Ein
        Abo, ein Konto: Galerie und Kontaktformular im Verzeichnis sind dabei, ohne extra Verzeichnis-Premium.
      </p>

      <ul className="dir-app-start-list">
        <li>Voller Zugriff auf die AniDocs-Funktionen (je nach Produktstand)</li>
        <li>Premium-Darstellung deines Verzeichniseintrags inklusive</li>
        <li>Verwaltung deines Profils unter „Mein Profil“</li>
      </ul>

      {checkout === 'success' ? (
        <div className="dir-app-start-panel dir-app-start-panel--ok" role="status">
          <h2>Zahlung erfolgreich</h2>
          <p>
            Vielen Dank! Dein Zugang wird in Kürze aktiv. Als Nächstes kannst du dein Verzeichnisprofil anlegen oder
            bearbeiten — mit Premium-Funktionen.
          </p>
          <div className="dir-app-start-links">
            <Link href="/directory/mein-profil">Zum Verzeichnisprofil</Link>
            <Link href="/dashboard">Zum Dashboard</Link>
          </div>
        </div>
      ) : null}

      {checkout === 'canceled' ? (
        <div className="dir-app-start-panel" role="status">
          <h2>Checkout abgebrochen</h2>
          <p>Es wurde keine Zahlung ausgelöst. Du kannst den Vorgang jederzeit erneut starten.</p>
        </div>
      ) : null}

      {hasAppAccess && user ? (
        <div className="dir-app-start-panel dir-app-start-panel--ok">
          <h2>Du hast bereits Zugang</h2>
          <p>
            {trialActive
              ? 'Dein Test- oder Abo-Zugang ist aktiv. Nutze die App und dein Premium-Verzeichnisprofil wie gewohnt.'
              : 'Dein Zugang ist aktiv. Öffne die App oder pflege dein Verzeichnisprofil.'}
          </p>
          <div className="dir-app-start-links">
            <Link href="/directory/mein-profil">Mein Verzeichnisprofil</Link>
            <Link href="/billing">Abo &amp; Rechnungen</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </div>
      ) : null}

      {!user ? (
        <>
          <p className="dir-app-start-lead" style={{ marginTop: 8 }}>
            Lege ein kostenloses AniDocs-Konto an oder melde dich an — danach startest du den App-Checkout hier.
          </p>
          <AppStartAuthLinks nextPath={NEXT_SELF} />
        </>
      ) : null}

      {showCheckout ? <AppStartCheckoutClient showCheckout /> : null}

      {user && hasAppAccess ? (
        <p className="dir-app-start-lead" style={{ marginTop: 24 }}>
          Nur Verzeichnis ohne App?{' '}
          <Link href={hrefDirectoryWizard} style={{ color: '#52b788', fontWeight: 600 }}>
            Zum Gratis-Profil
          </Link>{' '}
          oder{' '}
          <Link href="/behandler/paket-waehlen" style={{ color: '#52b788', fontWeight: 600 }}>
            Paketwahl
          </Link>
          .
        </p>
      ) : null}

      <p className="dir-app-start-reco">
        <strong>Hinweis:</strong> Aus UX-Sicht ist es meist klarer, zuerst den App-Zugang (Test oder Abo) zu
        aktivieren und danach das Verzeichnisprofil zu pflegen — Premium-Verzeichnis ist dann über dasselbe Konto
        abgedeckt, ohne den Eindruck zweier getrennter Käufe im Formular.
      </p>
    </div>
  )
}
