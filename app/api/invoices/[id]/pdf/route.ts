import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePdfDocument from '@/components/pdf/InvoicePdfDocument'
import { embedZugferdIntoPdf } from '@/lib/einvoice/zugferd'
import { fetchInvoicePdfData } from '@/lib/pdf/invoiceData'
import { getSupabaseAndUser } from '@/lib/supabase-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

/** PDF für Flutter (Bearer) und Clients ohne Cookie-Session. */
export async function GET(request: Request, { params }: RouteParams) {
  const { user, supabase } = await getSupabaseAndUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { id: invoiceId } = await params
  const data = await fetchInvoicePdfData(supabase, user.id, invoiceId)
  if (!data) {
    return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
  }

  const element = React.createElement(InvoicePdfDocument, { data })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any)
  const url = new URL(request.url)
  const withZugferd = url.searchParams.get('zugferd') !== '0'
  const finalPdfBuffer = withZugferd
    ? await embedZugferdIntoPdf(Buffer.from(pdfBuffer), data)
    : Buffer.from(pdfBuffer)
  const pdfUint8 = new Uint8Array(finalPdfBuffer)
  const filename = `Rechnung-${data.invoiceNumber}.pdf`

  return new NextResponse(pdfUint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
