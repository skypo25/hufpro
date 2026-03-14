/**
 * Lädt alle für die PDF-Ausgabe nötigen Daten zu einem hoof_record.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { SLOT_LABELS } from "@/lib/photos/photoTypes"
import type { RecordPdfData, RecordPdfPhoto } from "./types"

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
}

type HoofPhotoRow = {
  file_path: string | null
  photo_type: string | null
}

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

export async function fetchRecordPdfData(
  supabase: SupabaseClient,
  userId: string,
  horseId: string,
  recordId: string
): Promise<RecordPdfData | null> {
  const { data: horseRow } = await supabase
    .from("horses")
    .select(
      "id, name, breed, sex, birth_year, customer_id, customers(customer_number, name, stable_name, city)"
    )
    .eq("id", horseId)
    .eq("user_id", userId)
    .single<HorseRow>()

  const { data: recordRow } = await supabase
    .from("hoof_records")
    .select("id, record_date, hoof_condition, treatment, notes")
    .eq("id", recordId)
    .eq("horse_id", horseId)
    .eq("user_id", userId)
    .single<HoofRecordRow>()

  if (!horseRow || !recordRow) return null

  const customer = getRelation(horseRow.customers ?? null)
  const birthYear = horseRow.birth_year ?? null
  const ageYears =
    birthYear != null
      ? new Date().getFullYear() - birthYear
      : null

  const { data: photoRows } = await supabase
    .from("hoof_photos")
    .select("file_path, photo_type")
    .eq("hoof_record_id", recordId)
    .eq("user_id", userId)
    .returns<HoofPhotoRow[]>()

  const photos: RecordPdfPhoto[] = []
  if (photoRows?.length) {
    for (const p of photoRows) {
      if (!p.file_path) continue
      const dataUrl = await imageToDataUrl(supabase, p.file_path)
      if (!dataUrl) continue
      photos.push({
        photoType: p.photo_type ?? "Foto",
        label: SLOT_LABELS[p.photo_type ?? ""] ?? p.photo_type ?? "Foto",
        dataUrl,
      })
    }
  }

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
    record: {
      recordDate: recordRow.record_date,
      recordType: null,
      hoofCondition: recordRow.hoof_condition,
      treatment: recordRow.treatment,
      notes: recordRow.notes,
    },
    photos,
  }
}
