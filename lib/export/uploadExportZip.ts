import 'server-only'
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DATA_EXPORTS_BUCKET } from '@/lib/export/dataExportsBucket'

const FALLBACK_BUCKET = 'hoof-photos'
/** Keine Kollision mit Nutzer-Pfaden; ggf. per Job/Retention aufräumen. */
const FALLBACK_PREFIX = '__anidocs-export-temp'

/**
 * Lädt die ZIP hoch und liefert eine signierte Download-URL.
 * Primär: Bucket `data-exports` (Migration). Fallback: `hoof-photos`, falls der Bucket fehlt.
 */
export async function uploadExportZipAndSign(args: {
  admin: SupabaseClient
  userId: string
  buf: Buffer
  expiresSec?: number
}): Promise<{ signedUrl: string }> {
  const { admin, userId, buf } = args
  const expiresSec = args.expiresSec ?? 600
  const objectPath = `${userId}/${randomUUID()}.zip`

  const primary = await admin.storage.from(DATA_EXPORTS_BUCKET).upload(objectPath, buf, {
    contentType: 'application/zip',
    upsert: false,
  })

  if (!primary.error) {
    const { data, error } = await admin.storage.from(DATA_EXPORTS_BUCKET).createSignedUrl(objectPath, expiresSec)
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'Signierte Download-URL konnte nicht erstellt werden.')
    }
    return { signedUrl: data.signedUrl }
  }

  const fbPath = `${FALLBACK_PREFIX}/${userId}/${randomUUID()}.zip`
  let fb = await admin.storage.from(FALLBACK_BUCKET).upload(fbPath, buf, {
    contentType: 'application/zip',
    upsert: false,
  })
  if (fb.error) {
    fb = await admin.storage.from(FALLBACK_BUCKET).upload(fbPath, buf, {
      contentType: 'application/octet-stream',
      upsert: false,
    })
  }
  if (fb.error) {
    throw new Error(
      `Export-Speicher: Bucket „${DATA_EXPORTS_BUCKET}“ (${primary.error.message}). ` +
        `Fallback „${FALLBACK_BUCKET}“ (${fb.error.message}). ` +
        `Bitte in Supabase unter Storage prüfen oder Migration für „${DATA_EXPORTS_BUCKET}“ ausführen.`
    )
  }

  const { data, error } = await admin.storage.from(FALLBACK_BUCKET).createSignedUrl(fbPath, expiresSec)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Signierte URL (Fallback-Speicher) fehlgeschlagen.')
  }
  return { signedUrl: data.signedUrl }
}
