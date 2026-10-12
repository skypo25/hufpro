import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePdfDocument from '@/components/pdf/InvoicePdfDocument'
import { buildInvoicePdfBuffer } from '@/lib/einvoice/zugferd'
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

  const { data: invMeta } = await supabase
    .from('invoices')
    .select('zugferd_enabled')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle()

  const url = new URL(request.url)
  // Query überschreibt Rechnungseinstellung (?zugferd=0|1)
  let withZugferd = invMeta?.zugferd_enabled === true
  if (url.searchParams.has('zugferd')) {
    withZugferd = url.searchParams.get('zugferd') !== '0'
  }

  const element = React.createElement(InvoicePdfDocument, { data })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any)
  const finalPdfBuffer = await buildInvoicePdfBuffer(
    Buffer.from(pdfBuffer),
    data,
    withZugferd,
  )
  const pdfUint8 = new Uint8Array(finalPdfBuffer)
  const filename = `Rechnung-${data.invoiceNumber}.pdf`

  return new NextResponse(pdfUint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
      'X-AniDocs-Zugferd': withZugferd ? '1' : '0',
    },
  })
}
