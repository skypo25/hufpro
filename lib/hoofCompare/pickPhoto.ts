import { toCanonicalPhotoSlot, type PhotoSlotKey } from '@/lib/photos/photoTypes'
import type { RecordDetailHoofPhoto } from '@/lib/documentation/loadRecordForDetailView'

export function pickPhotoForSlot(
  photos: RecordDetailHoofPhoto[],
  slotKey: PhotoSlotKey
): RecordDetailHoofPhoto | null {
  for (const p of photos) {
    const c = toCanonicalPhotoSlot(p.photo_type)
    if (c === slotKey && p.file_path) return p
  }
  return null
}
