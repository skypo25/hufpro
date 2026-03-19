import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { fetchRecordPdfData } from "@/lib/pdf/recordData"
import RecordPdfDocument from "@/components/pdf/RecordPdfDocument"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string; recordId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 })
  }

  const { id: horseId, recordId } = await params

  const data = await fetchRecordPdfData(
    supabase,
    user.id,
    horseId,
    recordId
  )

  if (!data) {
    return NextResponse.json(
      { error: "Dokumentation nicht gefunden" },
      { status: 404 }
    )
  }

  const element = React.createElement(RecordPdfDocument, { data })

  const pdfBuffer = await renderToBuffer(element)
  const pdfUint8 = new Uint8Array(pdfBuffer)

  const url = new URL(request.url)
  const isPreview = url.searchParams.get("preview") === "1"
  const disposition = isPreview ? "inline" : "attachment"
  const filename = `Befundbericht-${data.horse.name}-${data.record.recordDate ?? "ohne-Datum"}.pdf`

  return new NextResponse(pdfUint8, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-cache",
    },
  })
}
