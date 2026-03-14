'use client'

import { useState, useEffect } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

type RevenueChartProps = {
  /** Umsatz pro Monat in Cent, Index 0 = Januar … 11 = Dezember */
  monthlyCents: number[]
  /** Gesamtumsatz in Cent (z. B. für Anzeige unter dem Chart) */
  totalCents: number
}

function formatEuro(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export default function RevenueChart({ monthlyCents, totalCents }: RevenueChartProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      setTimeout(() => setAnimated(true), 80)
    })
    return () => cancelAnimationFrame(t)
  }, [])

  const maxCents = Math.max(1, ...monthlyCents)
  const barHeightPercent = (cents: number) => (cents / maxCents) * 100

  return (
    <div className="px-[22px] py-[22px] text-center">
      <div className="flex h-[120px] items-end justify-center gap-2 py-4">
        {monthlyCents.map((cents, i) => (
          <div
            key={i}
            className="w-7 rounded-t-md bg-[#edf3ef] transition-[height] duration-700 ease-out"
            style={{
              height: animated ? `${barHeightPercent(cents)}%` : '0%',
              minHeight: 4,
              backgroundColor: i === new Date().getMonth() ? '#154226' : undefined,
              transitionDelay: `${i * 50}ms`,
            }}
            title={formatEuro(cents)}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-center gap-2">
        {MONTHS.map((month) => (
          <span key={month} className="w-7 text-center text-[10px] text-[#9CA3AF]">
            {month}
          </span>
        ))}
      </div>

      <div className="dashboard-serif mt-3 text-[24px] font-medium text-[#1B1F23]">
        {formatEuro(totalCents)}
      </div>
      <div className="text-[12px] text-[#6B7280]">Umsatz 2026 (bezahlte & offene Rechnungen)</div>
    </div>
  )
}
