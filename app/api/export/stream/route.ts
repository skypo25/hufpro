import { randomUUID } from 'crypto'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { buildUserDataExportZip } from '@/lib/export/buildUserExportZip'
import { DATA_EXPORTS_BUCKET } from '@/lib/export/dataExportsBucket'
import { requireExportAccess } from '@/lib/export/exportAccess.server'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Server-Sent Events: Fortschritt während ZIP-Erstellung, am Ende signierte Download-URL.
 * Client: fetch + ReadableStream lesen (kein EventSource nötig).
 */
export async function GET() {
  const gate = await requireExportAccess()
  if (!gate.ok) return gate.response

  const { userId } = gate
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      try {
        const buf = await buildUserDataExportZip(userId, {
          onProgress: (p) => send({ type: 'progress', percent: p.percent, label: p.label }),
        })

        send({ type: 'progress', percent: 94, label: 'Upload für sicheren Download …' })

        const admin = createSupabaseServiceRoleClient()
        const objectPath = `${userId}/${randomUUID()}.zip`
        const { error: upErr } = await admin.storage.from(DATA_EXPORTS_BUCKET).upload(objectPath, buf, {
          contentType: 'application/zip',
          upsert: false,
        })
        if (upErr) {
          throw new Error(
            `Export-Speicher (${DATA_EXPORTS_BUCKET}): ${upErr.message}. Ist die Storage-Migration ausgeführt?`
          )
        }

        const { data: signed, error: signErr } = await admin.storage
          .from(DATA_EXPORTS_BUCKET)
          .createSignedUrl(objectPath, 600)

        if (signErr || !signed?.signedUrl) {
          throw new Error(signErr?.message ?? 'Signierte Download-URL konnte nicht erstellt werden.')
        }

        const day = new Date().toISOString().slice(0, 10)
        send({
          type: 'complete',
          downloadUrl: signed.signedUrl,
          filename: `anidocs-export-${day}.zip`,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Export fehlgeschlagen.'
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
