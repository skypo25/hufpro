/**
 * Serialisierung von Dokumentations-Formulardaten für Offline-Entwürfe.
 * Bilder werden als Base64 gespeichert (max. 2 pro Entwurf, komprimiert).
 */

export type RecordFormSnapshot = {
  recordDate: string
  generalCondition: string
  gait: string
  handlingBehavior: string
  hornQuality: string
  summaryText: string
  recommendationText: string
  notesText: string
  hoofs: unknown
  checklist: string[]
  /** Base64-encoded images: slot -> base64. Nur wenn offline gespeichert. */
  stagedPhotosBase64?: Record<string, string>
  annotationsBySlot?: Record<string, unknown>
}

const MAX_PHOTOS_IN_DRAFT = 4
const MAX_BASE64_SIZE = 800 * 1024 // ~800KB pro Foto (komprimiert)

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function base64ToBlob(base64: string, mime = 'image/jpeg'): Promise<Blob> {
  const res = await fetch(`data:${mime};base64,${base64}`)
  return res.blob()
}

/** Komprimiert ein Blob für Offline-Speicherung (max. längere Kante 850 px, wie Huf-Upload). */
async function compressForDraft(blob: Blob): Promise<string> {
  try {
    if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      const b64 = await blobToBase64(blob)
      return b64.length * 0.75 <= MAX_BASE64_SIZE ? b64 : ''
    }
    const img = await createImageBitmap(blob)
    const max = 850
    let w = img.width
    let h = img.height
    if (w > max || h > max) {
      if (w > h) {
        h = Math.round((h * max) / w)
        w = max
      } else {
        w = Math.round((w * max) / h)
        h = max
      }
    }
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      img.close()
      return blobToBase64(blob)
    }
    ctx.drawImage(img, 0, 0, w, h)
    img.close()
    const compressed = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 })
    const b64 = await blobToBase64(compressed)
    if (b64.length * 0.75 > MAX_BASE64_SIZE) return ''
    return b64
  } catch {
    try {
      const b64 = await blobToBase64(blob)
      return b64.length * 0.75 <= MAX_BASE64_SIZE ? b64 : ''
    } catch {
      return ''
    }
  }
}

export async function serializeRecordForm(data: {
  recordDate: string
  generalCondition: string
  gait: string
  handlingBehavior: string
  hornQuality: string
  summaryText: string
  recommendationText: string
  notesText: string
  hoofs: unknown
  checklist: string[]
  stagedPhotos?: Record<string, { blob: Blob; width: number; height: number }>
  annotationsBySlot?: Record<string, unknown>
}): Promise<RecordFormSnapshot> {
  const snapshot: RecordFormSnapshot = {
    recordDate: data.recordDate,
    generalCondition: data.generalCondition,
    gait: data.gait,
    handlingBehavior: data.handlingBehavior,
    hornQuality: data.hornQuality,
    summaryText: data.summaryText,
    recommendationText: data.recommendationText,
    notesText: data.notesText,
    hoofs: data.hoofs,
    checklist: data.checklist,
  }
  if (data.annotationsBySlot && Object.keys(data.annotationsBySlot).length > 0) {
    snapshot.annotationsBySlot = data.annotationsBySlot
  }
  if (data.stagedPhotos && Object.keys(data.stagedPhotos).length > 0) {
    const photos: Record<string, string> = {}
    const entries = Object.entries(data.stagedPhotos).slice(0, MAX_PHOTOS_IN_DRAFT)
    for (const [slot, p] of entries) {
      if (!p?.blob) continue
      const b64 = await compressForDraft(p.blob)
      if (b64) photos[slot] = b64
    }
    if (Object.keys(photos).length > 0) {
      snapshot.stagedPhotosBase64 = photos
    }
  }
  return snapshot
}

export async function deserializeStagedPhotos(
  stagedPhotosBase64?: Record<string, string>
): Promise<Record<string, { blob: Blob; width: number; height: number; previewUrl: string }>> {
  if (!stagedPhotosBase64 || Object.keys(stagedPhotosBase64).length === 0) return {}
  const result: Record<string, { blob: Blob; width: number; height: number; previewUrl: string }> = {}
  for (const [slot, b64] of Object.entries(stagedPhotosBase64)) {
    if (!b64) continue
    try {
      const blob = await base64ToBlob(b64)
      const img = await createImageBitmap(blob)
      const width = img.width
      const height = img.height
      img.close()
      const previewUrl = URL.createObjectURL(blob)
      result[slot] = { blob, width, height, previewUrl }
    } catch {
      // Einzelnes Foto fehlgeschlagen, überspringen
    }
  }
  return result
}
