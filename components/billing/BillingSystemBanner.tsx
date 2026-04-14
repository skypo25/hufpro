'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'

type BannerTone = 'warning' | 'danger'

function toneStyles(tone: BannerTone) {
  if (tone === 'danger') {
    return {
      wrap: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
      /** Explizit !text-white: sonst erbt das <a> die Banner-Textfarbe → roter Text auf rotem Button (unsichtbar). */
      btn: 'bg-[#B91C1C] !text-white',
      icon: 'bi-exclamation-circle-fill',
    }
  }
  return {
    /** Farbe/Hintergrund: `.app-info-callout` in globals.css */
    wrap: '',
    btn: 'bg-[#8a4a12] !text-white',
    icon: 'bi-exclamation-triangle-fill',
  }
}

export default function BillingSystemBanner() {
  const pathname = usePathname()
  const [account, setAccount] = useState<BillingAccountRow | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/billing/account', { method: 'GET' })
        const data = (await res.json().catch(() => null)) as { account?: BillingAccountRow | null } | null
        let next = (res.ok ? (data?.account as BillingAccountRow | null) : null) ?? null
        const st = (next?.subscription_status ?? '').toString()
        /** DB kann hinter Stripe zurückhängen — einmal Abgleich, dann Banner nur bei echtem Problem. */
        if (
          !cancelled &&
          res.ok &&
          next &&
          (st === 'past_due' || st === 'unpaid' || st === 'incomplete')
        ) {
          const syncRes = await fetch('/api/billing/sync-subscription', { method: 'POST' })
          const syncData = (await syncRes.json().catch(() => null)) as { account?: BillingAccountRow | null } | null
          if (syncRes.ok && syncData?.account) {
            next = syncData.account
          }
        }
        if (!cancelled && res.ok) {
          setAccount(next)
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    const schedule =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback(() => run(), { timeout: 2500 })
        : setTimeout(run, 0)
    return () => {
      cancelled = true
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(schedule as number)
      } else {
        clearTimeout(schedule as ReturnType<typeof setTimeout>)
      }
    }
  }, [])

  const state = useMemo(
    () => getBillingState({ account, priceIdMonthly: null }),
    [account]
  )

  // Don't show on billing page itself (page has its own detailed alerts).
  if ((pathname ?? '').startsWith('/billing')) return null
  if (!loaded) return null

  const status = state.subscription.status
  const trialExpiredNoSub = state.trial.isExpired && status === 'none'

  const banner = (() => {
    if (status === 'past_due') {
      return {
        tone: 'warning' as const,
        title: 'Zahlung ausstehend',
        text: 'Es gab ein Problem mit einer Abbuchung. Bitte aktualisieren Sie Ihre Zahlungsmethode, um eine Unterbrechung zu vermeiden.',
        cta: 'Jetzt prüfen',
      }
    }
    if (status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') {
      return {
        tone: 'danger' as const,
        title: 'Zahlung fehlgeschlagen',
        text: 'Ihre Zahlung konnte nicht verarbeitet werden. Bitte hinterlegen Sie eine gültige Zahlungsmethode.',
        cta: 'Zu Billing',
      }
    }
    if (trialExpiredNoSub) {
      return {
        tone: 'danger' as const,
        title: 'Testphase abgelaufen',
        text: 'Ihr Testzeitraum ist abgelaufen. Schließen Sie jetzt Ihr Abo ab, um AniDocs weiterhin vollständig zu nutzen.',
        cta: 'Abo abschließen',
      }
    }
    return null
  })()

  if (!banner) return null
  const s = toneStyles(banner.tone)

  return (
    <div className="px-4 pt-3 pb-1">
      <Link
        href="/billing"
        aria-label={`${banner.title}. ${banner.cta}`}
        className={`block px-4 py-3 text-[13px] no-underline transition-opacity hover:opacity-95 ${
          banner.tone === 'warning' ? 'app-info-callout' : `huf-card border ${s.wrap}`
        }`}
      >
        <div className="flex items-start gap-3">
          <i className={`bi ${s.icon} mt-[1px] shrink-0 text-[16px]`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{banner.title}</div>
            <div className="mt-0.5">{banner.text}</div>
          </div>
          <span
            className={`pointer-events-none shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold ${s.btn}`}
          >
            {banner.cta}
          </span>
        </div>
      </Link>
    </div>
  )
}

