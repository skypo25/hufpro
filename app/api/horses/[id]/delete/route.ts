import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  revalidateDashboardMobileForUser,
  revalidateHoofCompareForHorse,
} from '@/lib/cache/tags'
import { deleteDocumentationRecordsForLegacyHoofIds } from '@/lib/documentation/mirrorDocumentationPhotos'
import { removeAnimalProfilePhotoFromStorageSafe } from '@/lib/animals/animalProfilePhotoUpload'

/** Liefert Termin-Info für den Lösch-Dialog (nächster künftiger Termin). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: horseId } = await params
  if (!horseId) return NextResponse.json({ error: 'Horse ID fehlt.' }, { status: 400 })

  const { data: links } = await supabase
    .from('appointment_horses')
    .select('appointment_id')
    .eq('user_id', user.id)
    .eq('horse_id', horseId)
  const aptIds = [...new Set((links ?? []).map((l) => l.appointment_id))]
  if (!aptIds.length) return NextResponse.json({ hasFutureAppointment: false, appointmentDate: null })

  const { data: apts } = await supabase
    .from('appointments')
    .select('id, appointment_date')
    .eq('user_id', user.id)
    .in('id', aptIds)
  const todayStr = new Date().toISOString().slice(0, 10)
  let earliest: string | null = null
  for (const a of apts ?? []) {
    if (!a.appointment_date) continue
    const d = String(a.appointment_date).slice(0, 10)
    if (d >= todayStr && (!earliest || d < earliest)) earliest = d
  }
  if (!earliest) return NextResponse.json({ hasFutureAppointment: false, appointmentDate: null })
  const fullDate = (apts ?? []).find((a) => a.appointment_date && String(a.appointment_date).startsWith(earliest!))?.appointment_date ?? earliest
  return NextResponse.json({ hasFutureAppointment: true, appointmentDate: fullDate })
}

/**
 * Löscht ein Pferd inkl. Hufdokumentationen, Fotos und zugehöriger Termine.
 * Die Termine, in denen dieses Pferd war, werden komplett entfernt (kein Nachrutschen anderer Pferde).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: horseId } = await params
  if (!horseId) {
    return NextResponse.json({ error: 'Horse ID fehlt.' }, { status: 400 })
  }

  // 1. Hufdokumentationen + Fotos löschen
  const { data: records } = await supabase
    .from('hoof_records')
    .select('id')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
  const recordIds = (records ?? []).map((r) => r.id)
  if (recordIds.length) {
    const { data: photos } = await supabase
      .from('hoof_photos')
      .select('file_path')
      .eq('user_id', user.id)
      .in('hoof_record_id', recordIds)
    const paths = (photos ?? []).map((p) => p.file_path).filter((p): p is string => !!p)
    if (paths.length) await supabase.storage.from('hoof-photos').remove(paths)
    await supabase.from('hoof_photos').delete().eq('user_id', user.id).in('hoof_record_id', recordIds)
    await deleteDocumentationRecordsForLegacyHoofIds(supabase, recordIds, user.id)
    await supabase.from('hoof_records').delete().eq('horse_id', horseId).eq('user_id', user.id)
  }

  // 2. Termine, in denen dieses Pferd war, komplett löschen (kein Nachrutschen anderer Pferde)
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

  // 2b. Allgemeines Tierfoto (AnimalForm), falls vorhanden
  await removeAnimalProfilePhotoFromStorageSafe(supabase, user.id, horseId)

  // 3. Pferd löschen
  const { error } = await supabase.from('horses').delete().eq('id', horseId).eq('user_id', user.id)
  if (error) {
    return NextResponse.json(
      { error: 'Pferd konnte nicht gelöscht werden: ' + error.message },
      { status: 500 }
    )
  }

  revalidateDashboardMobileForUser(user.id)
  revalidateHoofCompareForHorse(user.id, horseId)

  return NextResponse.json({ ok: true })
}
