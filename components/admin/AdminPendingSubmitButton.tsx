'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

const baseClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] transition hover:border-primary hover:bg-primary/5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60'

export default function AdminPendingSubmitButton({
  children,
  pendingLabel = 'Wird ausgeführt…',
  className = '',
  variant = 'default',
}: {
  children: ReactNode
  pendingLabel?: string
  className?: string
  variant?: 'default' | 'danger'
}) {
  const { pending } = useFormStatus()
  const tone =
    variant === 'danger'
      ? 'border-[rgba(220,38,38,.25)] text-[#DC2626] hover:border-[#DC2626] hover:bg-[rgba(220,38,38,.06)]'
      : ''

  return (
    <button type="submit" disabled={pending} className={[baseClass, tone, className].filter(Boolean).join(' ')}>
      {pending ? pendingLabel : children}
    </button>
  )
}
