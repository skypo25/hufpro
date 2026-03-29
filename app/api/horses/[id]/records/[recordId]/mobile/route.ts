import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  loadRecordDetailFromDocumentation,
  type RecordDetailHoofPhoto,
  type RecordDetailHoofRecord,
} from '@/lib/documentation/loadRecordForDetailView'
import { toCanonicalPhotoSlot } from '@/lib/photos/photoTypes'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'

type HoofRecord = RecordDetailHoofRecord
type HoofPhoto = RecordDetailHoofPhoto

/** Gleiche JSON-Felder wie zuvor + treatment (aus Doc-Mapping). */
function recordToMobileResponse(record: RecordDetailHoofRecord) {
  return {
    id: record.id,
    record_date: record.record_date,
    record_type: record.record_type ?? null,
    general_condition: record.general_condition ?? null,
    gait: record.gait ?? null,
    handling_behavior: record.handling_behavior ?? null,
    horn_quality: record.horn_quality ?? null,
    hoofs_json: record.hoofs_json ?? null,
    hoof_condition: record.hoof_condition,
    treatment: record.treatment ?? null,
    notes: record.notes ?? null,
    created_at: record.created_at ?? null,
    updated_at: record.updated_at ?? null,
    doc_number: record.doc_number ?? null,
    summary_notes: record.hoof_condition ?? null,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: horseId, recordId } = await params
  if (!horseId || !recordId) {
    return NextResponse.json({ error: 'horseId oder recordId fehlt' }, { status: 400 })
  }

  const { data: horse } = await supabase
    .from('horses')
    .select('id,name,breed,sex,birth_year,customer_id,stable_name')
    .eq('id', horseId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!horse) {
    return NextResponse.json({ error: 'Dokumentation nicht gefunden' }, { status: 404 })
  }

  const docLoad = await loadRecordDetailFromDocumentation(supabase, user.id, horseId, recordId)

  let record: RecordDetailHoofRecord
  let photoRows: HoofPhoto[]

  if (docLoad.ok) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.info('[mobile record API] Quelle: documentation_*', { recordId })
    }
    record = docLoad.record
    photoRows = docLoad.photos
  } else {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[mobile record API] Fallback: hoof_*', { recordId, reason: docLoad.reason })
    }

    const { data: recordBase } = await supabase
      .from('hoof_records')
      .select('id, horse_id, record_date, hoof_condition, treatment, notes, created_at, updated_at')
      .eq('id', recordId)
      .eq('horse_id', horseId)
      .eq('user_id', user.id)
      .maybeSingle<HoofRecord>()

    if (!recordBase) {
      return NextResponse.json({ error: 'Dokumentation nicht gefunden' }, { status: 404 })
    }

    let extRecord: Partial<HoofRecord> = {}
    const { data: extRow } = await supabase
      .from('hoof_records')
      .select('general_condition, gait, handling_behavior, horn_quality, hoofs_json, record_type, doc_number')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .maybeSingle<Partial<HoofRecord>>()
    if (extRow) extRecord = extRow

    record = { ...recordBase, ...extRecord }

    const { data: hoofPhotos } = await supabase
      .from('hoof_photos')
      .select('id, file_path, photo_type, annotations_json, width, height')
      .eq('hoof_record_id', recordId)
      .eq('user_id', user.id)
      .returns<HoofPhoto[]>()

    photoRows = hoofPhotos ?? []
  }

  let customer: { id: string; name: string | null } | null = null
  if (horse.customer_id) {
    const { data: c } = await supabase
      .from('customers')
      .select('id,name')
      .eq('id', horse.customer_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (c) customer = c
  }
  const horseWithCustomer = { ...horse, customers: customer }

  const photoUrls: Partial<Record<PhotoSlotKey, string>> = {}
  const photoMeta: Partial<Record<PhotoSlotKey, { annotations: unknown; width: number; height: number }>> = {}

  if (photoRows.length) {
    for (const p of photoRows) {
      if (!p.file_path || !p.photo_type) continue
      const slot = toCanonicalPhotoSlot(p.photo_type)
      if (!slot) continue
      const { data: s } = await supabase.storage.from('hoof-photos').createSignedUrl(p.file_path, 3600)
      if (s?.signedUrl) photoUrls[slot] = s.signedUrl
      photoMeta[slot] = {
        annotations: p.annotations_json ?? {},
        width: p.width ?? 900,
        height: p.height ?? 1600,
      }
    }
  }

  const recordForMobile = recordToMobileResponse(record)

  return NextResponse.json({
    horse: horseWithCustomer,
    record: recordForMobile,
    photoUrls,
    photoMeta,
  })
}
