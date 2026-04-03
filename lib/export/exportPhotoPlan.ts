/**
 * Einheitliche Dateinamen für Fotos im ZIP (vor HTML, damit img-src relativ gesetzt werden kann).
 */

import { photoLabelForExport, customerDisplayName } from '@/lib/export/customerExportData'
import { sanitizeExportFilenameBase, ensureUniqueFilename } from '@/lib/export/sanitizeExportFilename'
import { formatGermanDate, formatGermanDateTime, formatStorageBytesShort } from '@/lib/format'

export type PlannedExportPhoto = {
  storagePath: string
  zipRel: string
  bucket: string
  csvRow: Record<string, unknown>
}

function extFromMime(m: string | null | undefined): string {
  if (!m) return 'jpg'
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  return 'jpg'
}

/**
 * Liefert geplante Export-Fotos in derselben Reihenfolge wie der spätere Download
 * (documentation_photos → hoof_photos). Profilbilder bleiben im Download separat (nur bei Erfolg).
 */
export function planExportPhotos(args: {
  documentationPhotos: Record<string, unknown>[]
  hoofPhotos: Record<string, unknown>[]
  hoofRecords: Record<string, unknown>[]
  horseById: Map<string, Record<string, unknown>>
  customerById: Map<string, Record<string, unknown>>
  docById: Map<string, Record<string, unknown>>
  bucketHoof: string
}): { planned: PlannedExportPhoto[]; pathToZipRel: Map<string, string>; usedPhotoNames: Set<string> } {
  const {
    documentationPhotos,
    hoofPhotos,
    hoofRecords,
    docById,
    horseById,
    customerById,
    bucketHoof,
  } = args

  const usedPhotoNames = new Set<string>()
  const planned: PlannedExportPhoto[] = []
  /** Gleicher Storage-Key (file_path) = eine Datei im ZIP; Dokumentation + Legacy-Huf teilen sich oft dasselbe Objekt. */
  const pathToZipEntry = new Map<string, { zipRel: string; fname: string }>()

  function pushPlanned(
    storagePath: string,
    zipRel: string,
    csvRow: Record<string, unknown>
  ): void {
    const key = storagePath.trim()
    planned.push({ storagePath: key, zipRel, bucket: bucketHoof, csvRow })
  }

  for (const p of documentationPhotos) {
    const path = p.file_path as string | null
    if (!path?.trim()) continue
    const key = path.trim()
    const docId = p.documentation_record_id as string
    const doc = docById.get(docId)
    const horseId = doc?.animal_id as string | undefined
    const horse = horseId ? horseById.get(horseId) : undefined
    const cid = horse?.customer_id as string | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const horseName = ((horse?.name as string) || 'Tier').trim() || 'Tier'
    const sessionDate = doc?.session_date ? formatGermanDate(String(doc.session_date)) : ''
    const dateSlug = sessionDate.replace(/\./g, '-') || 'ohne-Datum'
    const pt = photoLabelForExport(p.photo_type as string | null)
    let zipRel: string
    let fname: string
    const existing = pathToZipEntry.get(key)
    if (existing) {
      zipRel = existing.zipRel
      fname = existing.fname
    } else {
      const base = sanitizeExportFilenameBase(`${horseName}_${dateSlug}_${pt}`)
      const ext = extFromMime(p.mime_type as string | null)
      fname = ensureUniqueFilename(base, ext, usedPhotoNames)
      zipRel = `06_Fotos/Bilder/${fname}`
      pathToZipEntry.set(key, { zipRel, fname })
    }
    pushPlanned(key, zipRel, {
      Tiername: (horse?.name as string) ?? '',
      Kunde: customerDisplayName(cust),
      Dokumentationsdatum: sessionDate,
      Fototyp: pt,
      Dateiname: fname,
      'Bildpfad im Export': zipRel,
      Auflösung: p.width != null && p.height != null ? `${p.width}×${p.height}` : '',
      Dateigröße: p.file_size != null ? formatStorageBytesShort(p.file_size as number) : '',
      'Aufgenommen am': p.created_at ? formatGermanDateTime(String(p.created_at)) : '',
      interne_foto_id: (p.id as string) ?? '',
      interne_dokumentations_id: docId,
      interne_hufdokumentation_id: '',
    })
  }

  for (const p of hoofPhotos) {
    const path = p.file_path as string | null
    if (!path?.trim()) continue
    const key = path.trim()
    const hoofId = p.hoof_record_id as string | null
    if (!hoofId) continue
    const hr = hoofRecords.find((r) => r.id === hoofId)
    const horseId = hr?.horse_id as string | undefined
    const horse = horseId ? horseById.get(horseId) : undefined
    const cid = horse?.customer_id as string | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const horseName = ((horse?.name as string) || 'Tier').trim() || 'Tier'
    const rd = hr?.record_date ? formatGermanDate(String(hr.record_date)) : ''
    const dateSlug = rd.replace(/\./g, '-') || 'ohne-Datum'
    const pt = photoLabelForExport(p.photo_type as string | null)
    let zipRel: string
    let fname: string
    const existing = pathToZipEntry.get(key)
    if (existing) {
      zipRel = existing.zipRel
      fname = existing.fname
    } else {
      const base = sanitizeExportFilenameBase(`${horseName}_${dateSlug}_${pt}`)
      const ext = extFromMime(p.mime_type as string | null)
      fname = ensureUniqueFilename(base, ext, usedPhotoNames)
      zipRel = `06_Fotos/Bilder/${fname}`
      pathToZipEntry.set(key, { zipRel, fname })
    }
    pushPlanned(key, zipRel, {
      Tiername: (horse?.name as string) ?? '',
      Kunde: customerDisplayName(cust),
      Dokumentationsdatum: rd,
      Fototyp: pt,
      Dateiname: fname,
      'Bildpfad im Export': zipRel,
      Auflösung: p.width != null && p.height != null ? `${p.width}×${p.height}` : '',
      Dateigröße: p.file_size != null ? formatStorageBytesShort(p.file_size as number) : '',
      'Aufgenommen am': p.created_at ? formatGermanDateTime(String(p.created_at)) : '',
      interne_foto_id: (p.id as string) ?? '',
      interne_dokumentations_id: '',
      interne_hufdokumentation_id: hoofId,
    })
  }

  const pathToZipRel = new Map<string, string>()
  for (const [storageKey, { zipRel }] of pathToZipEntry) {
    pathToZipRel.set(storageKey, zipRel)
  }

  return { planned, pathToZipRel, usedPhotoNames }
}
