import JSZip from 'jszip'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { rowsToCsv } from '@/lib/export/csv'
import {
  BUCKET_HOOF,
  BUCKET_LOGOS,
  collectHoofPhotoStoragePaths,
  zipEntryPathForStorage,
} from '@/lib/export/storagePaths'

const README = `AniDocs – Datenexport
===================

Dieses Archiv enthält Ihre Stammdaten und Dokumentationen als CSV- und JSON-Dateien.

- CSV: Trennzeichen ist das Semikolon (;), für Excel in DE geeignet.
- JSON: vollständige Strukturen (z. B. Dokumentationen) für Weiterverarbeitung oder Backup.
- Ordner fotos/: Bilddateien aus dem Supabase-Storage (Buckets hoof-photos und user-logos).
  Die Pfade im Archiv entsprechen dem Storage-Pfad unterhalb des Bucket-Namens; die Tabellen
  hoof_photos / documentation_photos verweisen mit file_path auf hoof-photos.
  Betriebslogos liegen unter fotos/user-logos/{Ihre-Nutzer-ID}/logo.* .
- fotos/_fehlende_dateien.txt: nur falls einzelne Objekte nicht geladen werden konnten (z. B. gelöscht).

Rechtlicher Hinweis: Nutzung und Aufbewahrung liegen in Ihrer Verantwortung (GoBD o. Ä. bei geschäftlichen Daten).

`

const STORAGE_DOWNLOAD_CONCURRENCY = 8

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

async function appendStorageFilesToZip(
  zip: JSZip,
  supabase: ServerSupabase,
  bucket: string,
  storagePaths: string[],
  missingLines: string[]
): Promise<void> {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const p of storagePaths) {
    const key = `${bucket}:${p}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(p)
  }

  for (let i = 0; i < unique.length; i += STORAGE_DOWNLOAD_CONCURRENCY) {
    const batch = unique.slice(i, i + STORAGE_DOWNLOAD_CONCURRENCY)
    await Promise.all(
      batch.map(async (path) => {
        const { data, error } = await supabase.storage.from(bucket).download(path)
        if (error || !data) {
          missingLines.push(`${bucket}/${path}: ${error?.message ?? 'Download fehlgeschlagen'}`)
          return
        }
        const ab = await data.arrayBuffer()
        zip.file(zipEntryPathForStorage(bucket, path), new Uint8Array(ab))
      })
    )
  }
}

async function listUserLogoPaths(supabase: ServerSupabase, userId: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET_LOGOS).list(userId, { limit: 50 })
  if (error || !data?.length) return []
  return data
    .filter((f) => f.name && f.metadata !== null)
    .map((f) => `${userId}/${f.name}`)
}

export async function buildUserDataExportZip(userId: string): Promise<Buffer> {
  const supabase = await createSupabaseServerClient()
  const zip = new JSZip()
  zip.file('README.txt', README)

  async function tableJson(name: string, table: string) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
    if (error) throw new Error(`${table}: ${error.message}`)
    const rows = (data ?? []) as Record<string, unknown>[]
    zip.file(`${name}.json`, JSON.stringify(rows, null, 2))
    if (rows.length > 0) {
      zip.file(`${name}.csv`, rowsToCsv(rows))
    }
  }

  await tableJson('kunden', 'customers')
  await tableJson('tiere', 'horses')
  await tableJson('termine', 'appointments')
  await tableJson('termin_tier_verknuepfungen', 'appointment_horses')
  await tableJson('hufdokumentationen', 'hoof_records')
  await tableJson('huf_fotos_metadaten', 'hoof_photos')
  await tableJson('dokumentationen', 'documentation_records')
  await tableJson('dokumentationsfotos_metadaten', 'documentation_photos')

  const { data: invoices, error: invErr } = await supabase.from('invoices').select('*').eq('user_id', userId)
  if (invErr) throw new Error(`invoices: ${invErr.message}`)
  const invRows = (invoices ?? []) as Record<string, unknown>[]
  zip.file('rechnungen.json', JSON.stringify(invRows, null, 2))
  if (invRows.length > 0) {
    zip.file('rechnungen.csv', rowsToCsv(invRows))
  }

  const invIds = invRows.map((r) => r.id as string).filter(Boolean)
  if (invIds.length > 0) {
    const { data: items, error: itErr } = await supabase.from('invoice_items').select('*').in('invoice_id', invIds)
    if (itErr) throw new Error(`invoice_items: ${itErr.message}`)
    const itemRows = (items ?? []) as Record<string, unknown>[]
    zip.file('rechnungspositionen.json', JSON.stringify(itemRows, null, 2))
    if (itemRows.length > 0) {
      zip.file('rechnungspositionen.csv', rowsToCsv(itemRows))
    }
  }

  const { data: settings, error: setErr } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (setErr) throw new Error(`user_settings: ${setErr.message}`)
  if (settings) {
    zip.file('einstellungen.json', JSON.stringify(settings, null, 2))
  }

  const missingFiles: string[] = []

  const [{ data: hpPathRows }, { data: dpPathRows }, { data: horseRows }] = await Promise.all([
    supabase.from('hoof_photos').select('file_path').eq('user_id', userId),
    supabase.from('documentation_photos').select('file_path').eq('user_id', userId),
    supabase.from('horses').select('id').eq('user_id', userId),
  ])

  const hoofPaths = collectHoofPhotoStoragePaths({
    userId,
    hoofPhotoPaths: (hpPathRows ?? []).map((r) => r.file_path as string | null),
    documentationPhotoPaths: (dpPathRows ?? []).map((r) => r.file_path as string | null),
    horseIds: (horseRows ?? []).map((r) => r.id as string),
  })

  await appendStorageFilesToZip(zip, supabase, BUCKET_HOOF, hoofPaths, missingFiles)

  const logoPaths = await listUserLogoPaths(supabase, userId)
  await appendStorageFilesToZip(zip, supabase, BUCKET_LOGOS, logoPaths, missingFiles)

  if (missingFiles.length > 0) {
    zip.file('fotos/_fehlende_dateien.txt', missingFiles.join('\n'))
  }

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return Buffer.from(buf)
}
