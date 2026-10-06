import type { SupabaseClient } from '@supabase/supabase-js'
import { isoToLocalDateInputValue } from '@/lib/datetime/localDateTime'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

/** Terminart der Doku — gleiche Labels wie im Kalender. */
export function recordTypeFromAppointmentType(type: string | null | undefined): string {
  const t = (type ?? '').trim()
  if (!t) return 'Regeltermin'
  const lower = t.toLowerCase()
  if (lower.startsWith('erst')) return 'Ersttermin'
  if (lower.startsWith('kontroll')) return 'Kontrolle'
  if (lower.startsWith('regel')) return 'Regeltermin'
  return t
}

export type AppointmentDocContext = {
  appointmentId: string
  recordDate: string
  recordType: string
}

export async function loadAppointmentDocContext(
  supabase: SupabaseClient,
  userId: string,
  horseId: string,
  appointmentId: string
): Promise<AppointmentDocContext | null> {
  if (!isUuid(appointmentId) || !isUuid(horseId)) return null

  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, appointment_date, type')
    .eq('id', appointmentId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; appointment_date: string | null; type: string | null }>()

  if (!appointment?.id) return null

  const { data: link } = await supabase
    .from('appointment_horses')
    .select('horse_id')
    .eq('appointment_id', appointmentId)
    .eq('horse_id', horseId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!link) return null

  const recordDate = isoToLocalDateInputValue(appointment.appointment_date)
  if (!recordDate) return null

  return {
    appointmentId: appointment.id,
    recordDate,
    recordType: recordTypeFromAppointmentType(appointment.type),
  }
}

export type LinkedAppointmentDocumentation = {
  animalId: string
  recordId: string
}

function legacyIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const v = (metadata as { legacy_hoof_record_id?: unknown }).legacy_hoof_record_id
  return typeof v === 'string' && isUuid(v) ? v : null
}

/** Bereits gespeicherte Doku zu diesem Termin (metadata.appointment_id). */
export async function findDocumentationForAppointment(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string,
  animalId?: string
): Promise<LinkedAppointmentDocumentation | null> {
  if (!isUuid(appointmentId)) return null

  let query = supabase
    .from('documentation_records')
    .select('animal_id, metadata')
    .eq('user_id', userId)
    .filter('metadata->>appointment_id', 'eq', appointmentId)

  if (animalId && isUuid(animalId)) {
    query = query.eq('animal_id', animalId)
  }

  const { data } = await query.limit(8).returns<{ animal_id: string; metadata: unknown }[]>()
  const rows = data ?? []
  const preferred = animalId ? rows.find((r) => r.animal_id === animalId) ?? rows[0] : rows[0]
  if (!preferred) return null
  const recordId = legacyIdFromMetadata(preferred.metadata)
  if (!recordId) return null
  return { animalId: preferred.animal_id, recordId }
}
