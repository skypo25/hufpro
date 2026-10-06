'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import InvoiceDetailView from '@/components/invoices/InvoiceDetailView'
import type { InvoicePdfData } from '@/lib/pdf/invoiceTypes'

export default function MobileInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [data, setData] = useState<InvoicePdfData | null>(null)
  const [status, setStatus] = useState('sent')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}/mobile`, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (res.status === 404) throw new Error('Rechnung nicht gefunden')
        if (!res.ok) throw new Error((json as { error?: string }).error || 'Laden fehlgeschlagen')
        if ((json as { redirectTo?: string }).redirectTo) {
          router.replace((json as { redirectTo: string }).redirectTo)
          return
        }
        setData((json as { data: InvoicePdfData }).data)
        setStatus((json as { status: string }).status)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
      })
  }, [invoiceId, router])

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

  if (!data) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center px-6 text-[14px] text-[#6B7280]">
        Rechnung wird geladen…
      </div>
    )
  }

  return (
    <div className="pb-4">
      <InvoiceDetailView data={data} backHref="/invoices" invoiceId={invoiceId} status={status} />
    </div>
  )
}
