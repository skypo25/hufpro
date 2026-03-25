/**
 * Lädt alle für die PDF-Ausgabe nötigen Daten zu einem hoof_record.
 * Primär documentation_* (gleiche Lade-/Mapping-Logik wie Record-Detail), Fallback hoof_*.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { SLOT_LABELS } from "@/lib/photos/photoTypes"
import { loadRecordDetailFromDocumentation, type RecordDetailHoofPhoto } from "@/lib/documentation/loadRecordForDetailView"
import {
  loadRecordListForHorseView,
  getPreviousVisitRecordDateFromMergedList,
} from "@/lib/documentation/loadRecordListForHorseView"
import type { RecordPdfData, RecordPdfHoof, RecordPdfPhoto, RecordPdfSeller } from "./types"

type HorseRow = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  customer_id: string | null
  customers?:
    | { customer_number: number | null; name: string | null; stable_name: string | null; city: string | null }
    | { customer_number: number | null; name: string | null; stable_name: string | null; city: string | null }[]
    | null
}

type HoofRecordRow = {
  id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
  record_type?: string | null
  general_condition?: string | null
  gait?: string | null
  handling_behavior?: string | null
  horn_quality?: string | null
  hoofs_json?: unknown
}

type HoofPhotoRow = {
  file_path: string | null
  photo_type: string | null
}

type SettingsRow = { settings: Record<string, unknown> | null }

function getRelation<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

async function imageToDataUrl(
  supabase: SupabaseClient,
  filePath: string
): Promise<string> {
  const { data } = await supabase.storage
    .from("hoof-photos")
    .createSignedUrl(filePath, 60 * 5)

  if (!data?.signedUrl) return ""

  const res = await fetch(data.signedUrl)
  if (!res.ok) return ""
  const buf = await res.arrayBuffer()
  const base64 = Buffer.from(buf).toString("base64")
  const contentType = res.headers.get("content-type") || "image/jpeg"
  return `data:${contentType};base64,${base64}`
}

function parseHoofsJson(raw: unknown): RecordPdfHoof[] {
  if (!raw || !Array.isArray(raw)) return []
  const keys = ['vl', 'vr', 'hl', 'hr'] as const
  return keys
    .map((pos) => {
      const item = (raw as Record<string, unknown>[]).find(
        (h) => h?.hoof_position === pos
      )
      if (!item) return null
      return {
        position: pos,
        toeAlignment: (item.toe_alignment as string | null) ?? null,
        heelBalance: (item.heel_balance as string | null) ?? null,
        soleCondition: (item.sole_condition as string | null) ?? null,
        frogCondition: (item.frog_condition as string | null) ?? null,
      } satisfies RecordPdfHoof
    })
    .filter((h): h is RecordPdfHoof => h !== null)
}

function sellerFromSettings(s: Record<string, unknown> | null): RecordPdfSeller {
  const o = s ?? {}
  const firstName = (o.firstName as string) ?? ""
  const lastName = (o.lastName as string) ?? ""
  const name = [firstName, lastName].filter(Boolean).join(" ") || "–"
  return {
    logoUrl: (o.logoUrl as string) || null,
    companyName: (o.companyName as string) || null,
    name,
    qualification: (o.qualification as string) || null,
    street: (o.street as string) || null,
    zip: (o.zip as string) || null,
    city: (o.city as string) || null,
    phone: (o.phone as string) || null,
    email: (o.email as string) || null,
  }
}

function buildDocNumber(recordId: string, recordDate: string | null): string {
  const year = recordDate
    ? new Date(recordDate).getFullYear()
    : new Date().getFullYear()
  const suffix = recordId.replace(/-/g, "").slice(-6).toUpperCase()
  return `DOK-${year}-${suffix}`
}

async function buildPdfPhotosFromPaths(
  supabase: SupabaseClient,
  rows: { file_path: string | null; photo_type: string | null }[]
): Promise<RecordPdfPhoto[]> {
  const photos: RecordPdfPhoto[] = []
  for (const p of rows) {
    if (!p.file_path || !p.photo_type) continue
    const dataUrl = await imageToDataUrl(supabase, p.file_path)
    if (!dataUrl) continue
    photos.push({
      photoType: p.photo_type,
      label: SLOT_LABELS[p.photo_type] ?? p.photo_type,
      dataUrl,
    })
  }
  return photos
}

async function loadSharedContext(
  supabase: SupabaseClient,
  userId: string,
  horseId: string,
  recordId: string
): Promise<{
  horseRow: HorseRow
  seller: RecordPdfSeller
  lastRecordDate: string | null
  customer: ReturnType<typeof getRelation>
  birthYear: number | null
  ageYears: number | null
} | null> {
  const { data: horseRow } = await supabase
    .from("horses")
    .select(
      "id, name, breed, sex, birth_year, customer_id, customers(customer_number, name, stable_name, city)"
    )
    .eq("id", horseId)
    .eq("user_id", userId)
    .single<HorseRow>()

  if (!horseRow) return null

  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle<SettingsRow>()

  const seller = sellerFromSettings(settingsRow?.settings ?? null)

  let lastRecordDate: string | null = null
  try {
    const list = await loadRecordListForHorseView(supabase, userId, horseId)
    lastRecordDate = getPreviousVisitRecordDateFromMergedList(list.recordRows, recordId)
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[pdf] loadSharedContext lastRecordDate Fallback hoof_*", e)
    }
    const { data: prevRows } = await supabase
      .from("hoof_records")
      .select("record_date")
      .eq("horse_id", horseId)
      .eq("user_id", userId)
      .neq("id", recordId)
      .order("record_date", { ascending: false })
      .limit(1)
    lastRecordDate =
      (prevRows as { record_date: string | null }[] | null)?.[0]?.record_date ?? null
  }

  const customer = getRelation(horseRow.customers ?? null)
  const birthYear = horseRow.birth_year ?? null
  const ageYears = birthYear != null ? new Date().getFullYear() - birthYear : null

  return { horseRow, seller, lastRecordDate, customer, birthYear, ageYears }
}

export async function fetchRecordPdfData(
  supabase: SupabaseClient,
  userId: string,
  horseId: string,
  recordId: string
): Promise<RecordPdfData | null> {
  const ctx = await loadSharedContext(supabase, userId, horseId, recordId)
  if (!ctx) return null

  const { horseRow, seller, lastRecordDate, customer, birthYear, ageYears } = ctx

  const docLoad = await loadRecordDetailFromDocumentation(supabase, userId, horseId, recordId)

  if (docLoad.ok) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info("[pdf] Quelle: documentation_*", { recordId })
    }

    const r = docLoad.record
    const photoRowsForPdf = docLoad.photos.map((p: RecordDetailHoofPhoto) => ({
      file_path: p.file_path,
      photo_type: p.photo_type,
    }))
    const photos = await buildPdfPhotosFromPaths(supabase, photoRowsForPdf)

    const hoofs = parseHoofsJson(r.hoofs_json)

    return {
      horse: {
        name: horseRow.name ?? "–",
        breed: horseRow.breed ?? null,
        sex: horseRow.sex ?? null,
        birthYear,
        ageYears,
      },
      customer: {
        customerNumber: customer?.customer_number ?? null,
        name: customer?.name ?? "–",
        stableName: customer?.stable_name ?? null,
        city: customer?.city ?? null,
      },
      seller,
      record: {
        recordDate: r.record_date,
        recordType: r.record_type ?? null,
        docNumber: r.doc_number ?? buildDocNumber(recordId, r.record_date),
        lastRecordDate,
        generalCondition: r.general_condition ?? null,
        gait: r.gait ?? null,
        handlingBehavior: r.handling_behavior ?? null,
        hornQuality: r.horn_quality ?? null,
        hoofs,
        summaryNotes: r.hoof_condition ?? null,
      },
      photos,
    }
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.warn("[pdf] Fallback: hoof_*", { recordId, reason: docLoad.reason })
  }

  const { data: recordBase } = await supabase
    .from("hoof_records")
    .select("id, record_date, hoof_condition, treatment, notes, record_type")
    .eq("id", recordId)
    .eq("horse_id", horseId)
    .eq("user_id", userId)
    .single<HoofRecordRow>()

  if (!recordBase) return null

  let extended: Partial<HoofRecordRow> = {}
  const { data: extRow } = await supabase
    .from("hoof_records")
    .select("general_condition, gait, handling_behavior, horn_quality, hoofs_json")
    .eq("id", recordId)
    .eq("horse_id", horseId)
    .eq("user_id", userId)
    .maybeSingle<Partial<HoofRecordRow>>()
  if (extRow) extended = extRow

  const { data: photoRows } = await supabase
    .from("hoof_photos")
    .select("file_path, photo_type")
    .eq("hoof_record_id", recordId)
    .eq("user_id", userId)
    .returns<HoofPhotoRow[]>()

  const photos = await buildPdfPhotosFromPaths(supabase, photoRows ?? [])
  const hoofs = parseHoofsJson(extended.hoofs_json)

  return {
    horse: {
      name: horseRow.name ?? "–",
      breed: horseRow.breed ?? null,
      sex: horseRow.sex ?? null,
      birthYear,
      ageYears,
    },
    customer: {
      customerNumber: customer?.customer_number ?? null,
      name: customer?.name ?? "–",
      stableName: customer?.stable_name ?? null,
      city: customer?.city ?? null,
    },
    seller,
    record: {
      recordDate: recordBase.record_date,
      recordType: recordBase.record_type ?? null,
      docNumber: buildDocNumber(recordId, recordBase.record_date),
      lastRecordDate,
      generalCondition: extended.general_condition ?? null,
      gait: extended.gait ?? null,
      handlingBehavior: extended.handling_behavior ?? null,
      hornQuality: extended.horn_quality ?? null,
      hoofs,
      summaryNotes: recordBase.hoof_condition ?? null,
    },
    photos,
  }
}
