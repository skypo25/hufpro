import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'

/** Ein allgemeines Tierfoto im Bucket hoof-photos (ohne hoof_photos-Zeile). */
export function animalProfileStoragePath(userId: string, horseId: string): string {
  return `${userId}/${horseId}/animal-profile.jpg`
}

/**
 * Entfernt das Tier-Profilbild aus dem Storage. Wirft nicht — Löschabläufe sollen nicht abbrechen,
 * wenn die Datei fehlt oder Storage einen Randfall meldet.
 */
export async function removeAnimalProfilePhotoFromStorageSafe(
  client: SupabaseClient,
  userId: string,
  horseId: string
): Promise<void> {
  const path = animalProfileStoragePath(userId, horseId)
  const { error } = await client.storage.from('hoof-photos').remove([path])
  if (error) {
    console.warn(`[hoof-photos] Tier-Profilbild konnte nicht entfernt werden (${path}):`, error.message)
  }
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
