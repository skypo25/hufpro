import { NextResponse } from 'next/server'
import { buildUserDataExportZip } from '@/lib/export/buildUserExportZip'
import { requireExportAccess } from '@/lib/export/exportAccess.server'

/** Direktdownload (ohne Fortschritts-UI); für Skripte / alte Links. */
export async function GET() {
  const gate = await requireExportAccess()
  if (!gate.ok) return gate.response

  try {
    const buf = await buildUserDataExportZip(gate.userId)
    const day = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="anidocs-export-${day}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Export fehlgeschlagen.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
