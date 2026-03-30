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
      btn: 'bg-[#B91C1C] text-white',
      icon: 'bi-exclamation-circle-fill',
    }
  }
  return {
    wrap: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
    btn: 'bg-[#B8860B] text-white',
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
        const data = (await res.json().catch(() => null)) as any
        if (!cancelled && res.ok) {
          setAccount((data?.account as BillingAccountRow | null) ?? null)
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
      <div className={`huf-card border px-4 py-3 text-[13px] ${s.wrap}`}>
        <div className="flex items-start gap-3">
          <i className={`bi ${s.icon} mt-[1px] text-[16px]`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{banner.title}</div>
            <div className="mt-0.5">{banner.text}</div>
          </div>
          <Link
            href="/billing"
            className={`shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold hover:opacity-95 ${s.btn}`}
          >
            {banner.cta}
          </Link>
        </div>
      </div>
    </div>
  )
}

