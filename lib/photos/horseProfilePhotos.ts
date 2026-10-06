import type { SupabaseClient } from '@supabase/supabase-js'
import { SLOT_LABELS, SLOT_WHOLE_BODY, type SlotWholeBody } from '@/lib/photos/photoTypes'

export const HORSE_PROFILE_PATH_COLUMN: Record<SlotWholeBody, 'photo_whole_left_path' | 'photo_whole_right_path'> = {
  whole_left: 'photo_whole_left_path',
  whole_right: 'photo_whole_right_path',
}

export function horseProfileStoragePath(
  userId: string,
  horseId: string,
  slot: SlotWholeBody
): string {
  return `${userId}/${horseId}/profile/${slot}.jpg`
}

export type HorseProfilePhotoPaths = {
  photo_whole_left_path?: string | null
  photo_whole_right_path?: string | null
}

export type HorseWholeBodyDisplayItem = {
  id: string
  imageUrl: string
  label: string
}

export async function signHorseProfileWholeBodyPhotos(
  supabase: SupabaseClient,
  horse: HorseProfilePhotoPaths
): Promise<HorseWholeBodyDisplayItem[]> {
  const items: HorseWholeBodyDisplayItem[] = []
  for (const slot of SLOT_WHOLE_BODY) {
    const path = horse[HORSE_PROFILE_PATH_COLUMN[slot]]
    if (!path) continue
    const { data } = await supabase.storage.from('hoof-photos').createSignedUrl(path, 60 * 60)
    if (!data?.signedUrl) continue
    items.push({
      id: `profile-${slot}`,
      imageUrl: data.signedUrl,
      label: SLOT_LABELS[slot] ?? slot,
    })
  }
  return items
}

export async function mergeWholeBodyPhotosForHorseDisplay(
  supabase: SupabaseClient,
  horse: HorseProfilePhotoPaths,
  documentationPhotos: HorseWholeBodyDisplayItem[]
): Promise<HorseWholeBodyDisplayItem[]> {
  const profile = await signHorseProfileWholeBodyPhotos(supabase, horse)
  if (profile.length > 0) return profile
  return [...documentationPhotos].sort(
    (a, b) => (a.label.includes('links') ? 0 : 1) - (b.label.includes('links') ? 0 : 1)
  )
}
