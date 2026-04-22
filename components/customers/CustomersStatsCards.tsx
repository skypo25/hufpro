'use client'

import { useEffect, useRef, useState } from 'react'
import StatCard from '@/components/ui/StatCard'
import CountUp from '@/components/dashboard/CountUp'

type CustomersStatsCardsProps = {
  customerCount: number
  horseCount: number
  appointmentsThisWeek: number
  currentView: 'list' | 'cards'
  avgHorsesPerCustomer: string
}

export default function CustomersStatsCards({
  customerCount,
  horseCount,
  appointmentsThisWeek,
  currentView,
  avgHorsesPerCustomer,
}: CustomersStatsCardsProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true)
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const stats = [
    {
      label: 'Kunden gesamt',
      value: customerCount,
      subtext: 'alle Kunden',
      valueClassName: '',
    },
    {
      label: 'Tiere in Betreuung',
      value: horseCount,
      subtext: `Ø ${avgHorsesPerCustomer} pro Kunde`,
      valueClassName: '',
    },
    {
      label: 'Termine diese Woche',
      value: appointmentsThisWeek,
      subtext: 'geplante Termine',
      valueClassName: 'text-[#006d6d]',
    },
    {
      label: 'Suche / Ansicht',
      value: currentView === 'cards' ? 'Karten' : 'Liste',
      subtext: 'aktive Darstellung',
      valueClassName: '',
      isText: true,
    },
  ]

  return (
    <div
      id="customers-stats-grid"
      ref={gridRef}
      className={`grid gap-4 md:grid-cols-2 xl:grid-cols-4 group ${visible ? 'stats-visible' : ''}`}
    >
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="stats-card transition-all duration-500 ease-out opacity-0 translate-y-3 group-[.stats-visible]:opacity-100 group-[.stats-visible]:translate-y-0"
          style={{ transitionDelay: `${index * 80}ms` }}
        >
          <StatCard
            label={stat.label}
            value={
              stat.isText ? (
                stat.value
              ) : (
                <CountUp
                  value={stat.value as number}
                  duration={1400}
                  delay={index * 80}
                  startOnView
                  observerId="customers-stats-grid"
                />
              )
            }
            subtext={stat.subtext}
            valueClassName={stat.valueClassName}
          />
        </div>
      ))}
    </div>
  )
}
