import JSZip from 'jszip'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rowsToCsv, rowsToCsvUtf8Bom } from '@/lib/export/csv'
import type { ExportProgress } from '@/lib/export/exportProgress'
import {
  BUCKET_HOOF,
  BUCKET_LOGOS,
  collectHoofPhotoStoragePaths,
} from '@/lib/export/storagePaths'
import { CUSTOMER_EXPORT_README } from '@/lib/export/exportReadme'
import {
  buildBefundberichtExportHtml,
  buildHoofRecordExportHtml,
  buildOrphanDocumentationExportHtml,
  buildPhotoHrefMapForDocumentationRecord,
} from '@/lib/export/documentationHtml'
import { planExportPhotos } from '@/lib/export/exportPhotoPlan'
import { fetchRecordHtmlExportPayload, sellerFromSettings } from '@/lib/pdf/recordData'
import { fetchInvoicePdfData } from '@/lib/pdf/invoiceData'
import InvoicePdfDocument from '@/components/pdf/InvoicePdfDocument'
import {
  buildDokumentationenCsvRows,
  buildKundenCsvRows,
  buildRechnungenCsvRows,
  buildRechnungspositionenCsvRows,
  buildTermineCsvRows,
  buildTiereCsvRows,
  customerDisplayName,
  legacyHoofIdFromDocumentationMetadata,
} from '@/lib/export/customerExportData'
import { sanitizeExportFilenameBase, ensureUniqueFilename } from '@/lib/export/sanitizeExportFilename'
import { formatStorageBytesShort } from '@/lib/format'

const TECH = '99_Technischer_Rohdatenexport'
const STORAGE_DOWNLOAD_CONCURRENCY = 8
function technicalStorageZipPath(bucket: string, storagePath: string): string {
  const trimmed = storagePath.trim().replace(/^\/+/, '').replace(/\.\./g, '_')
  return `${TECH}/fotos/${bucket}/${trimmed}`
}

export type BuildUserExportZipOptions = {
  onProgress?: (p: ExportProgress) => void
  /** Wenn gesetzt (z. B. Service Role), kein Request-Cookie nötig — z. B. Hintergrund-Export. */
  supabaseClient?: SupabaseClient
}

export async function buildUserDataExportZip(
  userId: string,
  options?: BuildUserExportZipOptions
): Promise<Buffer> {
  const onProgress = options?.onProgress
  const report = (percent: number, label: string) => onProgress?.({ percent, label })

  const supabase =
    options?.supabaseClient ?? (await createSupabaseServerClient())
  const zip = new JSZip()
  report(1, 'Export wird vorbereitet …')

  zip.file('01_Liesmich/README.txt', CUSTOMER_EXPORT_README)

  async function tableJsonTechnical(name: string, table: string, labelDe: string, pct: number) {
    report(pct, labelDe)
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
    if (error) throw new Error(`${table}: ${error.message}`)
    const rows = (data ?? []) as Record<string, unknown>[]
    zip.file(`${TECH}/${name}.json`, JSON.stringify(rows, null, 2))
    if (rows.length > 0) {
      zip.file(`${TECH}/${name}.csv`, rowsToCsv(rows))
    }
  }

  await tableJsonTechnical('kunden', 'customers', 'Technischer Export: Kunden …', 4)
  await tableJsonTechnical('tiere', 'horses', 'Technischer Export: Tiere …', 6)
  await tableJsonTechnical('termine', 'appointments', 'Technischer Export: Termine …', 8)
  await tableJsonTechnical('termin_tier_verknuepfungen', 'appointment_horses', 'Technischer Export: Verknüpfungen …', 10)
  await tableJsonTechnical('hufdokumentationen', 'hoof_records', 'Technischer Export: Hufdokumentationen …', 12)
  await tableJsonTechnical('huf_fotos_metadaten', 'hoof_photos', 'Technischer Export: Huf-Fotos …', 14)
  await tableJsonTechnical('dokumentationen', 'documentation_records', 'Technischer Export: Dokumentationen …', 16)
  await tableJsonTechnical('dokumentationsfotos_metadaten', 'documentation_photos', 'Technischer Export: Dokumentationsfotos …', 18)

  report(20, 'Rechnungen (technisch) …')
  const { data: invoices, error: invErr } = await supabase.from('invoices').select('*').eq('user_id', userId)
  if (invErr) throw new Error(`invoices: ${invErr.message}`)
  const invRows = (invoices ?? []) as Record<string, unknown>[]
  zip.file(`${TECH}/rechnungen.json`, JSON.stringify(invRows, null, 2))
  if (invRows.length > 0) {
    zip.file(`${TECH}/rechnungen.csv`, rowsToCsv(invRows))
  }

  const invIds = invRows.map((r) => r.id as string).filter(Boolean)
  let itemRows: Record<string, unknown>[] = []
  if (invIds.length > 0) {
    const { data: items, error: itErr } = await supabase.from('invoice_items').select('*').in('invoice_id', invIds)
    if (itErr) throw new Error(`invoice_items: ${itErr.message}`)
    itemRows = (items ?? []) as Record<string, unknown>[]
    zip.file(`${TECH}/rechnungspositionen.json`, JSON.stringify(itemRows, null, 2))
    if (itemRows.length > 0) {
      zip.file(`${TECH}/rechnungspositionen.csv`, rowsToCsv(itemRows))
    }
  } else {
    zip.file(`${TECH}/rechnungspositionen.json`, '[]\n')
    zip.file(
      `${TECH}/rechnungspositionen.csv`,
      'Hinweis;Inhalt\nKeine Rechnungen;Es liegen keine Rechnungen vor – deshalb keine Positionen.\n'
    )
  }

  report(22, 'Einstellungen (technisch) …')
  const { data: settings, error: setErr } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (setErr) throw new Error(`user_settings: ${setErr.message}`)
  if (settings) {
    zip.file(`${TECH}/einstellungen.json`, JSON.stringify(settings, null, 2))
  }

  const settingsObj = (settings?.settings as Record<string, unknown> | undefined) ?? {}
  const prefixRaw = (settingsObj.customerNumberPrefix as string | undefined) ?? 'K-'
  const customerNumberPrefixResolved = prefixRaw.trim().endsWith('-')
    ? prefixRaw.trim()
    : `${prefixRaw.trim()}-`

  report(24, 'Daten für Kundenexport werden geladen …')
  const [
    { data: customersData, error: cErr },
    { data: horsesData, error: hErr },
    { data: appointmentsData, error: aErr },
    { data: ahData, error: ahErr },
    { data: hoofData, error: hoofErr },
    { data: docData, error: docErr },
    { data: hpData, error: hpErr },
    { data: dpData, error: dpErr },
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('user_id', userId),
    supabase.from('horses').select('*').eq('user_id', userId),
    supabase.from('appointments').select('*').eq('user_id', userId),
    supabase.from('appointment_horses').select('appointment_id, horse_id').eq('user_id', userId),
    supabase.from('hoof_records').select('*').eq('user_id', userId),
    supabase.from('documentation_records').select('*').eq('user_id', userId),
    supabase.from('hoof_photos').select('*').eq('user_id', userId),
    supabase.from('documentation_photos').select('*').eq('user_id', userId),
  ])

  if (cErr) throw new Error(`customers: ${cErr.message}`)
  if (hErr) throw new Error(`horses: ${hErr.message}`)
  if (aErr) throw new Error(`appointments: ${aErr.message}`)
  if (ahErr) throw new Error(`appointment_horses: ${ahErr.message}`)
  if (hoofErr) throw new Error(`hoof_records: ${hoofErr.message}`)
  if (docErr) throw new Error(`documentation_records: ${docErr.message}`)
  if (hpErr) throw new Error(`hoof_photos: ${hpErr.message}`)
  if (dpErr) throw new Error(`documentation_photos: ${dpErr.message}`)

  const customers = (customersData ?? []) as Record<string, unknown>[]
  const horses = (horsesData ?? []) as Record<string, unknown>[]
  const appointments = (appointmentsData ?? []) as Record<string, unknown>[]
  const appointmentHorses = (ahData ?? []) as { appointment_id: string; horse_id: string }[]
  const hoofRecords = (hoofData ?? []) as Record<string, unknown>[]
  const documentationRecords = (docData ?? []) as Record<string, unknown>[]
  const hoofPhotos = (hpData ?? []) as Record<string, unknown>[]
  const documentationPhotos = (dpData ?? []) as Record<string, unknown>[]

  const customerById = new Map<string, Record<string, unknown>>()
  for (const c of customers) customerById.set(c.id as string, c)
  const horseById = new Map<string, Record<string, unknown>>()
  for (const h of horses) horseById.set(h.id as string, h)

  const legacyLinkedHoofIds = new Set<string>()
  for (const d of documentationRecords) {
    const leg = legacyHoofIdFromDocumentationMetadata(d.metadata)
    if (leg) legacyLinkedHoofIds.add(leg)
  }
  const hoofOnlyRecords = hoofRecords.filter((r) => !legacyLinkedHoofIds.has(r.id as string))

  const itemsByInvoiceId = new Map<string, { amount_cents: number; tax_rate_percent: number }[]>()
  for (const it of itemRows) {
    const iid = it.invoice_id as string
    const arr = itemsByInvoiceId.get(iid) ?? []
    arr.push({
      amount_cents: Number(it.amount_cents) || 0,
      tax_rate_percent: Number(it.tax_rate_percent) || 0,
    })
    itemsByInvoiceId.set(iid, arr)
  }

  zip.file('02_Kunden/Kunden.csv', rowsToCsvUtf8Bom(buildKundenCsvRows({ customers, customerNumberPrefix: customerNumberPrefixResolved })))
  zip.file(
    '03_Tiere/Tiere.csv',
    rowsToCsvUtf8Bom(buildTiereCsvRows({ horses, customerById, customerNumberPrefix: customerNumberPrefixResolved }))
  )
  zip.file(
    '04_Termine/Termine.csv',
    rowsToCsvUtf8Bom(buildTermineCsvRows({ appointments, appointmentHorses, customerById, horseById }))
  )

  const docPhotoCountByDocId = new Map<string, number>()
  for (const p of documentationPhotos) {
    const rid = p.documentation_record_id as string | undefined
    if (!rid) continue
    docPhotoCountByDocId.set(rid, (docPhotoCountByDocId.get(rid) ?? 0) + 1)
  }
  const hoofPhotoCountByHoofId = new Map<string, number>()
  for (const p of hoofPhotos) {
    const rid = p.hoof_record_id as string | null | undefined
    if (!rid) continue
    hoofPhotoCountByHoofId.set(rid, (hoofPhotoCountByHoofId.get(rid) ?? 0) + 1)
  }

  const dokRowsRaw = buildDokumentationenCsvRows({
    documentationRecords,
    hoofOnlyRecords,
    horseById,
    customerById,
  })

  const dokRows: Record<string, unknown>[] = dokRowsRaw.map((row, i) => {
    let n = 0
    if (i < documentationRecords.length) {
      const docId = documentationRecords[i].id as string
      n = docPhotoCountByDocId.get(docId) ?? 0
      const leg = legacyHoofIdFromDocumentationMetadata(documentationRecords[i].metadata)
      if (n === 0 && leg) n = hoofPhotoCountByHoofId.get(leg) ?? 0
    } else {
      const hi = i - documentationRecords.length
      const hid = hoofOnlyRecords[hi]?.id as string | undefined
      if (hid) n = hoofPhotoCountByHoofId.get(hid) ?? 0
    }
    return { ...row, 'Anzahl Fotos': n }
  })

  const docById = new Map<string, Record<string, unknown>>()
  for (const d of documentationRecords) docById.set(d.id as string, d)

  const { planned, pathToZipRel, usedPhotoNames } = planExportPhotos({
    documentationPhotos,
    hoofPhotos,
    hoofRecords,
    horseById,
    customerById,
    docById,
    bucketHoof: BUCKET_HOOF,
  })

  const sellerForHtml = sellerFromSettings(settingsObj as Record<string, unknown> | null)

  const docRowCount = documentationRecords.length
  const htmlNameByIndex: string[] = new Array(dokRows.length).fill('')
  const usedHtmlNames = new Set<string>()

  report(28, 'Dokumentations-HTML wird erzeugt …')
  const htmlTotal = Math.max(1, dokRows.length)
  for (let i = 0; i < dokRows.length; i++) {
    const row = dokRows[i]
    const horseName = ((row.Tiername as string) || 'Tier').trim() || 'Tier'
    const dateRaw = (row.Dokumentationsdatum as string) || ''
    const dateSlug = dateRaw.replace(/\./g, '-').replace(/\s/g, '_') || 'ohne-Datum'
    const kindShort = sanitizeExportFilenameBase((row.Dokumentationstyp as string) || 'Dokumentation')
    const base = sanitizeExportFilenameBase(`${horseName}_${dateSlug}_${kindShort}`)
    const fname = ensureUniqueFilename(base, 'html', usedHtmlNames)
    htmlNameByIndex[i] = fname

    let html: string
    if (i < docRowCount) {
      const d = documentationRecords[i]
      const hid = d.animal_id as string
      const h = horseById.get(hid)
      const cid = h?.customer_id as string | undefined
      const cust = cid ? customerById.get(cid) : undefined
      const leg = legacyHoofIdFromDocumentationMetadata(d.metadata)
      const photoMap = buildPhotoHrefMapForDocumentationRecord(d.id as string, documentationPhotos, pathToZipRel)
      if (leg) {
        const payload = await fetchRecordHtmlExportPayload(supabase, userId, hid, leg, pathToZipRel)
        html = payload
          ? buildBefundberichtExportHtml(payload)
          : buildOrphanDocumentationExportHtml({
              d,
              horse: h,
              customer: cust,
              seller: sellerForHtml,
              photoHrefByType: photoMap,
            })
      } else {
        html = buildOrphanDocumentationExportHtml({
          d,
          horse: h,
          customer: cust,
          seller: sellerForHtml,
          photoHrefByType: photoMap,
        })
      }
    } else {
      const r = hoofOnlyRecords[i - docRowCount]
      const hid = r.horse_id as string
      const h = horseById.get(hid)
      const cid = h?.customer_id as string | undefined
      const cust = cid ? customerById.get(cid) : undefined
      const payload = await fetchRecordHtmlExportPayload(supabase, userId, hid, r.id as string, pathToZipRel)
      html = payload
        ? buildBefundberichtExportHtml(payload)
        : buildHoofRecordExportHtml({ r, horse: h, customer: cust })
    }

    zip.file(`05_Dokumentationen/HTML/${fname}`, html)
    report(28 + Math.min(14, Math.round(((i + 1) / htmlTotal) * 14)), `Dokumentations-HTML (${i + 1}/${dokRows.length}) …`)
  }

  for (let i = 0; i < dokRows.length; i++) {
    dokRows[i] = { ...dokRows[i], 'HTML-Dateiname': htmlNameByIndex[i] || '' }
  }

  zip.file('05_Dokumentationen/Dokumentationen.csv', rowsToCsvUtf8Bom(dokRows))

  const invoicePdfNames = new Map<string, string>()
  const usedInvPdf = new Set<string>()
  report(44, 'Rechnungs-PDFs werden erzeugt …')
  let invPdfI = 0
  for (const inv of invRows) {
    invPdfI += 1
    const invId = inv.id as string
    const invNum = (inv.invoice_number as string) || invId
    const base = sanitizeExportFilenameBase(`Rechnung_${invNum}`)
    const fname = ensureUniqueFilename(base, 'pdf', usedInvPdf)
    invoicePdfNames.set(invId, fname)
    report(44 + Math.min(10, Math.round((invPdfI / Math.max(1, invRows.length)) * 10)), `Rechnungs-PDFs (${invPdfI}/${invRows.length}) …`)
    const data = await fetchInvoicePdfData(supabase, userId, invId)
    if (!data) continue
    const element = React.createElement(InvoicePdfDocument, { data })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any)
    zip.file(`07_Rechnungen/PDFs/${fname}`, new Uint8Array(pdfBuffer))
  }

  const rechnungenRows = buildRechnungenCsvRows({ invoices: invRows, itemsByInvoiceId, customerById }).map((row) => {
    const id = row.interne_rechnungs_id as string
    const fn = invoicePdfNames.get(id)
    return { ...row, 'PDF-Dateiname': fn ?? '' }
  })
  zip.file('07_Rechnungen/Rechnungen.csv', rowsToCsvUtf8Bom(rechnungenRows))
  zip.file(
    '07_Rechnungen/Rechnungspositionen.csv',
    rowsToCsvUtf8Bom(buildRechnungspositionenCsvRows({ invoices: invRows, items: itemRows }))
  )

  const missingFiles: string[] = []
  const fotoRows: Record<string, unknown>[] = planned.map((p) => ({ ...p.csvRow }))

  report(56, 'Fotos werden kopiert und benannt …')

  const downloadedStorage = new Map<string, number>()
  for (let pi = 0; pi < planned.length; pi++) {
    const item = planned[pi]
    const path = item.storagePath
    const row = fotoRows[pi] as Record<string, unknown>

    if (downloadedStorage.has(path)) {
      const bytes = downloadedStorage.get(path) ?? 0
      if (bytes > 0 && !(row.Dateigröße as string)?.trim()) {
        fotoRows[pi] = { ...row, Dateigröße: formatStorageBytesShort(bytes) }
      }
      continue
    }

    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase.storage.from(BUCKET_HOOF).download(path)
    if (error || !data) {
      missingFiles.push(`${BUCKET_HOOF}/${path}: ${error?.message ?? 'Download fehlgeschlagen'}`)
      continue
    }
    // eslint-disable-next-line no-await-in-loop
    const ab = await data.arrayBuffer()
    downloadedStorage.set(path, ab.byteLength)
    const sizeCell = row.Dateigröße as string
    if (!sizeCell && ab.byteLength) {
      fotoRows[pi] = { ...row, Dateigröße: formatStorageBytesShort(ab.byteLength) }
    }
    zip.file(item.zipRel, new Uint8Array(ab))
  }

  for (const h of horses) {
    const profilePath = `${userId}/${h.id as string}/animal-profile.jpg`
    const base = sanitizeExportFilenameBase(`${((h.name as string) || 'Tier').trim() || 'Tier'}_Profilbild`)
    const fname = ensureUniqueFilename(base, 'jpg', usedPhotoNames)
    const rel = `06_Fotos/Bilder/${fname}`
    const cid = h.customer_id as string | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const { data, error } = await supabase.storage.from(BUCKET_HOOF).download(profilePath)
    if (error || !data) continue
    const ab = await data.arrayBuffer()
    fotoRows.push({
      Tiername: (h.name as string) ?? '',
      Kunde: customerDisplayName(cust),
      Dokumentationsdatum: '',
      Fototyp: 'Profilbild',
      Dateiname: fname,
      'Bildpfad im Export': rel,
      Auflösung: '',
      Dateigröße: formatStorageBytesShort(ab.byteLength),
      'Aufgenommen am': '',
      interne_foto_id: '',
      interne_dokumentations_id: '',
      interne_hufdokumentation_id: '',
    })
    zip.file(rel, new Uint8Array(ab))
  }

  zip.file('06_Fotos/Fotos.csv', rowsToCsvUtf8Bom(fotoRows))

  const hoofPaths = collectHoofPhotoStoragePaths({
    userId,
    hoofPhotoPaths: hoofPhotos.map((r) => r.file_path as string | null),
    documentationPhotoPaths: documentationPhotos.map((r) => r.file_path as string | null),
    horseIds: horses.map((r) => r.id as string),
  })

  async function listUserLogoPaths(): Promise<string[]> {
    const { data, error } = await supabase.storage.from(BUCKET_LOGOS).list(userId, { limit: 50 })
    if (error || !data?.length) return []
    return data.filter((f) => f.name && f.metadata !== null).map((f) => `${userId}/${f.name}`)
  }

  const logoPaths = await listUserLogoPaths()

  async function appendTechnicalStorageFiles(
    bucket: string,
    storagePaths: string[],
    fromPct: number,
    toPct: number,
    labelBase: string
  ): Promise<void> {
    const seen = new Set<string>()
    const unique: string[] = []
    for (const p of storagePaths) {
      const key = `${bucket}:${p}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(p)
    }
    const batches: string[][] = []
    for (let i = 0; i < unique.length; i += STORAGE_DOWNLOAD_CONCURRENCY) {
      batches.push(unique.slice(i, i + STORAGE_DOWNLOAD_CONCURRENCY))
    }
    if (batches.length === 0 && onProgress) {
      onProgress({ percent: toPct, label: `${labelBase}: keine Dateien` })
    }
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi]
      if (onProgress && batches.length > 0) {
        const t = (bi + 1) / batches.length
        const pct = Math.round(fromPct + t * (toPct - fromPct))
        onProgress({
          percent: pct,
          label: `${labelBase}: ${bi + 1}/${batches.length} (${unique.length} Dateien)`,
        })
      }
      await Promise.all(
        batch.map(async (path) => {
          const { data, error } = await supabase.storage.from(bucket).download(path)
          if (error || !data) {
            missingFiles.push(`${bucket}/${path}: ${error?.message ?? 'Download fehlgeschlagen'}`)
            return
          }
          const ab = await data.arrayBuffer()
          zip.file(technicalStorageZipPath(bucket, path), new Uint8Array(ab))
        })
      )
    }
  }

  await appendTechnicalStorageFiles(BUCKET_HOOF, hoofPaths, 72, 84, 'Technischer Export: Huf-Fotos')
  await appendTechnicalStorageFiles(BUCKET_LOGOS, logoPaths, 85, 90, 'Technischer Export: Logos')

  if (missingFiles.length > 0) {
    zip.file(`${TECH}/fotos/_fehlende_dateien.txt`, missingFiles.join('\n'))
  }

  report(92, 'ZIP-Archiv wird erzeugt …')
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  report(96, 'Export ist fertig.')
  return Buffer.from(buf)
}
