import type { ReactNode } from 'react'

export default function BillingStatusBadge({
  status,
  cancelAtPeriodEnd,
}: {
  status: string
  /** Stripe: Abo noch active, Kündigung zum Laufzeitende vorgemerkt. */
  cancelAtPeriodEnd?: boolean
}): ReactNode {
  const s = status || 'none'
  const base =
    'inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset'

  if (s === 'active' && cancelAtPeriodEnd) {
    return (
      <span className={`${base} bg-[#FFFBEB] text-[#92400E] ring-[#FDE68A]`}>
        Kündigung vorgemerkt
      </span>
    )
  }

  if (s === 'trialing') {
    return (
      <span className={`${base} bg-[#ECFDF3] text-[#027A48] ring-[#ABEFC6]`}>
        Testphase aktiv
      </span>
    )
  }
  if (s === 'active') {
    return (
      <span className={`${base} bg-[#EFF6FF] text-[#1D4ED8] ring-[#BFDBFE]`}>
        Aktiv
      </span>
    )
  }
  if (s === 'past_due') {
    return (
      <span className={`${base} bg-[#FFFBEB] text-[#92400E] ring-[#FDE68A]`}>
        Zahlung offen
      </span>
    )
  }
  if (s === 'canceled') {
    return (
      <span className={`${base} bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]`}>
        Gekündigt
      </span>
    )
  }
  if (s === 'unpaid' || s === 'incomplete' || s === 'incomplete_expired') {
    return (
      <span className={`${base} bg-[#FEF2F2] text-[#B91C1C] ring-[#FECACA]`}>
        Zahlung fehlgeschlagen
      </span>
    )
  }

  if (s === 'none') {
    return (
      <span className={`${base} bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]`}>
        Kein Abo
      </span>
    )
  }

  return (
    <span className={`${base} bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]`}>
      {s}
    </span>
  )
}

