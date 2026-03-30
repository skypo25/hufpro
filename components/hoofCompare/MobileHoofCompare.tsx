'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import HoofCompareMobileClient from '@/components/hoofCompare/HoofCompareMobileClient'
import type { HorseHoofCompareLoaded } from '@/lib/hoofCompare/loadHorseHoofComparePageData'

export default function MobileHoofCompare({ horseId }: { horseId: string }) {
  const searchParams = useSearchParams()
  const [data, setData] = useState<HorseHoofCompareLoaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const q = searchParams.toString()
    setLoading(true)
    fetch(`/api/horses/${encodeURIComponent(horseId)}/hoof-compare${q ? `?${q}` : ''}`, {
      credentials: 'include',
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          if (r.status === 400 && j?.error === 'insufficient_records') {
            throw new Error('insufficient')
          }
          throw new Error(typeof j?.error === 'string' ? j.error : r.statusText)
        }
        return j as HorseHoofCompareLoaded
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message === 'insufficient' ? 'insufficient' : e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [horseId, searchParams])

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-2 px-6 text-[14px] text-[#6B7280]">
        <i className="bi bi-hourglass-split text-[20px]" aria-hidden />
        Fotovergleich wird geladen…
      </div>
    )
  }

  if (error === 'insufficient') {
    return (
      <main className="mx-auto max-w-[430px] space-y-4 px-4 py-10">
        <h1 className="dashboard-serif text-[20px] font-medium text-[#1B1F23]">Fotovergleich</h1>
        <p className="text-[14px] leading-relaxed text-[#6B7280]">
          Für einen Vergleich werden mindestens zwei Dokumentationen benötigt.
        </p>
        <Link href={`/animals/${horseId}`} className="inline-flex text-[14px] font-medium text-[#52b788]">
          Zurück zum Tier
        </Link>
      </main>
    )
  }

  if (error || !data) {
    return (
      <div className="px-4 py-10 text-center text-[14px] text-red-600">
        {error ?? 'Daten konnten nicht geladen werden.'}
      </div>
    )
  }

  return <HoofCompareMobileClient {...data} />
}
