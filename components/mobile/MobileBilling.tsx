'use client'

import { useEffect, useState } from 'react'
import BillingPageClient from '@/components/billing/BillingPageClient'
import type { BillingAccountRow } from '@/lib/billing/types'

export default function MobileBilling() {
  const [account, setAccount] = useState<BillingAccountRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/billing/account', { method: 'GET' })
        const data = (await res.json().catch(() => null)) as any
        if (!res.ok) {
          throw new Error((data && typeof data.error === 'string' && data.error) || 'Fehler beim Laden.')
        }
        if (!cancelled) {
          setAccount((data?.account as BillingAccountRow | null) ?? null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler beim Laden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[35dvh] items-center justify-center px-6 text-[14px] text-[#6B7280]">
        Billing wird geladen…
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <div className="huf-card p-4 text-[14px] text-red-700">{error}</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <BillingPageClient
        account={account}
        priceIdMonthly={null}
        stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null}
      />
    </div>
  )
}

