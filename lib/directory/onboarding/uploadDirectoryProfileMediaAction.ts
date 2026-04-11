'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

const BUCKET = 'directory-profile-media'
const MAX_PHOTOS = 6
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  return '.jpg'
}

function validateImageFile(f: File): string | null {
  if (f.size > MAX_BYTES) return 'Jede Datei darf höchstens 5 MB groß sein.'
  if (!ALLOWED.has(f.type)) return 'Nur JPG, PNG, WebP oder GIF sind erlaubt.'
  return null
}

/** Extrahiert den Storage-Pfad aus einer öffentlichen Supabase-URL (`…/object/public/<bucket>/…`). */
function storagePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  try {
    const u = new URL(publicUrl)
    const pathname = decodeURIComponent(u.pathname)
    const needle = `/object/public/${bucket}/`
    const idx = pathname.indexOf(needle)
    if (idx === -1) return null
    return pathname.slice(idx + needle.length)
  } catch {
    return null
  }
}

function resolveStoragePath(row: { storage_key: string | null; url: string | null }): string | null {
  const sk = row.storage_key?.trim()
  if (sk) return sk
  const u = row.url?.trim()
  if (!u) return null
  return storagePathFromPublicUrl(u, BUCKET)
}

export type UploadDirectoryProfileMediaResult = { ok: true } | { ok: false; error: string }

type MediaRow = {
  id: string
  media_type: string
  storage_key: string | null
  url: string | null
  sort_order: number
}

/**
 * Synchronisiert Logo und Galerie für den Profilinhaber (bis zu 6 Galeriebilder).
 * FormData: `profileId`, optional `logo` (File), `photos` (mehrere Files),
 * optional `removeLogo` = `'1'`, optional `keepPhotoMediaIds` = JSON-Array von Foto-Row-UUIDs in gewünschter Reihenfolge.
 * Fehlt `keepPhotoMediaIds`, bleiben alle bestehenden Galeriebilder erhalten (nur neue `photos` werden angehängt).
 */
export async function uploadDirectoryProfileMediaAction(formData: FormData): Promise<UploadDirectoryProfileMediaResult> {
  const profileIdRaw = formData.get('profileId')
  if (typeof profileIdRaw !== 'string' || !profileIdRaw.trim()) {
    return { ok: false, error: 'Profil fehlt.' }
  }
  const profileId = profileIdRaw.trim()

  const supabaseAuth = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Nicht eingeloggt.' }
  }

  let supaAdmin: ReturnType<typeof createSupabaseServiceRoleClient>
  try {
    supaAdmin = createSupabaseServiceRoleClient()
  } catch {
    return { ok: false, error: 'Server-Konfiguration unvollständig.' }
  }

  const { data: prof, error: profErr } = await supaAdmin
    .from('directory_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  if (profErr || !prof) {
    return { ok: false, error: 'Kein Zugriff auf dieses Profil.' }
  }

  const removeLogo = formData.get('removeLogo') === '1'
  const keepRaw = formData.get('keepPhotoMediaIds')
  let keepPhotoIdsExplicit: string[] | null = null
  if (typeof keepRaw === 'string') {
    try {
      const parsed = JSON.parse(keepRaw) as unknown
      if (!Array.isArray(parsed)) {
        return { ok: false, error: 'Ungültige Galerie-Auswahl (kein Array).' }
      }
      keepPhotoIdsExplicit = parsed.filter((x): x is string => typeof x === 'string' && isUuid(x))
      if (keepPhotoIdsExplicit.length !== parsed.length) {
        return { ok: false, error: 'Ungültige Galerie-Auswahl (IDs).' }
      }
    } catch {
      return { ok: false, error: 'Ungültige Galerie-Auswahl (JSON).' }
    }
  }

  const logoRaw = formData.get('logo')
  const newLogo = logoRaw instanceof File && logoRaw.size > 0 ? logoRaw : null
  const photosRaw = formData.getAll('photos')
  const newPhotos = photosRaw.filter((x): x is File => x instanceof File && x.size > 0)

  if (newLogo) {
    const err = validateImageFile(newLogo)
    if (err) return { ok: false, error: err }
  }
  for (const f of newPhotos) {
    const err = validateImageFile(f)
    if (err) return { ok: false, error: err }
  }

  const { data: rowsRaw, error: rowsErr } = await supaAdmin
    .from('directory_profile_media')
    .select('id, media_type, storage_key, url, sort_order')
    .eq('directory_profile_id', profileId)

  if (rowsErr) {
    return { ok: false, error: rowsErr.message }
  }

  const rows = (rowsRaw ?? []) as MediaRow[]
  const currentLogo = rows.find((r) => r.media_type === 'logo') ?? null
  const currentPhotos = rows
    .filter((r) => r.media_type === 'photo')
    .sort((a, b) => a.sort_order - b.sort_order)

  const currentPhotoIdsInOrder = currentPhotos.map((r) => r.id)
  const keepPhotoIds =
    keepPhotoIdsExplicit !== null ? keepPhotoIdsExplicit : [...currentPhotoIdsInOrder]

  const currentPhotoIdSet = new Set(currentPhotoIdsInOrder)
  for (const id of keepPhotoIds) {
    if (!currentPhotoIdSet.has(id)) {
      return { ok: false, error: 'Ungültige Galerie-Auswahl (unbekannte ID).' }
    }
  }
  const keepSet = new Set(keepPhotoIds)
  if (keepSet.size !== keepPhotoIds.length) {
    return { ok: false, error: 'Doppelte Galerie-IDs sind nicht erlaubt.' }
  }

  if (keepPhotoIds.length + newPhotos.length > MAX_PHOTOS) {
    return { ok: false, error: `Maximal ${MAX_PHOTOS} Galerie-Bilder.` }
  }

  const photosUnchanged =
    keepPhotoIds.length === currentPhotoIdsInOrder.length &&
    keepPhotoIds.every((id, i) => id === currentPhotoIdsInOrder[i])
  const logoUnchanged = !removeLogo && !newLogo
  if (photosUnchanged && logoUnchanged && newPhotos.length === 0) {
    return { ok: true }
  }

  const photosToRemove = currentPhotos.filter((r) => !keepSet.has(r.id))

  for (const row of photosToRemove) {
    const path = resolveStoragePath(row)
    if (path) {
      const { error: rmErr } = await supaAdmin.storage.from(BUCKET).remove([path])
      if (rmErr) {
        return { ok: false, error: rmErr.message }
      }
    }
    const { error: delErr } = await supaAdmin.from('directory_profile_media').delete().eq('id', row.id)
    if (delErr) {
      return { ok: false, error: delErr.message }
    }
  }

  if (newLogo || removeLogo) {
    if (currentLogo) {
      const path = resolveStoragePath(currentLogo)
      if (path) {
        const { error: rmErr } = await supaAdmin.storage.from(BUCKET).remove([path])
        if (rmErr) {
          return { ok: false, error: rmErr.message }
        }
      }
      const { error: delLogoErr } = await supaAdmin.from('directory_profile_media').delete().eq('id', currentLogo.id)
      if (delLogoErr) {
        return { ok: false, error: delLogoErr.message }
      }
    }
  }

  const folder = `profiles/${profileId}`

  if (newLogo) {
    const ext = extFromMime(newLogo.type)
    const path = `${folder}/logo${ext}`
    const buf = Buffer.from(await newLogo.arrayBuffer())
    const { error: upErr } = await supaAdmin.storage.from(BUCKET).upload(path, buf, {
      contentType: newLogo.type,
      upsert: true,
    })
    if (upErr) {
      return { ok: false, error: upErr.message }
    }
    const { data: pub } = supaAdmin.storage.from(BUCKET).getPublicUrl(path)
    const { error: insErr } = await supaAdmin.from('directory_profile_media').insert({
      directory_profile_id: profileId,
      media_type: 'logo',
      url: pub.publicUrl,
      storage_key: path,
      sort_order: 0,
      alt_text: null,
    })
    if (insErr) {
      return { ok: false, error: insErr.message }
    }
  }

  for (let i = 0; i < keepPhotoIds.length; i++) {
    const { error: upSortErr } = await supaAdmin
      .from('directory_profile_media')
      .update({ sort_order: i })
      .eq('id', keepPhotoIds[i]!)
      .eq('directory_profile_id', profileId)
    if (upSortErr) {
      return { ok: false, error: upSortErr.message }
    }
  }

  let sortBase = keepPhotoIds.length
  for (let i = 0; i < newPhotos.length; i++) {
    const file = newPhotos[i]!
    const ext = extFromMime(file.type)
    const unique = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`
    const path = `${folder}/photo-${unique}${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supaAdmin.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type,
      upsert: false,
    })
    if (upErr) {
      return { ok: false, error: upErr.message }
    }
    const { data: pub } = supaAdmin.storage.from(BUCKET).getPublicUrl(path)
    const { error: insErr } = await supaAdmin.from('directory_profile_media').insert({
      directory_profile_id: profileId,
      media_type: 'photo',
      url: pub.publicUrl,
      storage_key: path,
      sort_order: sortBase + i,
      alt_text: null,
    })
    if (insErr) {
      return { ok: false, error: insErr.message }
    }
  }

  return { ok: true }
}
