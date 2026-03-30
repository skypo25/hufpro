import { createSupabaseServerClient } from '@/lib/supabase-server'
import { deriveAppProfile } from '@/lib/appProfile'
import { loadRecordListForHorseView } from '@/lib/documentation/loadRecordListForHorseView'
import { loadRecordDetailFromDocumentation } from '@/lib/documentation/loadRecordForDetailView'
import { parseHoofsFromJson } from '@/lib/hoofs'
import type { HoofKey } from '@/lib/hoofs'
import {
  pickPhotoForSlot,
  photoSlotKeyFromHoofView,
  loadSlotTimelineForHorse,
  isHoofKey,
  isHoofCompareView,
  type HoofCompareView,
} from '@/lib/hoofCompare'
import type { CompareSidePayload, RecordOption, TimelineItem } from '@/components/hoofCompare/HoofComparePageClient'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'

function buildDocNumber(recordId: string, recordDate: string | null): string {
  const year = recordDate ? new Date(recordDate).getFullYear() : new Date().getFullYear()
  const suffix = recordId.replace(/-/g, '').slice(-4).toUpperCase()
  return `DOK-${year}-${suffix}`
}

function formatGermanDate(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function joinMeta(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' · ')
}

async function signedUrl(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, path: string) {
  const { data } = await supabase.storage.from('hoof-photos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

async function loadCompareSide(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  horseId: string,
  recordId: string,
  slotKey: PhotoSlotKey,
  hoof: HoofKey
): Promise<CompareSidePayload> {
  const res = await loadRecordDetailFromDocumentation(supabase, userId, horseId, recordId)
  if (!res.ok) {
    return {
      recordId,
      recordDate: null,
      docNumber: null,
      signedUrl: null,
      missingDoc: true,
      hoofState: parseHoofsFromJson([])[hoof],
    }
  }
  const photo = pickPhotoForSlot(res.photos, slotKey)
  const url = photo?.file_path ? await signedUrl(supabase, photo.file_path) : null
  const hoofs = parseHoofsFromJson(res.record.hoofs_json)
  return {
    recordId,
    recordDate: res.record.record_date,
    docNumber: res.record.doc_number ?? null,
    signedUrl: url,
    missingDoc: false,
    hoofState: hoofs[hoof],
  }
}

export type HorseHoofCompareLoaded = {
  horseId: string
  basePath: string
  horseName: string
  horseSubtitle: string
  recordOptions: RecordOption[]
  left: CompareSidePayload
  right: CompareSidePayload
  hoof: HoofKey
  view: HoofCompareView
  slotKey: PhotoSlotKey
  timeline: TimelineItem[]
  daysBetween: number | null
}

export type LoadHorseHoofComparePageDataResult =
  | { status: 'ok'; data: HorseHoofCompareLoaded }
  | { status: 'unauthorized' }
  | { status: 'not_found' }
  | { status: 'forbidden'; horseId: string }
  | { status: 'insufficient_records'; horseId: string }

/**
 * Gleiche Datengrundlage wie die Desktop-Vergleichsseite (Query: left, right, hoof, view).
 */
export async function loadHorseHoofComparePageData(
  horseId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<LoadHorseHoofComparePageDataResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { status: 'unauthorized' }
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  if (!profile.isHufbearbeiter) {
    return { status: 'forbidden', horseId }
  }

  const leftQ = typeof searchParams.left === 'string' ? searchParams.left : undefined
  const rightQ = typeof searchParams.right === 'string' ? searchParams.right : undefined
  const hoofQ = typeof searchParams.hoof === 'string' ? searchParams.hoof : undefined
  const viewQ = typeof searchParams.view === 'string' ? searchParams.view : undefined

  const hoof: HoofKey = hoofQ && isHoofKey(hoofQ) ? hoofQ : 'vl'
  const view: HoofCompareView = viewQ && isHoofCompareView(viewQ) ? viewQ : 'solar'
  const slotKey = photoSlotKeyFromHoofView(hoof, view)

  const { data: horse } = await supabase
    .from('horses')
    .select(
      `
      id,
      name,
      breed,
      sex,
      birth_year,
      usage,
      hoof_status,
      customers (
        id,
        name
      )
    `
    )
    .eq('id', horseId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!horse) {
    return { status: 'not_found' }
  }


  const owner = Array.isArray(horse.customers) ? horse.customers[0] : horse.customers
  const age = horse.birth_year != null ? new Date().getFullYear() - horse.birth_year : null
  const horseSubtitle = joinMeta([
    horse.breed,
    horse.sex,
    horse.birth_year != null
      ? age != null && age >= 0 && age <= 60
        ? `${age} J.`
        : `geb. ${horse.birth_year}`
      : null,
    owner?.name ?? null,
  ])

  const { recordRows } = await loadRecordListForHorseView(supabase, user.id, horseId)

  if (recordRows.length < 2) {
    return { status: 'insufficient_records', horseId }
  }

  const ids = new Set(recordRows.map((r) => r.record.id))
  let leftId = leftQ && ids.has(leftQ) ? leftQ : undefined
  let rightId = rightQ && ids.has(rightQ) ? rightQ : undefined
  if (!leftId || !rightId || leftId === rightId) {
    rightId = recordRows[0]!.record.id
    leftId = recordRows[1]!.record.id
  }

  const recordOptions: RecordOption[] = recordRows.map(({ record }) => ({
    id: record.id,
    label: `${record.doc_number ?? buildDocNumber(record.id, record.record_date)} · ${formatGermanDate(record.record_date)}`,
  }))

  const [left, right] = await Promise.all([
    loadCompareSide(supabase, user.id, horseId, leftId, slotKey, hoof),
    loadCompareSide(supabase, user.id, horseId, rightId, slotKey, hoof),
  ])

  const timelineRows = await loadSlotTimelineForHorse(supabase, user.id, horseId, slotKey)
  const timeline: TimelineItem[] = await Promise.all(
    timelineRows.map(async (t) => ({
      legacyRecordId: t.legacyRecordId,
      signedUrl: await signedUrl(supabase, t.filePath),
      recordDate: t.recordDate,
      docNumber: t.docNumber,
      recordTypeLabel: t.recordTypeLabel,
    }))
  )

  let daysBetween: number | null = null
  if (left.recordDate && right.recordDate) {
    const a = Date.parse(left.recordDate)
    const b = Date.parse(right.recordDate)
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      daysBetween = Math.round(Math.abs(b - a) / (24 * 60 * 60 * 1000))
    }
  }

  const basePath = `/animals/${horseId}`

  return {
    status: 'ok',
    data: {
      horseId,
      basePath,
      horseName: horse.name || 'Pferd',
      horseSubtitle: horseSubtitle || '–',
      recordOptions,
      left,
      right,
      hoof,
      view,
      slotKey,
      timeline,
      daysBetween,
    },
  }
}
