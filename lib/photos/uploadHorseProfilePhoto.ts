'use client'

import { supabase } from '@/lib/supabase-client'
import type { SlotWholeBody } from '@/lib/photos/photoTypes'
import { horseProfileStoragePath, HORSE_PROFILE_PATH_COLUMN } from '@/lib/photos/horseProfilePhotos'

export async function uploadHorseProfilePhoto(params: {
  horseId: string
  slot: SlotWholeBody
  blob: Blob
}): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht eingeloggt')

  const filePath = horseProfileStoragePath(user.id, params.horseId, params.slot)
  const { error: uploadError } = await supabase.storage.from('hoof-photos').upload(filePath, params.blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (uploadError) throw new Error(`Upload: ${uploadError.message}`)

  const column = HORSE_PROFILE_PATH_COLUMN[params.slot]
  const { error: updateError } = await supabase
    .from('horses')
    .update({ [column]: filePath })
    .eq('id', params.horseId)
    .eq('user_id', user.id)

  if (updateError) {
    throw new Error(
      /column|schema cache/i.test(updateError.message)
        ? 'Datenbank-Spalte für Profilfotos fehlt. Bitte Migration ausführen.'
        : updateError.message
    )
  }

  return filePath
}

export async function clearHorseProfilePhoto(params: {
  horseId: string
  slot: SlotWholeBody
  filePath?: string | null
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht eingeloggt')

  const column = HORSE_PROFILE_PATH_COLUMN[params.slot]
  const path = params.filePath ?? horseProfileStoragePath(user.id, params.horseId, params.slot)
  await supabase.storage.from('hoof-photos').remove([path])
  await supabase
    .from('horses')
    .update({ [column]: null })
    .eq('id', params.horseId)
    .eq('user_id', user.id)
}
