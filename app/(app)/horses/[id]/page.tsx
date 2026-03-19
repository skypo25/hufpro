import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import DeleteHorseForm from './DeleteHorseForm'
import WholeBodyPhotoSwitcher from '@/components/photos/WholeBodyPhotoSwitcher'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'

function HorseIconSvg() {
  return (
    <svg width="25" height="22" viewBox="0 0 576 512" fill="currentColor" className="max-w-[25px] shrink-0" aria-hidden>
      <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
    </svg>
  )
}

type HorsePageProps = {
  params: Promise<{ id: string }>
}

type CustomerRelation =
  | {
      id: string
      name: string | null
      phone: string | null
    }
  | {
      id: string
      name: string | null
      phone: string | null
    }[]
  | null

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  usage: string | null
  housing: string | null
  hoof_status: string | null
  care_interval: string | null
  special_notes: string | null
  notes: string | null
  customer_id: string | null
  customers: CustomerRelation
}

type HoofRecord = {
  id: string
  horse_id: string
  record_date: string | null
}

type HoofPhoto = {
  id: string
  hoof_record_id: string | null
  photo_type?: string | null
}

type HoofPhotoWithPath = {
  id: string
  file_path: string | null
  photo_type: string | null
}

type Appointment = {
  id: string
  horse_id: string | null
  appointment_date: string | null
}

type RecordRow = {
  record: HoofRecord
  photoCount: number
}

async function deleteHorse(horseId: string) {
  'use server'

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: records } = await supabase
    .from('hoof_records')
    .select('id')
    .eq('horse_id', horseId)
    .eq('user_id', user.id)

  const recordIds = (records || []).map((r) => r.id)

  if (recordIds.length > 0) {
    const { data: photos } = await supabase
      .from('hoof_photos')
      .select('file_path')
      .eq('user_id', user.id)
      .in('hoof_record_id', recordIds)

    const filePaths = (photos || [])
      .map((photo) => photo.file_path)
      .filter((path): path is string => Boolean(path))

    if (filePaths.length > 0) {
      await supabase.storage.from('hoof-photos').remove(filePaths)
    }

    await supabase
      .from('hoof_photos')
      .delete()
      .eq('user_id', user.id)
      .in('hoof_record_id', recordIds)

    await supabase
      .from('hoof_records')
      .delete()
      .eq('horse_id', horseId)
      .eq('user_id', user.id)
  }

  await supabase
    .from('appointments')
    .delete()
    .eq('horse_id', horseId)
    .eq('user_id', user.id)

  const { error } = await supabase
    .from('horses')
    .delete()
    .eq('id', horseId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`Fehler beim Löschen des Pferdes: ${error.message}`)
  }

  redirect('/horses')
}

function formatGermanDate(dateString: string | null) {
  if (!dateString) return '-'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getAgeFromBirthYear(birthYear: number | null) {
  if (!birthYear) return null
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  if (age < 0 || age > 60) return null
  return age
}

function relationOwner(value: CustomerRelation) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function joinMeta(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' · ')
}

function InfoItem({
  label,
  value,
  accent = false,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
        {label}
      </div>
      <div className={accent ? 'text-[14px] font-medium text-[#52b788]' : 'text-[14px] font-medium text-[#1B1F23]'}>
        {value || '-'}
      </div>
    </div>
  )
}

export default async function HorseDetailPage({ params }: HorsePageProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params

  const { data: horse } = await supabase
    .from('horses')
    .select(`
      id,
      name,
      breed,
      sex,
      birth_year,
      usage,
      housing,
      hoof_status,
      care_interval,
      special_notes,
      notes,
      customer_id,
      customers (
        id,
        name,
        phone
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single<Horse>()

  if (!horse) {
    return (
      <main className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Pferd nicht gefunden</h1>
        </div>
      </main>
    )
  }

  const owner = relationOwner(horse.customers)
  const nowIso = new Date().toISOString()

  const { data: nextAppointments } = await supabase
    .from('appointments')
    .select('id, horse_id, appointment_date')
    .eq('horse_id', id)
    .eq('user_id', user.id)
    .gte('appointment_date', nowIso)
    .order('appointment_date', { ascending: true })
    .limit(1)
    .returns<Appointment[]>()

  const nextAppointment = nextAppointments?.[0]?.appointment_date || null

  const { data: lastRecords } = await supabase
    .from('hoof_records')
    .select('id, horse_id, record_date')
    .eq('horse_id', id)
    .eq('user_id', user.id)
    .order('record_date', { ascending: false })
    .limit(1)
    .returns<HoofRecord[]>()

  const lastTreatment = lastRecords?.[0]?.record_date || null

  const { data: records } = await supabase
    .from('hoof_records')
    .select('id, horse_id, record_date')
    .eq('horse_id', id)
    .eq('user_id', user.id)
    .order('record_date', { ascending: false })
    .returns<HoofRecord[]>()

  const recordRows: RecordRow[] = await Promise.all(
    (records || []).map(async (record) => {
      const { data: photos } = await supabase
        .from('hoof_photos')
        .select('id, photo_type')
        .eq('hoof_record_id', record.id)
        .eq('user_id', user.id)
        .returns<HoofPhoto[]>()

      const count =
        photos?.filter(
          (p) => p.photo_type !== 'whole_left' && p.photo_type !== 'whole_right'
        ).length ?? 0
      return {
        record,
        photoCount: count,
      }
    })
  )

  const deleteHorseForId = deleteHorse.bind(null, id)
  const age = getAgeFromBirthYear(horse.birth_year)

  let wholeBodyPhotos: { id: string; imageUrl: string; label: string }[] = []
  const latestRecordId = records?.[0]?.id
  if (latestRecordId) {
    const { data: wholePhotos } = await supabase
      .from('hoof_photos')
      .select('id, file_path, photo_type')
      .eq('hoof_record_id', latestRecordId)
      .eq('user_id', user.id)
      .in('photo_type', ['whole_left', 'whole_right'])
      .returns<HoofPhotoWithPath[]>()
    if (wholePhotos?.length) {
      const withUrls = await Promise.all(
        (wholePhotos || []).map(async (p) => {
          if (!p.file_path) return null
          const { data: signed } = await supabase.storage
            .from('hoof-photos')
            .createSignedUrl(p.file_path, 60 * 60)
          if (!signed?.signedUrl) return null
          return {
            id: p.id,
            imageUrl: signed.signedUrl,
            label: (p.photo_type && SLOT_LABELS[p.photo_type]) ?? p.photo_type ?? 'Ganzkörper',
          }
        })
      )
      wholeBodyPhotos = withUrls.filter((x): x is { id: string; imageUrl: string; label: string } => x != null)
      wholeBodyPhotos.sort((a, b) => (a.label.includes('links') ? 0 : 1) - (b.label.includes('links') ? 0 : 1))
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/horses" className="text-[#52b788] hover:underline">
          Pferde
        </Link>
        <span>›</span>
        <span className="text-[#6B7280]">{horse.name || 'Pferd'}</span>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[#edf3ef] text-[#52b788]">
            <HorseIconSvg />
          </div>

          <div>
            <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
              {horse.name || 'Pferd'}
            </h1>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[#6B7280]">
              <span>
                {joinMeta([
                  horse.breed,
                  horse.sex,
                  horse.birth_year
                    ? `geb. ${horse.birth_year}${age ? ` (${age} J.)` : ''}`
                    : null,
                ]) || '-'}
              </span>

              {owner?.name && (
                <span className="inline-flex items-center gap-1.5">
                  <i className="bi bi-person text-[14px]" />
                  <Link href={`/customers/${owner.id}`} className="text-[#52b788] hover:underline">
                    {owner.name}
                  </Link>
                </span>
              )}

              <span>{joinMeta([horse.usage, horse.hoof_status]) || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href={`/horses/${horse.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-[18px] py-[10px] text-[13px] font-medium text-[#1B1F23] shadow-sm hover:border-[#9CA3AF]"
          >
            <i className="bi bi-pencil-square text-[15px]" />
            Bearbeiten
          </Link>

          <Link
            href={`/horses/${horse.id}/records/new`}
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-[18px] py-[10px] text-[13px] font-medium text-white shadow-sm hover:bg-[#0f301b]"
          >
            <i className="bi bi-plus-square-fill text-[15px]" />
            Dokumentation
          </Link>
        </div>
      </div>

      <div className="border-b-2 border-[#E5E2DC]">
        <div className="flex flex-wrap gap-0">
          <span className="border-b-2 border-[#52b788] px-5 py-3 text-[14px] font-medium text-[#52b788]">
            Übersicht
          </span>
          <Link
            href={`/horses/${horse.id}#dokumentationen`}
            className="border-b-2 border-transparent px-5 py-3 text-[14px] font-medium text-[#6B7280] hover:text-[#1B1F23]"
          >
            Alle Dokumentationen
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          <section className="huf-card mb-6">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                Stammdaten
              </h2>
              <Link href={`/horses/${horse.id}/edit`} className="text-[13px] font-medium text-[#52b788] hover:underline">
                Bearbeiten
              </Link>
            </div>

            <div className="grid gap-[18px] px-[22px] py-[22px] md:grid-cols-2 xl:grid-cols-3">
              <InfoItem label="Name" value={horse.name || '-'} />
              <InfoItem label="Rasse" value={horse.breed || '-'} />
              <InfoItem label="Geschlecht" value={horse.sex || '-'} />

              <InfoItem
                label="Geburtsjahr"
                value={
                  horse.birth_year
                    ? `${horse.birth_year}${age ? ` (${age} Jahre)` : ''}`
                    : '-'
                }
              />

              <InfoItem
                label="Besitzerin / Besitzer"
                accent
                value={
                  owner?.name ? (
                    <Link href={`/customers/${owner.id}`} className="hover:underline">
                      {owner.name}
                    </Link>
                  ) : (
                    '-'
                  )
                }
              />

              <InfoItem label="Nutzung" value={horse.usage || '-'} />
              <InfoItem label="Haltung" value={horse.housing || '-'} />
              <InfoItem label="Hufstatus / Beschlag" value={horse.hoof_status || '-'} />
              <InfoItem label="Bearbeitungsintervall" value={horse.care_interval || '-'} />
            </div>
          </section>

          <section id="dokumentationen" className="huf-card mb-6">
            <div className="flex items-center justify-between border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                Dokumentationen
              </h2>
              <Link href={`/horses/${horse.id}/records/new`} className="text-[13px] font-medium text-[#52b788] hover:underline">
                Neue Dokumentation →
              </Link>
            </div>

            <div className="huf-table-wrap">
              <table className="huf-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Fotos</th>
                    <th className="text-right">Aktion</th>
                  </tr>
                </thead>

                <tbody>
                  {recordRows.map(({ record, photoCount }) => (
                    <tr key={record.id}>
                      <td className="font-bold text-[#1B1F23]">
                        {formatGermanDate(record.record_date)}
                      </td>

                      <td>
                        <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[#1B1F23]">
                          <i className="bi bi-images text-[14px]" />
                          {photoCount}
                        </span>
                      </td>

                      <td>
                        <div className="flex justify-end">
                          <Link
                            href={`/horses/${horse.id}/records/${record.id}`}
                            className="group inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf3ef] text-[#52b788] transition-colors hover:bg-[#52b788]"
                            aria-label="Dokumentation öffnen"
                          >
                            <i className="bi bi-file-earmark-richtext-fill text-[18px] group-hover:text-white" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {recordRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-sm text-[#6B7280]">
                        Noch keine Dokumentationen vorhanden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div>
          {wholeBodyPhotos.length > 0 && (
            <section className="huf-card mb-6">
              <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Ganzkörperfotos
                </h2>
              </div>
              <div className="p-[22px]">
                <WholeBodyPhotoSwitcher
                  items={wholeBodyPhotos}
                  dateLabel={latestRecordId && records?.[0]?.record_date ? formatGermanDate(records[0].record_date) : undefined}
                />
              </div>
            </section>
          )}

          <section className="huf-card huf-card--accent-left mb-6">
            <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                Behandlungsstatus
              </h2>
            </div>

            <div className="px-[22px] py-[22px]">
              <div className="mb-4 flex justify-between gap-4">
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                    Letzte Bearbeitung
                  </div>
                  <div className="dashboard-serif text-[18px] font-medium text-[#1B1F23]">
                    {formatGermanDate(lastTreatment)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                    Nächster Termin
                  </div>
                  <div className="dashboard-serif text-[18px] font-medium text-[#52b788]">
                    {formatGermanDate(nextAppointment)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-[#edf3ef] px-[14px] py-3 text-[13px] leading-[1.5]">
                <strong className="text-[#0f301b]">Bearbeitungsintervall:</strong>{' '}
                <span className="text-[#1B1F23]">{horse.care_interval || 'nicht hinterlegt'}</span>
                <br />
                <span className="text-[#6B7280]">
                  {nextAppointment
                    ? `Nächster geplanter Termin am ${formatGermanDate(nextAppointment)}`
                    : 'Derzeit ist noch kein nächster Termin geplant.'}
                </span>
              </div>
            </div>
          </section>

          {(horse.special_notes || horse.notes) && (
            <section className="huf-card mb-6">
              <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Besonderheiten
                </h2>
              </div>

              <div className="space-y-5 px-[22px] py-[22px]">
                {horse.special_notes && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                      Besonderheiten / Hinweise
                    </div>
                    <div className="text-[13px] leading-[1.7] text-[#6B7280]">
                      {horse.special_notes}
                    </div>
                  </div>
                )}

                {horse.notes && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                      Allgemeine Notizen
                    </div>
                    <div className="text-[13px] leading-[1.7] text-[#6B7280]">
                      {horse.notes}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="huf-card">
            <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                Aktionen
              </h2>
            </div>

            <div className="px-[22px] py-[22px]">
              <DeleteHorseForm action={deleteHorseForId} />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}