import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'hoof-photos'

/**
 * Signiert mehrere hoof-photos-Pfade in einem Storage-Request
 * (statt N× createSignedUrl hintereinander).
 */
export async function createHoofPhotoSignedUrls(
  supabase: SupabaseClient,
  paths: string[],
  expiresIn = 3600
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  const out = new Map<string, string>()
  if (!unique.length) return out

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresIn)
  if (error) {
    console.warn('[Fotos] createSignedUrls fehlgeschlagen:', error.message)
    return out
  }

  for (const row of data ?? []) {
    if (!row.path || row.error || !row.signedUrl) continue
    out.set(row.path, row.signedUrl)
  }
  return out
}
