'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import NewInvoiceForm from '@/components/invoices/NewInvoiceForm'

type ComposePayload = {
  customers: ComponentProps<typeof NewInvoiceForm>['customers']
  initialCustomer: ComponentProps<typeof NewInvoiceForm>['initialCustomer']
  horses: ComponentProps<typeof NewInvoiceForm>['horses']
  customerStats: ComponentProps<typeof NewInvoiceForm>['customerStats']
  services: ComponentProps<typeof NewInvoiceForm>['services']
  invoiceNumber: string
  nextInvoiceNumber: string
  defaultIntroText: string
  defaultFooterText: string
  sellerName: string
  sellerAddress: string
  editMode?: ComponentProps<typeof NewInvoiceForm>['editMode']
}

export default function MobileInvoiceCompose({ invoiceId }: { invoiceId?: string }) {
  const searchParams = useSearchParams()
  const customerId = searchParams.get('customerId')?.trim() || ''
  const [payload, setPayload] = useState<ComposePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (invoiceId) params.set('invoiceId', invoiceId)
    else if (customerId) params.set('customerId', customerId)
    fetch(`/api/invoices/compose/mobile?${params}`, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((json as { error?: string }).error || 'Laden fehlgeschlagen')
        setPayload(json as ComposePayload)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
      })
  }, [invoiceId, customerId])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="text-[14px] text-[#6B7280]">{error}</p>
        <Link href="/invoices" className="text-[14px] font-medium text-primary">
          Zur Übersicht
        </Link>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center px-6 text-[14px] text-[#6B7280]">
        Rechnung wird geladen…
      </div>
    )
  }

  return (
    <div className="mobile-invoice-compose pb-8">
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <h1 className="mobile-greeting">{payload.editMode ? 'Rechnung bearbeiten' : 'Neue Rechnung'}</h1>
            <div className="mobile-sub">{payload.invoiceNumber}</div>
          </div>
          <Link href="/invoices" className="ah-btn" aria-label="Zurück zur Übersicht">
            <i className="bi bi-x-lg text-[16px]" aria-hidden />
          </Link>
        </div>
      </header>
      <div className="mobile-content mobile-form-embed-root">
        <NewInvoiceForm {...payload} />
      </div>
    </div>
  )
}
