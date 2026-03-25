'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { upsertDocumentationMirrorFromHoofRow } from '@/lib/documentation/upsertDocumentationMirror'
import { deleteDocumentationPhotosMirroringHoofRows } from '@/lib/documentation/mirrorDocumentationPhotos'

export type CreateRecordResult = { recordId: string } | { error: string }

async function fetchUserSettingsJson(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<Record<string, unknown> | undefined> {
  const { data } = await supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle()
  return (data?.settings as Record<string, unknown> | undefined) ?? undefined
}

export async function createRecord(formData: FormData): Promise<CreateRecordResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const horseId = String(formData.get('horse_id') || '').trim()
  const record_date = String(formData.get('record_date') || '').trim()
  const summary_notes = String(formData.get('summary_notes') || '').trim()
  const recommendation_notes = String(formData.get('recommendation_notes') || '').trim()
  const general_condition = (formData.get('general_condition') as string) || null
  const gait = (formData.get('gait') as string) || null
  const handling_behavior = (formData.get('handling_behavior') as string) || null
  const horn_quality = (formData.get('horn_quality') as string) || null
  const hoofs_jsonRaw = formData.get('hoofs_json') as string | null
  const checklist_jsonRaw = formData.get('checklist_json') as string | null
  const hoofs_json = hoofs_jsonRaw ? (() => { try { return JSON.parse(hoofs_jsonRaw) } catch { return null } })() : null
  const checklist_json = checklist_jsonRaw ? (() => { try { return JSON.parse(checklist_jsonRaw) } catch { return null } })() : null

  if (!horseId) {
    return { error: 'Pferd fehlt. Bitte die Seite neu laden und erneut versuchen.' }
  }

  const fullPayload = {
    user_id: user.id,
    horse_id: horseId,
    record_date: record_date || null,
    hoof_condition: summary_notes || null,
    treatment: recommendation_notes || null,
    notes: null,
    general_condition,
    gait,
    handling_behavior,
    horn_quality,
    hoofs_json,
    checklist_json,
  }

  const basePayload = {
    user_id: user.id,
    horse_id: horseId,
    record_date: record_date || null,
    hoof_condition: summary_notes || null,
    treatment: recommendation_notes || null,
    notes: null,
  }

  let result = await supabase
    .from('hoof_records')
    .insert([fullPayload])
    .select('id')
    .single<{ id: string }>()

  if (result.error) {
    const isSchemaError =
      /hoofs_json|checklist_json|general_condition|gait|handling_behavior|horn_quality|schema cache|column.*does not exist/i.test(
        result.error.message
      )
    if (isSchemaError) {
      result = await supabase
        .from('hoof_records')
        .insert([basePayload])
        .select('id')
        .single<{ id: string }>()
    }
  }

  const { data, error } = result
  if (error) {
    return { error: `Speichern fehlgeschlagen: ${error.message}` }
  }
  if (!data?.id) {
    return { error: 'Speichern fehlgeschlagen: Keine ID vom Server erhalten.' }
  }

  // Save doc_number once after insert (ignore if column doesn't exist yet)
  const year = record_date ? new Date(record_date).getFullYear() : new Date().getFullYear()
  const suffix = data.id.replace(/-/g, '').slice(-4).toUpperCase()
  const docNumber = `DOK-${year}-${suffix}`
  await supabase
    .from('hoof_records')
    .update({ doc_number: docNumber })
    .eq('id', data.id)
    .eq('user_id', user.id)
  // error intentionally ignored – column may not exist in all environments

  const { data: hoofForMirror, error: hoofFetchError } = await supabase
    .from('hoof_records')
    .select('*')
    .eq('id', data.id)
    .eq('user_id', user.id)
    .single<Record<string, unknown>>()

  if (hoofFetchError || !hoofForMirror) {
    await supabase.from('hoof_records').delete().eq('id', data.id).eq('user_id', user.id)
    return {
      error: `Speichern fehlgeschlagen: Huf-Datensatz nach dem Anlegen nicht lesbar (${hoofFetchError?.message ?? 'unbekannt'}).`,
    }
  }

  const settingsJson = await fetchUserSettingsJson(supabase, user.id)
  const mirror = await upsertDocumentationMirrorFromHoofRow(supabase, hoofForMirror, settingsJson)
  if (!mirror.ok) {
    const { error: delErr } = await supabase.from('hoof_records').delete().eq('id', data.id).eq('user_id', user.id)
    if (delErr) {
      return {
        error: `Dokumentationsspiegel fehlgeschlagen: ${mirror.error}. Der Huf-Datensatz konnte nicht rückgängig gemacht werden: ${delErr.message}`,
      }
    }
    return { error: `Speichern fehlgeschlagen: ${mirror.error}` }
  }

  revalidatePath(`/horses/${horseId}`)
  revalidatePath(`/horses/${horseId}/records/${data.id}`)
  return { recordId: data.id }
}

export async function updateRecord(
  horseId: string,
  recordId: string,
  formData: FormData
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const record_date = (formData.get('record_date') as string) || null
  const summary_notes = (formData.get('summary_notes') as string) ?? ''
  const recommendation_notes = (formData.get('recommendation_notes') as string) ?? ''
  const notes = (formData.get('notes') as string) ?? ''
  const general_condition = (formData.get('general_condition') as string) || null
  const gait = (formData.get('gait') as string) || null
  const handling_behavior = (formData.get('handling_behavior') as string) || null
  const horn_quality = (formData.get('horn_quality') as string) || null
  const hoofs_jsonRaw = formData.get('hoofs_json') as string | null
  const checklist_jsonRaw = formData.get('checklist_json') as string | null
  const hoofs_json = hoofs_jsonRaw ? (() => { try { return JSON.parse(hoofs_jsonRaw) } catch { return null } })() : null
  const checklist_json = checklist_jsonRaw ? (() => { try { return JSON.parse(checklist_jsonRaw) } catch { return null } })() : null

  const fullPayload = {
    record_date,
    hoof_condition: summary_notes || null,
    treatment: recommendation_notes || null,
    notes: notes || null,
    general_condition,
    gait,
    handling_behavior,
    horn_quality,
    hoofs_json,
    checklist_json,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('hoof_records')
    .update(fullPayload)
    .eq('id', recordId)
    .eq('horse_id', horseId)
    .eq('user_id', user.id)

  if (error) {
    const isMissingColumn = /column.*does not exist|Unknown column|Could not find the .* column|schema cache/i.test(error.message)
    if (isMissingColumn) {
      const { error: baseError } = await supabase
        .from('hoof_records')
        .update({
          record_date,
          hoof_condition: summary_notes || null,
          treatment: recommendation_notes || null,
          notes: notes || null,
        })
        .eq('id', recordId)
        .eq('horse_id', horseId)
        .eq('user_id', user.id)
      if (baseError) throw new Error(`Fehler beim Speichern: ${baseError.message}`)
    } else {
      throw new Error(`Fehler beim Speichern: ${error.message}`)
    }
  }

  const { data: hoofForMirror, error: hoofFetchError } = await supabase
    .from('hoof_records')
    .select('*')
    .eq('id', recordId)
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .single<Record<string, unknown>>()

  if (hoofFetchError || !hoofForMirror) {
    throw new Error(
      `Huf-Datensatz gespeichert, aber Spiegelung nicht möglich: Zeile nicht lesbar (${hoofFetchError?.message ?? 'unbekannt'}). Bitte erneut speichern.`
    )
  }

  const settingsJson = await fetchUserSettingsJson(supabase, user.id)
  const mirror = await upsertDocumentationMirrorFromHoofRow(supabase, hoofForMirror, settingsJson)
  if (!mirror.ok) {
    throw new Error(
      `Huf-Datensatz gespeichert, Dokumentationsspiegel fehlgeschlagen: ${mirror.error}. Bitte erneut speichern oder Support informieren.`
    )
  }

  revalidatePath(`/horses/${horseId}/records/${recordId}`)
}

export async function deleteRecordPhotos(
  horseId: string,
  recordId: string,
  photoIds: string[]
): Promise<void> {
  if (photoIds.length === 0) return

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rows } = await supabase
    .from('hoof_photos')
    .select('id, file_path, photo_type')
    .eq('hoof_record_id', recordId)
    .eq('user_id', user.id)
    .in('id', photoIds)

  if (rows?.length) {
    await deleteDocumentationPhotosMirroringHoofRows(supabase, recordId, user.id, rows)
    const paths = rows.map((r) => r.file_path).filter((p): p is string => Boolean(p))
    if (paths.length) {
      const { error: storageErr } = await supabase.storage.from('hoof-photos').remove(paths)
      if (storageErr) throw new Error(`Storage: ${storageErr.message}`)
    }
    const { error: hoofDelErr } = await supabase
      .from('hoof_photos')
      .delete()
      .eq('hoof_record_id', recordId)
      .eq('user_id', user.id)
      .in('id', photoIds)
    if (hoofDelErr) throw new Error(`hoof_photos löschen: ${hoofDelErr.message}`)
  }

  revalidatePath(`/horses/${horseId}/records/${recordId}`)
}
