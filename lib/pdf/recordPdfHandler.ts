import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { fetchRecordPdfData } from '@/lib/pdf/recordData'
import RecordPdfDocument from '@/components/pdf/RecordPdfDocument'

/**
 * Gemeinsame PDF-Antwort für /horses/.../pdf und /animals/.../pdf (kein default-Reexport möglich).
 */
export async function respondRecordPdf(
  request: Request,
  supabase: SupabaseClient,
  userId: string,
  horseId: string,
  recordId: string
): Promise<NextResponse> {
  const data = await fetchRecordPdfData(supabase, userId, horseId, recordId)

  if (!data) {
    return NextResponse.json({ error: 'Dokumentation nicht gefunden' }, { status: 404 })
  }

  const element = React.createElement(RecordPdfDocument, { data })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any)
  const pdfUint8 = new Uint8Array(pdfBuffer)

  const url = new URL(request.url)
  const isPreview = url.searchParams.get('preview') === '1'
  const disposition = isPreview ? 'inline' : 'attachment'
  const filename = `Befundbericht-${data.horse.name}-${data.record.recordDate ?? 'ohne-Datum'}.pdf`

  return new NextResponse(pdfUint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
