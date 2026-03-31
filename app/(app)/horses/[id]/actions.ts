'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  revalidateDashboardMobileForUser,
  revalidateHoofCompareForHorse,
} from '@/lib/cache/tags'
import { deleteDocumentationRecordsForLegacyHoofIds } from '@/lib/documentation/mirrorDocumentationPhotos'
import { removeAnimalProfilePhotoFromStorageSafe } from '@/lib/animals/animalProfilePhotoUpload'

/** Löscht Tier inkl. Dokumentationen, Fotos, Termine; leitet nach /animals um. */
export async function deleteHorseAndRedirect(horseId: string) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: records } = await supabase
    .from('hoof_records')
    .select('id')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)

  const recordIds = (records || []).map((r) => r.id)

  if (recordIds.length > 0) {
    const { data: photos } = await supabase
      .from('hoof_photos')
      .select('file_path')
      .eq('user_id', user.id)
      .in('hoof_record_id', recordIds)

    const filePaths = (photos || [])
      .map((photo) => photo.file_path)
      .filter((path): path is string => Boolean(path))

    if (filePaths.length > 0) {
      await supabase.storage.from('hoof-photos').remove(filePaths)
    }

    await supabase.from('hoof_photos').delete().eq('user_id', user.id).in('hoof_record_id', recordIds)

    await deleteDocumentationRecordsForLegacyHoofIds(supabase, recordIds, user.id)

    await supabase.from('hoof_records').delete().eq('horse_id', horseId).eq('user_id', user.id)
  }

  const { data: links } = await supabase
    .from('appointment_horses')
    .select('appointment_id')
    .eq('user_id', user.id)
    .eq('horse_id', horseId)
  const aptIds = [...new Set((links ?? []).map((l) => l.appointment_id))]
  if (aptIds.length) {
    await supabase.from('appointment_horses').delete().eq('user_id', user.id).in('appointment_id', aptIds)
    await supabase.from('appointments').delete().eq('user_id', user.id).in('id', aptIds)
  }

  await removeAnimalProfilePhotoFromStorageSafe(supabase, user.id, horseId)

  const { error } = await supabase.from('horses').delete().eq('id', horseId).eq('user_id', user.id)

  if (error) {
    throw new Error(`Fehler beim Löschen: ${error.message}`)
  }

  revalidateDashboardMobileForUser(user.id)
  revalidateHoofCompareForHorse(user.id, horseId)

  redirect('/animals')
}
