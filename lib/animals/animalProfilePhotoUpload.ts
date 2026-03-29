import { supabase } from '@/lib/supabase-client'

/** Ein allgemeines Tierfoto im Bucket hoof-photos (ohne hoof_photos-Zeile). */
export function animalProfileStoragePath(userId: string, horseId: string): string {
  return `${userId}/${horseId}/animal-profile.jpg`
}

export async function uploadAnimalProfilePhoto(
  userId: string,
  horseId: string,
  blob: Blob
): Promise<string> {
  const path = animalProfileStoragePath(userId, horseId)
  const { error } = await supabase.storage.from('hoof-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function removeAnimalProfilePhoto(path: string): Promise<void> {
  await supabase.storage.from('hoof-photos').remove([path])
}
