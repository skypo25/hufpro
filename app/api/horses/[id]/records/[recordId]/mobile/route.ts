import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { toCanonicalPhotoSlot } from '@/lib/photos/photoTypes'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: horseId, recordId } = await params
  if (!horseId || !recordId) {
    return NextResponse.json({ error: 'horseId oder recordId fehlt' }, { status: 400 })
  }

  const [{ data: horse }, { data: record }] = await Promise.all([
    supabase
      .from('horses')
      .select('id,name,breed,sex,birth_year,customer_id')
      .eq('id', horseId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('hoof_records')
      .select('id,record_date,record_type,general_condition,gait,handling_behavior,horn_quality,hoofs_json,hoof_condition,notes,created_at,updated_at,doc_number')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!horse || !record) {
    return NextResponse.json({ error: 'Dokumentation nicht gefunden' }, { status: 404 })
  }

  let customer: { id: string; name: string | null; stable_name: string | null } | null = null
  if (horse.customer_id) {
    const { data: c } = await supabase
      .from('customers')
      .select('id,name,stable_name')
      .eq('id', horse.customer_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (c) customer = c
  }
  const horseWithCustomer = { ...horse, customers: customer }

  const { data: photos } = await supabase
    .from('hoof_photos')
    .select('id,file_path,photo_type,annotations_json,width,height')
    .eq('hoof_record_id', recordId)
    .eq('user_id', user.id)

  const photoUrls: Partial<Record<PhotoSlotKey, string>> = {}
  const photoMeta: Partial<Record<PhotoSlotKey, { annotations: unknown; width: number; height: number }>> = {}

  if (photos?.length) {
    for (const p of photos) {
      if (!p.file_path || !p.photo_type) continue
      const slot = toCanonicalPhotoSlot(p.photo_type)
      if (!slot) continue
      const { data: s } = await supabase.storage
        .from('hoof-photos')
        .createSignedUrl(p.file_path, 3600)
      if (s?.signedUrl) photoUrls[slot] = s.signedUrl
      photoMeta[slot] = {
        annotations: p.annotations_json ?? {},
        width: p.width ?? 900,
        height: p.height ?? 1600,
      }
    }
  }

  const recordForMobile = { ...record, summary_notes: (record as { hoof_condition?: string | null }).hoof_condition ?? null }

  return NextResponse.json({
    horse: horseWithCustomer,
    record: recordForMobile,
    photoUrls,
    photoMeta,
  })
}
