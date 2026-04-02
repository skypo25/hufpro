const BUCKET_HOOF = 'hoof-photos'
const BUCKET_LOGOS = 'user-logos'

/** Gleiche Konvention wie uploadAnimalProfilePhoto (Tier-Profilbild). */
function animalProfileStoragePath(userId: string, horseId: string): string {
  return `${userId}/${horseId}/animal-profile.jpg`
}

/** Relativer Pfad innerhalb des ZIP unter fotos/{bucket}/… */
export function zipEntryPathForStorage(bucket: string, storagePath: string): string {
  const trimmed = storagePath.trim().replace(/^\/+/, '').replace(/\.\./g, '_')
  return `fotos/${bucket}/${trimmed}`
}

export { BUCKET_HOOF, BUCKET_LOGOS }

/**
 * Sammelt alle Pfade im Bucket hoof-photos für den Export:
 * Huf-/Dokumentationsfotos, Profilbilder der Tiere (konventioneller Pfad).
 */
export function collectHoofPhotoStoragePaths(args: {
  userId: string
  hoofPhotoPaths: Array<string | null | undefined>
  documentationPhotoPaths: Array<string | null | undefined>
  horseIds: string[]
}): string[] {
  const set = new Set<string>()
  for (const p of args.hoofPhotoPaths) {
    if (p && p.trim()) set.add(p.trim())
  }
  for (const p of args.documentationPhotoPaths) {
    if (p && p.trim()) set.add(p.trim())
  }
  for (const horseId of args.horseIds) {
    set.add(animalProfileStoragePath(args.userId, horseId))
  }
  return [...set]
}
