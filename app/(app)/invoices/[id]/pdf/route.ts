import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { fetchInvoicePdfData } from "@/lib/pdf/invoiceData"
import InvoicePdfDocument from "@/components/pdf/InvoicePdfDocument"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 })
  }

  const { id: invoiceId } = await params

  const data = await fetchInvoicePdfData(supabase, user.id, invoiceId)

  if (!data) {
    return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 })
  }

  const element = React.createElement(InvoicePdfDocument, { data })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any)
  const pdfUint8 = new Uint8Array(pdfBuffer)

  const url = new URL(request.url)
  const disposition = url.searchParams.get("preview") === "1" ? "inline" : "attachment"
  const filename = `Rechnung-${data.invoiceNumber}.pdf`

  return new NextResponse(pdfUint8, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  })
}
