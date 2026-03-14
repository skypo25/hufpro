import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DeleteRecordForm from './DeleteRecordForm'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'
import { parseAnnotationsJson } from '@/lib/photos/annotations'
import DocumentPhotoGrid from '@/components/photos/DocumentPhotoGrid'
import type { DocumentPhotoItem } from '@/components/photos/DocumentPhotoViewer'

type RecordDetailPageProps = {
  params: Promise<{ id: string; recordId: string }>
}

type HoofRecord = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
}

type HoofPhoto = {
  id: string
  file_path: string | null
  photo_type: string | null
  annotations_json?: unknown
  width?: number | null
  height?: number | null
}

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  usage: string | null
  hoof_status: string | null
  care_interval: string | null
  customer_id: string | null
  customers?:
    | { id?: string; name: string | null; stable_name: string | null; city: string | null }
    | { id?: string; name: string | null; stable_name: string | null; city: string | null }[]
    | null
}

function getRelation<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

async function deleteRecord(horseId: string, recordId: string) {
  'use server'
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: photos } = await supabase.from('hoof_photos').select('file_path').eq('hoof_record_id', recordId).eq('user_id', user.id)
  if (photos?.length) {
    const paths = photos.map((p) => p.file_path).filter((path): path is string => Boolean(path))
    if (paths.length) await supabase.storage.from('hoof-photos').remove(paths)
    await supabase.from('hoof_photos').delete().eq('hoof_record_id', recordId).eq('user_id', user.id)
  }
  const { error } = await supabase.from('hoof_records').delete().eq('id', recordId).eq('horse_id', horseId).eq('user_id', user.id)
  if (error) throw new Error(`Fehler beim Löschen: ${error.message}`)
  redirect(`/horses/${horseId}`)
}

function formatGermanDate(dateString: string | null) {
  if (!dateString) return '–'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function formatGermanDateLong(dateString: string | null) {
  if (!dateString) return '–'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

const HOOF_TAGS = [
  { key: 'vl', label: 'VL', name: 'Vorne Links', color: 'bg-[#D97706]' },
  { key: 'vr', label: 'VR', name: 'Vorne Rechts', color: 'bg-[#059669]' },
  { key: 'hl', label: 'HL', name: 'Hinten Links', color: 'bg-[#7C3AED]' },
  { key: 'hr', label: 'HR', name: 'Hinten Rechts', color: 'bg-[#2563EB]' },
] as const

export default async function RecordDetailPage({ params }: RecordDetailPageProps) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: horseId, recordId } = await params

  const { data: horse } = await supabase
    .from('horses')
    .select(`
      id, name, breed, sex, birth_year, usage, hoof_status, care_interval,
      customer_id, customers (id, name, stable_name, city)
    `)
    .eq('id', horseId)
    .eq('user_id', user.id)
    .single<Horse>()

  const { data: record } = await supabase
    .from('hoof_records')
    .select('*')
    .eq('id', recordId)
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .single<HoofRecord>()

  const { data: photos } = await supabase
    .from('hoof_photos')
    .select('id, file_path, photo_type, annotations_json, width, height')
    .eq('hoof_record_id', recordId)
    .eq('user_id', user.id)
    .returns<HoofPhoto[]>()

  if (!horse || !record) {
    return (
      <main className="mx-auto max-w-[1280px] w-full space-y-7">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Dokumentation nicht gefunden</h1>
        </div>
      </main>
    )
  }

  const { data: allRecords } = await supabase
    .from('hoof_records')
    .select('id, record_date')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)
    .order('record_date', { ascending: false })

  const idx = allRecords?.findIndex((r) => r.id === recordId) ?? -1
  const prevRecord = idx >= 0 && idx < (allRecords?.length ?? 0) - 1 ? allRecords?.[idx + 1] : null
  const nextRecord = idx > 0 ? allRecords?.[idx - 1] : null

  const customer = getRelation(horse.customers ?? null)
  const age = horse.birth_year != null ? new Date().getFullYear() - horse.birth_year : null
  const horseMeta = [horse.breed, horse.sex, age != null ? `${age} J.` : null].filter(Boolean).join(', ')
  const deleteRecordForId = deleteRecord.bind(null, horseId, recordId)

  const photoItems: DocumentPhotoItem[] = []
  if (photos?.length) {
    for (const photo of photos) {
      if (!photo.file_path) continue
      const { data: signed } = await supabase.storage
        .from('hoof-photos')
        .createSignedUrl(photo.file_path, 60 * 60)
      if (!signed?.signedUrl) continue
      const annotations = parseAnnotationsJson(photo.annotations_json)
      photoItems.push({
        id: photo.id,
        imageUrl: signed.signedUrl,
        annotations,
        label: (photo.photo_type && SLOT_LABELS[photo.photo_type]) ?? photo.photo_type ?? 'Foto',
        isWholeBody: photo.photo_type === 'whole_left' || photo.photo_type === 'whole_right',
        width: photo.width ?? 400,
        height: photo.height ?? 711,
      })
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#154226] hover:underline">Dashboard</Link>
        <span aria-hidden>›</span>
        <Link href={`/horses/${horseId}`} className="text-[#154226] hover:underline">
          {horse.name || 'Pferd'}
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">
          {horse.name || 'Pferd'} · {formatGermanDate(record.record_date)}
        </span>
      </div>

      {/* Page header */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-flex-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#DCFCE7] text-2xl">
            ✓
          </div>
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-[#1B1F23]">
              Hufdokumentation
            </h1>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#6B7280]">
              <span>{formatGermanDateLong(record.record_date)}</span>
              <span>Pferd: <Link href={`/horses/${horseId}`} className="font-medium text-[#154226] hover:underline">{horse.name || '–'}</Link>{horseMeta ? ` (${horseMeta})` : ''}</span>
              {customer?.name && (
                <span>Kunde: <Link href={customer.id ? `/customers/${customer.id}` : '#'} className="font-medium text-[#154226] hover:underline">{customer.name}</Link></span>
              )}
            </div>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-3.5 py-1.5 text-xs font-semibold text-[#166534]">
              <span aria-hidden>✓</span> Dokumentiert
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/horses/${horseId}/records/${recordId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1B1F23] shadow-sm transition hover:border-[#9CA3AF]"
          >
            <span className="bi bi-pencil-square" aria-hidden /> Bearbeiten
          </Link>
          <a
            href={`/horses/${horseId}/records/${recordId}/pdf`}
            download
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-[#0f301b]"
          >
            <span className="bi bi-file-earmark-pdf" aria-hidden /> PDF exportieren
          </a>
        </div>
      </div>

      {/* Prev / Next */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {prevRecord ? (
          <Link
            href={`/horses/${horseId}/records/${prevRecord.id}`}
            className="flex flex-col rounded-xl border border-[#E5E2DC] bg-white p-4 transition hover:border-[#154226] hover:shadow-md"
          >
            <span className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">← Vorherige Dokumentation</span>
            <span className="font-medium text-[#1B1F23]">{horse.name || 'Pferd'} · {formatGermanDate(prevRecord.record_date)}</span>
          </Link>
        ) : (
          <div className="rounded-xl border border-[#E5E2DC] bg-[#FAFAF9] p-4 text-[#9CA3AF]">
            <span className="text-[11px] font-medium uppercase tracking-wider">← Vorherige Dokumentation</span>
            <span className="mt-1 block text-[13px]">Keine ältere Dokumentation</span>
          </div>
        )}
        {nextRecord ? (
          <Link
            href={`/horses/${horseId}/records/${nextRecord.id}`}
            className="flex flex-col rounded-xl border border-[#E5E2DC] bg-white p-4 text-right transition hover:border-[#154226] hover:shadow-md"
          >
            <span className="mb-1 flex items-center justify-end gap-1 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">Nächste Dokumentation →</span>
            <span className="font-medium text-[#1B1F23]">{horse.name || 'Pferd'} · {formatGermanDate(nextRecord.record_date)}</span>
          </Link>
        ) : (
          <div className="rounded-xl border border-[#E5E2DC] bg-[#FAFAF9] p-4 text-right text-[#9CA3AF]">
            <span className="text-[11px] font-medium uppercase tracking-wider">Nächste Dokumentation →</span>
            <span className="mt-1 block text-[13px]">Keine neuere Dokumentation</span>
          </div>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Behandlungsnotizen */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-5 py-4">
              <h3 className="font-serif text-base font-medium text-[#1B1F23]">Behandlungsnotizen</h3>
              <Link href={`/horses/${horseId}/records/${recordId}/edit`} className="text-[13px] font-medium text-[#154226] hover:underline">Bearbeiten</Link>
            </div>
            <div className="px-5 py-5 text-[14px] leading-relaxed text-[#1B1F23]">
              {record.hoof_condition && (
                <p className="mb-3 whitespace-pre-wrap">{record.hoof_condition}</p>
              )}
              {record.treatment && (
                <p className="mb-3 whitespace-pre-wrap"><strong className="text-[#0f301b]">Empfehlung:</strong><br />{record.treatment}</p>
              )}
              {!record.hoof_condition && !record.treatment && (
                <p className="text-[#9CA3AF]">Noch keine Notizen erfasst. Dokumentation bearbeiten, um Beobachtungen und Empfehlungen einzutragen.</p>
              )}
            </div>
          </div>

          {/* Befund pro Huf */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <h3 className="font-serif text-base font-medium text-[#1B1F23]">Befund pro Huf</h3>
            </div>
            <div className="grid grid-cols-1 border-b border-[#E5E2DC] sm:grid-cols-2">
              {HOOF_TAGS.map((hoof) => (
                <div key={hoof.key} className="border-b border-[#E5E2DC] p-4 [&:nth-last-child(-n+2)]:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 sm:[&:nth-child(4)]:border-r-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white ${hoof.color}`}>{hoof.label}</span>
                    <span className="text-sm font-semibold text-[#1B1F23]">{hoof.name}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[#6B7280]">
                    {record.hoof_condition ? 'Details in den Behandlungsnotizen oben.' : '–'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Fotodokumentation */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-5 py-4">
              <h3 className="font-serif text-base font-medium text-[#1B1F23]">
                Fotodokumentation{photoItems.length > 0 ? ` (${photoItems.length} ${photoItems.length === 1 ? 'Foto' : 'Fotos'})` : ''}
              </h3>
              <Link href={`/horses/${horseId}/records/${recordId}/photos/new`} className="text-[13px] font-medium text-[#154226] hover:underline">Fotos bearbeiten</Link>
            </div>
            <div className="p-5">
              {photoItems.length > 0 ? (
                <>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#6B7280]">Aufnahmen</div>
                  <DocumentPhotoGrid items={photoItems} />
                </>
              ) : (
                <p className="text-[13px] text-[#9CA3AF]">Noch keine Fotos. Über „Fotos bearbeiten“ Fotos hinzufügen.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Termindetails */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <h3 className="font-serif text-base font-medium text-[#1B1F23]">Termindetails</h3>
            </div>
            <div className="divide-y divide-[#E5E2DC]">
              <InfoRow label="Datum" value={formatGermanDateLong(record.record_date)} />
              <InfoRow label="Terminart" value="Hufdokumentation" />
            </div>
          </div>

          {/* Pferd & Kunde */}
          <div className="rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <h3 className="font-serif text-base font-medium text-[#1B1F23]">Pferd & Kunde</h3>
            </div>
            <div className="divide-y divide-[#E5E2DC]">
              <InfoRow label="Pferd" value={horse.name || '–'} link={horse.id ? `/horses/${horse.id}` : undefined} />
              <InfoRow label="Rasse / Alter" value={horseMeta || '–'} />
              <InfoRow label="Nutzung" value={horse.usage || '–'} />
              <InfoRow label="Beschlag" value={horse.hoof_status || '–'} />
              <InfoRow label="Besitzer" value={customer?.name || '–'} link={customer?.id ? `/customers/${customer.id}` : undefined} />
              <InfoRow label="Intervall" value={horse.care_interval || '–'} />
            </div>
          </div>

          {record.notes && (
            <div className="rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] px-5 py-4">
                <h3 className="font-serif text-base font-medium text-[#1B1F23]">Interne Notiz</h3>
                <Link href={`/horses/${horseId}/records/${recordId}/edit`} className="text-[13px] font-medium text-[#154226] hover:underline">Bearbeiten</Link>
              </div>
              <div className="px-5 py-4 text-[14px] leading-relaxed text-[#1B1F23]">
                <p className="whitespace-pre-wrap">{record.notes}</p>
              </div>
            </div>
          )}

          <DeleteRecordForm action={deleteRecordForId} />
        </div>
      </div>

      <div className="mt-8">
        <Link href={`/horses/${horseId}`} className="inline-flex items-center gap-2 rounded-xl border border-[#E5E2DC] px-4 py-2 text-[13px] font-medium text-[#1B1F23] hover:border-[#154226] hover:bg-[#edf3ef]">
          ← Zurück zum Pferd
        </Link>
      </div>
    </main>
  )
}

function InfoRow({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3 text-[13px]">
      <span className="text-[#6B7280]">{label}</span>
      <span className="font-medium text-[#1B1F23] text-right">
        {link ? <Link href={link} className="text-[#154226] hover:underline">{value}</Link> : value}
      </span>
    </div>
  )
}
