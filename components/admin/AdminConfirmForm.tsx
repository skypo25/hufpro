'use client'

import type { ReactNode } from 'react'

/** Server-Action-Form mit Browser-Confirm vor Submit. */
export default function AdminConfirmForm({
  action,
  confirmMessage,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>
  confirmMessage: string
  children: ReactNode
  className?: string
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault()
      }}
    >
      {children}
    </form>
  )
}
