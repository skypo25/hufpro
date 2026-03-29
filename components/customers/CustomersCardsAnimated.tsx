'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatShortGermanDate, getInitials } from '@/lib/format'
import EmptyState from '@/components/ui/EmptyState'

type Customer = {
  id: string
  customer_number?: number | null
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
}

export type CustomerCardRow = {
  customer: Customer
  locationLine: string
  horseCount: number
  animalsSummary: string
  horseNames: string[]
  nextAppointment: string | null
  nextAppointmentHorseCount: number
}

type CustomersCardsAnimatedProps = {
  rows: CustomerCardRow[]
  emptyDescription?: string
}

export default function CustomersCardsAnimated({
  rows,
  emptyDescription = 'Keine Kunden gefunden.',
}: CustomersCardsAnimatedProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true)
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (rows.length === 0) {
    return <EmptyState description={emptyDescription} />
  }

  return (
    <div
      ref={gridRef}
      className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 group ${visible ? 'cards-visible' : ''}`}
    >
      {rows.map((row, index) => {
        const location = row.locationLine
        return (
          <Link
            key={row.customer.id}
            href={`/customers/${row.customer.id}`}
            className="huf-card transition-all duration-500 ease-out opacity-0 -translate-y-3 group-[.cards-visible]:opacity-100 group-[.cards-visible]:translate-y-0 hover:-translate-y-[2px] hover:border-[#52b788] hover:shadow-md"
            style={{ transitionDelay: `${index * 60}ms` }}
          >
            <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-[22px] py-5">
              <div
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#154227] text-[12px] font-semibold text-white"
              >
                {getInitials(row.customer.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold text-[#1B1F23]">
                  {row.customer.name || '-'}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#6B7280]">
                  <i className="bi bi-geo-alt text-[12px]" />
                  <span className="truncate">{location}</span>
                </div>
              </div>

              <div className="rounded-lg bg-[#edf3ef] px-3 py-1 text-[12px] font-semibold text-[#0f301b]">
                {row.animalsSummary}
              </div>
            </div>

            <div className="space-y-2 px-[22px] py-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6B7280]">Nächster Termin</span>
                <span className="font-medium text-[#1B1F23]">
                  {row.nextAppointment
                    ? formatShortGermanDate(row.nextAppointment)
                    : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6B7280]">Telefon</span>
                <span className="font-medium text-[#1B1F23]">
                  {row.customer.phone || '-'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6B7280]">E-Mail</span>
                <span className="max-w-[180px] truncate font-medium text-[#1B1F23]">
                  {row.customer.email || '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#E5E2DC] bg-[rgba(0,0,0,0.015)] px-[22px] py-3">
              <span className="truncate text-[12px] text-[#6B7280]">
                {row.horseNames.length > 0
                  ? row.horseNames.join(' · ')
                  : 'Keine Tiere'}
              </span>
              <span className="ml-3 whitespace-nowrap text-[12px] font-semibold text-[#52b788]">
                Details →
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
