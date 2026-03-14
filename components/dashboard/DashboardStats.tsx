'use client'

import { useEffect, useRef, useState } from 'react'
import CountUp from './CountUp'

export type DashboardStatItem = {
  label: string
  value: number
  badge: string
  tone: string
}

type DashboardStatsProps = {
  stats: DashboardStatItem[]
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
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

  return (
    <div
      id="dashboard-stats-grid"
      ref={gridRef}
      className={`grid gap-4 md:grid-cols-2 xl:grid-cols-4 group ${visible ? 'dashboard-stats-visible' : ''}`}
    >
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="dashboard-stat-card huf-card relative overflow-hidden px-[22px] py-5 transition-all duration-500 ease-out opacity-0 -translate-y-3 group-[.dashboard-stats-visible]:opacity-100 group-[.dashboard-stats-visible]:translate-y-0"
          style={{ transitionDelay: `${index * 80}ms` }}
        >
          <div
            className={`absolute right-0 top-0 h-20 w-20 translate-x-[30%] -translate-y-[30%] rounded-full opacity-40 ${stat.tone}`}
          />

          <div className="relative">
            <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {stat.label}
            </div>

            <div className="dashboard-serif text-[30px] font-medium leading-none tracking-[-0.02em] text-[#1B1F23] tabular-nums">
              <CountUp value={stat.value} duration={1400} delay={index * 80} startOnView />
            </div>

            <div
              className={[
                'mt-3 inline-flex rounded-full px-[8px] py-[3px] text-[12px] font-medium',
                index === 0 || index === 1
                  ? 'bg-[rgba(52,168,83,0.08)] text-[#34A853]'
                  : index === 2
                    ? 'bg-[rgba(0,0,0,0.04)] text-[#9CA3AF]'
                    : 'bg-[rgba(245,158,11,0.08)] text-[#F59E0B]',
              ].join(' ')}
            >
              {stat.badge}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
