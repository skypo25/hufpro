'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import DataExportButton from '@/components/export/DataExportButton'
import DataExportDownloadsPanel from '@/components/export/DataExportDownloadsPanel'
import BillingStatusBadge from '@/components/billing/BillingStatusBadge'
import { getBillingState, isSubscriptionStatusLive } from '@/lib/billing/state'
import type { BillingAccountRow, BillingState, PaymentMethodSummary } from '@/lib/billing/types'
import EmbeddedSubscribe from '@/components/billing/EmbeddedSubscribe'

async function postJson(url: string): Promise<{ url: string } | { error: string }> {
  const res = await fetch(url, { method: 'POST' })
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data && 'error' in data && typeof (data as any).error === 'string'
        ? (data as any).error
        : 'Aktion fehlgeschlagen.'
    return { error: msg }
  }
  if (!data || typeof data !== 'object' || !('url' in data) || typeof (data as any).url !== 'string') {
    return { error: 'Unerwartete Antwort vom Server.' }
  }
  return { url: (data as any).url as string }
}

function formatDateDe(d: Date | null): string {
  if (!d) return '–'
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

type BillingInvoiceRow = {
  id: string
  number: string | null
  status: string | null
  amountPaidCents: number
  totalCents: number
  currency: string
  createdUnix: number
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
}

function formatMoneyCents(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function PaymentMethodPreview({ pm }: { pm: PaymentMethodSummary }) {
  if (pm.kind === 'card') {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-[#F0EEEA] bg-white px-4 py-3">
        <div className="h-[28px] w-[42px] rounded-[6px] bg-[#1B1F23] text-white text-[10px] font-bold flex items-center justify-center">
          {(pm.brand ?? 'CARD').toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#1B1F23] tabular-nums">
            •••• •••• •••• {pm.last4 ?? '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-[#9CA3AF]">
            Gültig bis {pm.expMonth ?? '—'}/{pm.expYear ?? '—'}
          </div>
        </div>
      </div>
    )
  }
  if (pm.kind === 'sepa_debit') {
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-[#F0EEEA] bg-white px-4 py-3">
        <div className="h-[28px] w-[42px] rounded-[6px] bg-[#1B1F23] text-white text-[10px] font-bold flex items-center justify-center">
          SEPA
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#1B1F23] tabular-nums">
            IBAN •••• {pm.last4 ?? '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-[#9CA3AF]">
            {pm.bankCode ? `Bank ${pm.bankCode}` : 'Lastschrift'}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[#F0EEEA] bg-white px-4 py-3">
      <div className="text-[13px] text-[#6B7280]">Zahlungsmethode: {pm.label}</div>
    </div>
  )
}

export default function BillingPageClient({
  account: initialAccount,
  priceIdMonthly,
  loadError,
  stripePublishableKey,
}: {
  account: BillingAccountRow | null
  priceIdMonthly: string | null
  loadError?: string
  stripePublishableKey: string | null
}) {
  const router = useRouter()
  const [account, setAccount] = useState<BillingAccountRow | null>(initialAccount)
  useEffect(() => {
    setAccount(initialAccount)
  }, [initialAccount])

  /** Stripe-Status nachziehen (verhindert veraltetes `past_due` trotz aktivem Abo). */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/billing/sync-subscription', { method: 'POST' })
        const data = (await res.json().catch(() => null)) as { account?: BillingAccountRow | null } | null
        if (!cancelled && res.ok && data && 'account' in data) {
          setAccount(data.account ?? null)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const billingState = useMemo(
    () => getBillingState({ account, priceIdMonthly }),
    [account, priceIdMonthly]
  )
  const params = useSearchParams()
  const success = params.get('success') === '1'
  const canceled = params.get('canceled') === '1'
  const blocked = params.get('blocked') === '1'
  const billingCheckFailed = params.get('billing_check') === 'failed'

  const [busy, setBusy] = useState<null | 'portal'>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodSummary | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [invoices, setInvoices] = useState<BillingInvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  const subscriptionStatus = billingState.subscription.status
  /** Stripe: Abo zahlt oder Stripe-Testphase — nicht mit „nur App-Test“ verwechseln. */
  const hasLiveSubscription = isSubscriptionStatusLive(subscriptionStatus)
  const portalCtaLabel = hasLiveSubscription ? 'Abo verwalten' : 'Rechnungen & Zahlungsdaten verwalten'
  const isTrialActive = billingState.trial.isActive

  const trialTotalDays = 14
  const trialDaysRemaining = billingState.trial.daysRemaining ?? null
  const trialProgressPct =
    typeof trialDaysRemaining === 'number'
      ? Math.max(0, Math.min(100, Math.round(((trialTotalDays - trialDaysRemaining) / trialTotalDays) * 100)))
      : 0

  const ui = useMemo(() => {
    const status = billingState.subscription.status
    const trialActive = billingState.trial.isActive
    const trialExpired = billingState.trial.isExpired && status === 'none'

    if (billingState.access.mode === 'read_only') {
      const until = billingState.access.graceEndsAt
      return {
        key: 'post_cancel_grace' as const,
        title: 'Abo gekündigt',
        badgeText: 'Nur Lesen',
        icon: 'bi-box-arrow-down',
        iconTone: 'muted' as const,
        detail:
          `Ihr Zugriff ist nur noch lesend. Sie können Ihre Daten bis zum ${formatDateDe(until)} als ZIP-Archiv exportieren (CSV und JSON).`,
        showProgress: false,
        showNoCharge: false,
      }
    }

    if (status === 'past_due') {
      return {
        key: 'past_due' as const,
        title: 'Zahlung ausstehend',
        badgeText: 'Zahlung offen',
        icon: 'bi-exclamation-triangle-fill',
        iconTone: 'warn' as const,
        detail:
          'Die letzte Abbuchung ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode, um eine Unterbrechung zu vermeiden.',
        showProgress: false,
        showNoCharge: false,
      }
    }
    // Stripe-Status trialing ≠ „Abo voll aktiv“ — sonst wirkt es wie Widerspruch zum Stripe-Dashboard.
    if (status === 'trialing' && billingState.trial.isExpired) {
      return {
        key: 'trialing_sync' as const,
        title: 'Abgleich mit Stripe',
        badgeText: 'Hinweis',
        icon: 'bi-arrow-repeat',
        iconTone: 'warn' as const,
        detail:
          'In der App ist der Testzeitraum beendet, Stripe zeigt die Änderung ggf. noch mit Verzögerung. Bitte Seite neu laden oder das Stripe-Dashboard prüfen.',
        showProgress: false,
        showNoCharge: false,
      }
    }
    if (status === 'trialing') {
      return {
        key: 'stripe_trialing' as const,
        title: 'Testphase (Abo)',
        badgeText: 'Testphase',
        icon: 'bi-clock-fill',
        iconTone: 'blue' as const,
        detail: `Ihr Abo läuft in der kostenlosen Testphase bei Stripe${
          billingState.trial.endsAt ? ` (bis zum ${formatDateDe(billingState.trial.endsAt)})` : ''
        }. Rechnungen und Zahlungsdaten verwalten Sie im Stripe-Kundenportal.`,
        showProgress: false,
        showNoCharge: false,
      }
    }
    if (status === 'active' && billingState.subscription.cancelAtPeriodEnd) {
      const end = billingState.subscription.cancelAt
      return {
        key: 'active_cancel_scheduled' as const,
        title: 'Kündigung vorgemerkt',
        badgeText: 'Läuft aus',
        icon: 'bi-calendar-x',
        iconTone: 'warn' as const,
        detail:
          `Ihr Abo ist noch aktiv, wurde aber gekündigt. Der volle Zugang endet am ${formatDateDe(end)} — bis dahin können Sie AniDocs wie gewohnt nutzen. ` +
          `Rechnungen und Zahlungsdaten verwalten Sie im Stripe-Portal.`,
        showProgress: false,
        showNoCharge: false,
      }
    }
    if (status === 'active') {
      return {
        key: 'active' as const,
        title: 'Abo aktiv',
        badgeText: 'Aktiv',
        icon: 'bi-check-circle-fill',
        iconTone: 'accent' as const,
        detail:
          'Ihr AniDocs Abo ist aktiv. Rechnungen und Zahlungsdaten können Sie jederzeit sicher über unser Zahlungsportal verwalten.',
        showProgress: false,
        showNoCharge: false,
      }
    }
    if (trialActive && status === 'none') {
      return {
        key: 'trialing' as const,
        title: 'Testphase aktiv',
        badgeText: 'Testphase',
        icon: 'bi-clock-fill',
        iconTone: 'blue' as const,
        detail:
          `Ihre 14‑tägige Testphase läuft noch bis zum ` +
          `${formatDateDe(billingState.trial.endsAt)}. ` +
          `Alle Funktionen sind freigeschaltet.`,
        showProgress: true,
        showNoCharge: true,
      }
    }
    if (trialExpired) {
      return {
        key: 'trial_expired' as const,
        title: 'Testphase beendet',
        badgeText: 'Abgelaufen',
        icon: 'bi-exclamation-circle-fill',
        iconTone: 'danger' as const,
        detail:
          `Ihre Testphase ist am ${formatDateDe(billingState.trial.endsAt)} abgelaufen. ` +
          `Schließen Sie jetzt Ihr Abo ab, um AniDocs weiter vollständig zu nutzen.`,
        showProgress: false,
        showNoCharge: false,
      }
    }
    return {
      key: 'no_subscription' as const,
      title: 'Abo nicht aktiv',
      badgeText: 'Kein Abo',
      icon: 'bi-credit-card',
      iconTone: 'muted' as const,
      detail:
        'Schließen Sie Ihr Abo ab, um AniDocs weiterhin vollständig zu nutzen. Ihre Rechnungen und Zahlungsdaten verwalten Sie sicher über Stripe.',
      showProgress: false,
      showNoCharge: false,
    }
  }, [billingState])

  const notice = useMemo(() => {
    if (billingCheckFailed) {
      return {
        tone: 'warning' as const,
        text: 'Ihr Zahlungs- und Zugriffsstatus konnte vorübergehend nicht geprüft werden. Bitte laden Sie die Seite neu oder versuchen Sie es in Kürze erneut.',
      }
    }
    if (success) {
      return {
        tone: 'success' as const,
        text: 'Vielen Dank! Ihr Checkout wurde abgeschlossen. Falls die Anzeige noch nicht aktualisiert ist, versuchen Sie es bitte in ein paar Sekunden erneut.',
      }
    }
    if (canceled) {
      return {
        tone: 'neutral' as const,
        text: 'Der Checkout wurde abgebrochen. Sie können jederzeit erneut abschließen.',
      }
    }
    if (blocked) {
      return {
        tone: 'danger' as const,
        text: 'Für diesen Bereich ist ein aktives Abo erforderlich. Schließen Sie jetzt Ihr Abo ab, um AniDocs weiterhin vollständig zu nutzen.',
      }
    }

    if (billingState.subscription.status === 'trialing' && billingState.trial.isExpired) {
      return {
        tone: 'warning' as const,
        text: 'Testzeitraum in der App beendet — Stripe kann die Anzeige kurz verzögern. Bitte Seite neu laden.',
      }
    }
    if (billingState.subscription.status === 'trialing') {
      return {
        tone: 'neutral' as const,
        text: 'Ihr Abo befindet sich in der kostenlosen Testphase bei Stripe (siehe auch Stripe-Dashboard).',
      }
    }
    if (
      billingState.subscription.status === 'active' &&
      billingState.subscription.cancelAtPeriodEnd
    ) {
      return {
        tone: 'warning' as const,
        text: `Kündigung vorgemerkt: Ihr Abo läuft am ${formatDateDe(billingState.subscription.cancelAt)} aus. Bis dahin bleiben alle Funktionen aktiv.`,
      }
    }
    if (billingState.subscription.status === 'active') {
      return {
        tone: 'success' as const,
        text: 'Ihr Abo ist aktiv. Rechnungen und Zahlungsdaten können Sie jederzeit sicher über unser Zahlungsportal verwalten.',
      }
    }
    if (billingState.trial.isActive && billingState.subscription.status === 'none') {
      const days = billingState.trial.daysRemaining
      const daysLabel = typeof days === 'number' ? `${days} Tag${days === 1 ? '' : 'e'}` : 'einige Tage'
      return {
        tone: 'neutral' as const,
        text: `Ihr Testzeitraum läuft noch (${daysLabel} verbleibend).`,
      }
    }
    return null
  }, [billingState, billingCheckFailed, blocked, canceled, success])

  const openPortal = async () => {
    setError(null)
    setBusy('portal')
    const result = await postJson('/api/stripe/portal')
    setBusy(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    const w = window.open(result.url, '_blank', 'noopener,noreferrer')
    if (!w) {
      window.location.href = result.url
    }
  }

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    const res = await fetch('/api/stripe/payment-method/set-default', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentMethodId }),
    })
    const data = (await res.json().catch(() => null)) as any
    if (!res.ok) {
      throw new Error((data && typeof data.error === 'string' && data.error) || 'Zahlungsmethode konnte nicht gespeichert werden.')
    }
    await loadPaymentMethod()
    setEditingPaymentMethod(false)
  }

  const loadPaymentMethod = async () => {
    setPaymentLoading(true)
    try {
      const res = await fetch('/api/billing/payment-method', { method: 'GET' })
      const data = (await res.json().catch(() => null)) as any
      if (res.ok) {
        setPaymentMethod((data?.paymentMethod as PaymentMethodSummary | null) ?? null)
      }
    } finally {
      setPaymentLoading(false)
    }
  }

  const loadInvoices = async () => {
    setInvoicesLoading(true)
    try {
      const res = await fetch('/api/billing/invoices', { method: 'GET' })
      const data = (await res.json().catch(() => null)) as { invoices?: BillingInvoiceRow[] } | null
      if (res.ok && data && Array.isArray(data.invoices)) {
        setInvoices(data.invoices)
      }
    } finally {
      setInvoicesLoading(false)
    }
  }

  useEffect(() => {
    loadPaymentMethod()
    loadInvoices()
  }, [])

  const createSubscriptionFromPaymentMethod = async (paymentMethodId: string) => {
    const res = await fetch('/api/stripe/subscription/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentMethodId }),
    })
    const data = (await res.json().catch(() => null)) as any
    if (!res.ok) {
      throw new Error((data && typeof data.error === 'string' && data.error) || 'Abo konnte nicht erstellt werden.')
    }
    await loadPaymentMethod()
  }

  const showSubscribe =
    !isSubscriptionStatusLive(subscriptionStatus) &&
    subscriptionStatus !== 'past_due'

  return (
    <div className="space-y-5">
      {loadError && !error && (
        <div className="huf-card border border-[#FECACA] bg-[#FEF2F2] px-[22px] py-4 text-[14px] text-[#B91C1C]">
          {loadError}
        </div>
      )}

      {notice && (
        <div
          className={
            notice.tone === 'warning'
              ? 'app-info-callout px-[22px] py-4 text-[14px]'
              : `huf-card border px-[22px] py-4 text-[14px] ${
                  notice.tone === 'success'
                    ? 'bg-[#ECFDF3] text-[#027A48] border-[#ABEFC6]'
                    : notice.tone === 'danger'
                      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                      : 'bg-[#F8FAFC] text-[#334155] border-[#E2E8F0]'
                }`
          }
        >
          {notice.text}
        </div>
      )}

      {error && (
        <div className="huf-card border border-[#FECACA] bg-[#FEF2F2] px-[22px] py-4 text-[14px] text-[#B91C1C]">
          {error}
        </div>
      )}

      {billingState.access.mode === 'read_only' && (
        <SectionCard title="Datenexport" bodyClassName="px-[22px] py-5">
          <div id="datenexport-downloads" className="scroll-mt-24">
            <p className="text-[13px] leading-relaxed text-[#6B7280]">
              ZIP mit Stammdaten, Dokumentationen und Bildern. Der Export läuft auf dem Server — Sie erhalten eine E-Mail,
              wenn die Datei fertig ist. Den Download finden Sie unten unter „Ihre Exporte“ oder in den Einstellungen.
            </p>
            <DataExportButton className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1B1F23] px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-95 disabled:opacity-60">
              <i className="bi bi-download" aria-hidden />
              ZIP exportieren
            </DataExportButton>
            <div className="mt-6 border-t border-[#E5E2DC] pt-5">
              <h3 className="text-[14px] font-semibold text-[#1B1F23]">Ihre Exporte</h3>
              <div className="mt-3">
                <DataExportDownloadsPanel />
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* STATUS CARD — bei Zahlungsverzug keine große Warnkarte (Hinweis bleibt über Plan/Zahlungsbereich) */}
      {ui.key !== 'past_due' ? (
        <div className="huf-card border border-[#E5E2DC] px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div
            className={[
              'h-[52px] w-[52px] rounded-[14px] flex items-center justify-center text-[22px] shrink-0',
              ui.iconTone === 'blue'
                ? 'bg-[rgba(59,130,246,.06)] text-[#3B82F6]'
                : ui.iconTone === 'accent'
                  ? 'bg-[rgba(82,183,136,.06)] text-[#52b788]'
                  : ui.iconTone === 'warn'
                    ? 'bg-[#FDF6EC] text-[#B8860B]'
                    : ui.iconTone === 'danger'
                      ? 'bg-[#FEF2F2] text-[#DC2626]'
                      : 'bg-[#F3F4F6] text-[#6B7280]',
            ].join(' ')}
          >
            <i className={`bi ${ui.icon}`} aria-hidden />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-bold text-[#1B1F23]">{ui.title}</div>
            <div className="mt-0.5 text-[13px] text-[#6B7280] leading-[1.5]">
              {ui.detail}
            </div>

            {ui.showProgress && typeof trialDaysRemaining === 'number' && (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-[6px] flex-1 rounded-full bg-[#F0EEEA] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#3B82F6] transition-[width] duration-300"
                    style={{ width: `${trialProgressPct}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#9CA3AF] font-medium whitespace-nowrap">
                  {trialTotalDays - trialDaysRemaining} von {trialTotalDays} Tagen
                </div>
              </div>
            )}

            {ui.showNoCharge && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-[rgba(82,183,136,.15)] bg-[rgba(82,183,136,.06)] px-3 py-2 text-[12px] text-[#2D7A3A]">
                <i className="bi bi-shield-check mt-[1px]" aria-hidden />
                <div>
                  Während der Testphase erfolgt keine Abbuchung. Sie können jederzeit kündigen.
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0">
            <BillingStatusBadge
              status={billingState.subscription.status}
              cancelAtPeriodEnd={billingState.subscription.cancelAtPeriodEnd}
            />
          </div>
        </div>
      ) : null}

      {/* PLAN CARD */}
      <div className="huf-card border border-[#E5E2DC] overflow-hidden">
        <div className="border-b border-[#F0EEEA] px-6 py-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#52b788]">
            {billingState.plan.label}
          </div>

          <div className="mt-2 flex items-end gap-2">
            <div className="font-serif text-[44px] leading-none font-semibold tracking-[-0.02em] text-[#1B1F23]">
              39,95
            </div>
            <div className="pb-1 text-[16px] font-semibold text-[#6B7280]">€</div>
            <div className="pb-1 text-[14px] text-[#9CA3AF]">/ Monat</div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[13px] text-[#6B7280]">
            <i className="bi bi-gift-fill text-[#52b788]" aria-hidden />
            14 Tage kostenlos testen — danach monatlich kündbar
          </div>
        </div>

        <div className="border-b border-[#F0EEEA] px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9CA3AF]">
            Alles inklusive
          </div>

          <div className="mt-3 grid grid-cols-1 gap-y-2 gap-x-6 sm:grid-cols-2">
            {[
              'Unbegrenzt Tiere & Kunden',
              'Dokumentation mit Fotos',
              'PDF-Berichte per Klick',
              'Rechnungserstellung',
              'Terminverwaltung',
              'Offline‑Modus (PWA)',
              'Verlaufsberichte & Vergleich',
            ].map((t) => (
              <div key={t} className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                <i className="bi bi-check-circle-fill text-[#52b788]" aria-hidden />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          {subscriptionStatus === 'past_due' ? (
            <button
              type="button"
              className="h-[48px] w-full rounded-[12px] bg-[#1B1F23] text-white text-[16px] font-bold hover:bg-black disabled:opacity-60"
              onClick={openPortal}
              disabled={busy !== null}
            >
              Zahlung & Zahlungsmethode aktualisieren
            </button>
          ) : hasLiveSubscription ? (
            <button
              type="button"
              className="h-[48px] w-full rounded-[12px] bg-[#52b788] text-white text-[16px] font-bold hover:opacity-95 disabled:opacity-60"
              onClick={openPortal}
              disabled={busy !== null}
            >
              Abo verwalten (Stripe)
            </button>
          ) : (
            <button
              type="button"
              className={[
                'h-[48px] w-full rounded-[12px] text-white text-[16px] font-bold hover:opacity-95',
                ui.key === 'trial_expired' ? 'bg-[#1B1F23]' : 'bg-[#52b788]',
              ].join(' ')}
              onClick={() => {
                // If a payment method already exists, guide to "subscribe now" (not "add payment method").
                if (paymentMethod) setSubscribing(true)
                scrollToId('billing-payment')
              }}
            >
              {paymentMethod
                ? 'Abo jetzt abschließen'
                : ui.key === 'trial_expired'
                  ? 'Kostenpflichtig weiter nutzen'
                  : 'Zahlungsmethode hinzufügen'}
            </button>
          )}

          <div className="mt-2 text-center text-[12px] text-[#9CA3AF]">
            Zahlungen werden sicher über Stripe abgewickelt. Kartendaten werden nie auf AniDocs‑Servern gespeichert.
          </div>
        </div>
      </div>

      {/* PAYMENT SECTION */}
      <div id="billing-payment" className="huf-card border border-[#E5E2DC] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#E5E2DC] px-6 py-4">
          <i className="bi bi-credit-card-fill text-[#52b788]" aria-hidden />
          <div className="dashboard-serif text-[15px] font-medium text-[#1B1F23] flex-1">Zahlungsmethode</div>
          <button
            type="button"
            className="text-[12px] font-semibold text-[#52b788] hover:underline"
            onClick={openPortal}
            disabled={busy !== null}
          >
            Im Portal verwalten →
          </button>
        </div>
        <div className="px-6 py-5">
          {!showSubscribe ? (
            <div className="space-y-3">
              {paymentLoading ? (
                <div className="text-[13px] text-[#9CA3AF] py-2">Zahlungsmethode wird geladen…</div>
              ) : paymentMethod ? (
                <div className="huf-card bg-[#FAFAF8] border border-[#F0EEEA] px-5 py-4 rounded-[12px]">
                  <div className="text-[12px] font-semibold text-[#6B7280]">Hinterlegte Zahlungsmethode</div>
                  <div className="mt-3">
                    <PaymentMethodPreview pm={paymentMethod} />
                  </div>
                  <p className="mt-3 text-[11px] text-[#9CA3AF]">
                    Änderungen nehmen Sie über „Im Portal verwalten“ vor — Kartendaten liegen bei Stripe, nicht auf AniDocs.
                  </p>
                </div>
              ) : (
                <div className="text-center text-[13px] text-[#9CA3AF] py-4">
                  <i className="bi bi-credit-card text-[26px] opacity-20 block mb-2" aria-hidden />
                  {subscriptionStatus === 'past_due'
                    ? 'Bitte aktualisieren Sie Ihre Zahlungsmethode im Zahlungsportal.'
                    : 'Keine Zahlungsmethode per API gefunden — bitte im Stripe-Kundenportal prüfen oder hinterlegen.'}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full">
              {paymentLoading ? (
                <div className="text-[13px] text-[#9CA3AF]">Wird geladen…</div>
              ) : (paymentMethod && !editingPaymentMethod && !subscribing) ? (
                <div className="huf-card bg-[#FAFAF8] border border-[#F0EEEA] px-5 py-4 rounded-[12px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold text-[#6B7280]">Hinterlegte Zahlungsmethode</div>
                    <button
                      type="button"
                      className="rounded-md border border-[#E5E2DC] bg-white px-3 py-2 text-[11px] font-semibold text-[#6B7280] hover:border-[#9CA3AF]"
                      onClick={() => setEditingPaymentMethod(true)}
                      disabled={busy !== null}
                    >
                      Zahlungsmethode ändern
                    </button>
                  </div>

                  <div className="mt-3">
                    <PaymentMethodPreview pm={paymentMethod} />
                  </div>

                  {ui.key === 'trial_expired' || billingState.trial.isExpired ? (
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="text-[12px] text-[#6B7280]">
                        Ihre Testphase ist beendet. Schließen Sie jetzt Ihr Abo ab, um AniDocs weiter zu nutzen.
                      </div>
                      <button
                        type="button"
                        className="h-[44px] w-full rounded-[12px] bg-[#1B1F23] px-5 text-[14px] font-semibold text-white hover:bg-black disabled:opacity-60"
                        onClick={() => setSubscribing(true)}
                        disabled={busy !== null}
                      >
                        Abo jetzt abschließen
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="w-full">
                  <EmbeddedSubscribe
                    stripePublishableKey={stripePublishableKey}
                    title={
                      subscribing
                        ? 'Abo abschließen'
                        : paymentMethod
                          ? 'Zahlungsmethode ändern'
                          : 'Zahlungsmethode hinterlegen'
                    }
                    ctaLabel={
                      subscribing
                        ? 'Jetzt Abo abschließen'
                        : paymentMethod
                          ? 'Zahlungsmethode speichern'
                          : 'Zahlungsmethode speichern'
                    }
                    description={
                      subscribing
                        ? 'Schließen Sie Ihr AniDocs Abo jetzt ab. Falls eine 3D‑Secure‑Bestätigung nötig ist, öffnet sich ggf. ein kurzes Bestätigungsfenster Ihrer Bank.'
                        : paymentMethod
                          ? 'Ändern Sie Ihre Zahlungsmethode direkt hier. Die Aktualisierung wird sofort in Ihrem Stripe‑Konto hinterlegt.'
                          : isTrialActive
                            ? 'Damit Ihr Abo nach dem Testzeitraum nahtlos weiterläuft, können Sie schon jetzt eine Zahlungsmethode hinterlegen.'
                            : 'Hinterlegen Sie zuerst eine Zahlungsmethode. Danach wird Ihr AniDocs‑Abo eingerichtet und die erste Zahlung ausgelöst (3D‑Secure kann kurz erscheinen).'
                    }
                    prepareUrl={
                      subscribing
                        ? '/api/stripe/subscription/prepare'
                        : '/api/stripe/setup-intent/prepare'
                    }
                    onSetupIntentSucceeded={
                      subscribing
                        ? undefined
                        : paymentMethod
                          ? setDefaultPaymentMethod
                          : createSubscriptionFromPaymentMethod
                    }
                    onCompleted={async () => {
                      await loadPaymentMethod()
                      setEditingPaymentMethod(false)
                      setSubscribing(false)
                      router.refresh()
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* INVOICES SECTION */}
      <div className="huf-card border border-[#E5E2DC] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#E5E2DC] px-6 py-4">
          <i className="bi bi-receipt text-[#52b788]" aria-hidden />
          <div className="dashboard-serif text-[15px] font-medium text-[#1B1F23] flex-1">Rechnungen</div>
          <button
            type="button"
            className="text-[12px] font-semibold text-[#52b788] hover:underline"
            onClick={openPortal}
            disabled={busy !== null}
          >
            Stripe Kundenportal →
          </button>
        </div>
        <div className="px-6 py-5">
          {invoicesLoading ? (
            <div className="text-[13px] text-[#9CA3AF] py-2">Rechnungen werden geladen…</div>
          ) : invoices.length > 0 ? (
            <ul className="divide-y divide-[#F0EEEA]">
              {invoices.map((inv) => {
                const href = inv.hostedInvoiceUrl ?? inv.invoicePdfUrl
                const date =
                  inv.createdUnix > 0
                    ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(inv.createdUnix * 1000))
                    : '—'
                const idShort = (inv.id && inv.id.length >= 8 ? inv.id.slice(-8) : inv.id) || '—'
                const label = inv.number ? `Rechnung ${inv.number}` : `Rechnung ${idShort}`
                const betragCents =
                  inv.status === 'paid'
                    ? inv.amountPaidCents
                    : typeof inv.totalCents === 'number'
                      ? inv.totalCents
                      : inv.amountPaidCents
                return (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#1B1F23]">{label}</div>
                      <div className="mt-0.5 text-[11px] text-[#9CA3AF]">
                        {date}
                        {inv.status ? ` · ${inv.status}` : ''} · {formatMoneyCents(betragCents, inv.currency)}
                      </div>
                    </div>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold text-[#52b788] hover:border-[#52b788]"
                      >
                        Ansehen / PDF
                      </a>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="text-center text-[13px] text-[#9CA3AF] py-3">
              <i className="bi bi-receipt text-[26px] opacity-20 block mb-2" aria-hidden />
              Noch keine Rechnungen von Stripe gelistet — sobald Abbuchungen laufen, erscheinen sie hier (Download weiterhin bei
              Stripe gehostet).
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
            PDFs und Zahlungsbelege liegen bei Stripe; AniDocs speichert keine Rechnungs-PDFs auf eigenen Servern.
            Leere Stripe-Entwürfe (Testuhr / Sandbox) werden nicht angezeigt; der bezahlte Posten (z.&nbsp;B. 39,95&nbsp;€) ist maßgeblich.
          </p>
        </div>
      </div>

      {/* TRUST ROW */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: 'bi-shield-lock-fill',
            title: 'Sichere Zahlung',
            text: 'Alle Zahlungen werden über Stripe verarbeitet. Zahlungsdaten werden nie auf AniDocs‑Servern gespeichert.',
          },
          {
            icon: 'bi-arrow-repeat',
            title: 'Monatlich kündbar',
            text: 'Keine Mindestlaufzeit. Sie können jederzeit im Kundenportal kündigen oder verwalten.',
          },
          {
            icon: 'bi-lock-fill',
            title: 'Daten geschützt',
            text: 'Ihre Daten gehören Ihnen. Bei Kündigung können Sie sie weiterhin exportieren.',
          },
        ].map((t) => (
          <div key={t.title} className="huf-card border border-[#E5E2DC] px-4 py-3 flex items-start gap-3">
            <div className="h-9 w-9 rounded-[10px] bg-[#FAFAF8] flex items-center justify-center text-[#9CA3AF] text-[18px] shrink-0">
              <i className={`bi ${t.icon}`} aria-hidden />
            </div>
            <div className="text-[12px] text-[#6B7280] leading-[1.4]">
              <div className="font-semibold text-[#1B1F23]">{t.title}</div>
              <div className="mt-0.5">{t.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-[#9CA3AF]">
        <span className="inline-flex h-[20px] items-center rounded-full border border-[#E5E2DC] bg-white px-2">
          Stripe
        </span>
        <span>·</span>
        <span>Zahlungsabwicklung über Stripe · SSL‑verschlüsselt</span>
      </div>
    </div>
  )
}

