import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { loadRecordListForHorseView } from '@/lib/documentation/loadRecordListForHorseView'
import WholeBodyPhotoSwitcher from '@/components/photos/WholeBodyPhotoSwitcher'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'
import { deriveAppProfile, animalsNavLabel, animalSingularLabel } from '@/lib/appProfile'
import {
  formatAnimalTypeLabel,
  formatNeuteredLabel,
  formatWeightKgKg,
} from '@/lib/animalTypeDisplay'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDog, faCat, faHorse, faPaw, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { profilePhotoPathFromIntake } from '@/lib/animals/clinicalIntakeTypes'

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
  animal_type?: string | null
  neutered?: string | null
  weight_kg?: number | string | null
  coat_color?: string | null
  chip_id?: string | null
  usage: string | null
  housing: string | null
  hoof_status: string | null
  care_interval: string | null
  special_notes: string | null
  notes: string | null
  customer_id: string | null
  customers: CustomerRelation
  intake?: unknown
}

type HoofRecord = {
  id: string
  horse_id: string
  record_date: string | null
  created_at?: string | null
  updated_at?: string | null
  doc_number?: string | null
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

function formatGermanTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function formatGermanDatetime(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function buildDocNumber(recordId: string, recordDate: string | null): string {
  const year = recordDate ? new Date(recordDate).getFullYear() : new Date().getFullYear()
  const suffix = recordId.replace(/-/g, '').slice(-4).toUpperCase()
  return `DOK-${year}-${suffix}`
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

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  const term = profile.terminology
  const singularLabel = animalSingularLabel(term)

  const { data: horse } = await supabase
    .from('horses')
    .select(`
      id,
      name,
      breed,
      sex,
      birth_year,
      animal_type,
      neutered,
      weight_kg,
      coat_color,
      chip_id,
      usage,
      housing,
      hoof_status,
      care_interval,
      special_notes,
      notes,
      intake,
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
          <h1 className="text-xl font-semibold text-red-700">{singularLabel} nicht gefunden</h1>
        </div>
      </main>
    )
  }

  const animalType = (horse.animal_type ?? '').toString().trim()
  const headerIcon =
    term === 'pferd'
      ? faHorse
      : animalType === 'dog'
        ? faDog
        : animalType === 'cat'
          ? faCat
          : animalType === 'horse' || !animalType
            ? faHorse
            : animalType === 'small'
              ? faPaw
              : animalType === 'other'
                ? faWandMagicSparkles
                : faPaw

  const owner = relationOwner(horse.customers)
  const nowIso = new Date().toISOString()

  // Nächster Termin: über appointment_horses (Pferde sind über Verknüpfungstabelle zugeordnet)
  const { data: aptLinks } = await supabase
    .from('appointment_horses')
    .select('appointment_id')
    .eq('horse_id', id)
    .eq('user_id', user.id)
  const aptIds = [...new Set((aptLinks ?? []).map((l) => l.appointment_id))]
  let nextAppointment: string | null = null
  if (aptIds.length > 0) {
    const { data: nextApts } = await supabase
      .from('appointments')
      .select('appointment_date')
      .eq('user_id', user.id)
      .in('id', aptIds)
      .gte('appointment_date', nowIso)
      .order('appointment_date', { ascending: true })
      .limit(1)
    nextAppointment = nextApts?.[0]?.appointment_date || null
  }

  // Letzte Bearbeitung: Datum des letzten vergangenen Termins (nicht Dokumentation)
  let lastTreatment: string | null = null
  if (aptIds.length > 0) {
    const { data: lastApts } = await supabase
      .from('appointments')
      .select('appointment_date')
      .eq('user_id', user.id)
      .in('id', aptIds)
      .lte('appointment_date', nowIso)
      .order('appointment_date', { ascending: false })
      .limit(1)
    lastTreatment = lastApts?.[0]?.appointment_date || null
  }

  const { recordRows, wholeBodyPhotoSources, latestRecordId } = await loadRecordListForHorseView(
    supabase,
    user.id,
    id
  )

  const age = getAgeFromBirthYear(horse.birth_year)

  let wholeBodyPhotos: { id: string; imageUrl: string; label: string }[] = []
  if (wholeBodyPhotoSources.length > 0) {
    const withUrls = await Promise.all(
      wholeBodyPhotoSources.map(async (p) => {
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
    wholeBodyPhotos = withUrls.filter(
      (x): x is { id: string; imageUrl: string; label: string } => x != null
    )
    wholeBodyPhotos.sort(
      (a, b) => (a.label.includes('links') ? 0 : 1) - (b.label.includes('links') ? 0 : 1)
    )
  }

  const profilePhotoPath = profilePhotoPathFromIntake(horse.intake)
  let profilePhotoSignedUrl: string | null = null
  if (profilePhotoPath) {
    const { data: profileSigned } = await supabase.storage
      .from('hoof-photos')
      .createSignedUrl(profilePhotoPath, 60 * 60)
    profilePhotoSignedUrl = profileSigned?.signedUrl ?? null
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/animals" className="text-[#52b788] hover:underline">
          {animalsNavLabel(term)}
        </Link>
        <span>›</span>
        <span className="text-[#6B7280]">{horse.name || singularLabel}</span>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[#edf3ef] text-[#154226]">
            <FontAwesomeIcon icon={headerIcon} className="h-7 w-7" />
          </div>

          <div>
            <h1 className="dashboard-serif text-[26px] font-medium tracking-[-0.02em] text-[#1B1F23]">
              {horse.name || singularLabel}
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
            href={`/animals/${horse.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-[18px] py-[10px] text-[13px] font-medium text-[#1B1F23] shadow-sm hover:border-[#9CA3AF]"
          >
            <i className="bi bi-pencil-square text-[15px]" />
            Bearbeiten
          </Link>

          <Link
            href={`/animals/${horse.id}/records/new`}
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
            href={`/animals/${horse.id}#dokumentationen`}
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
              <Link href={`/animals/${horse.id}/edit`} className="text-[13px] font-medium text-[#52b788] hover:underline">
                Bearbeiten
              </Link>
            </div>

            <div className="grid gap-[18px] px-[22px] py-[22px] md:grid-cols-2 xl:grid-cols-3">
              {term === 'tier' ? (
                <>
                  <InfoItem label="Name" value={horse.name || '-'} />
                  <InfoItem label="Tierart" value={formatAnimalTypeLabel(horse.animal_type)} />
                  <InfoItem label="Rasse" value={horse.breed || '-'} />
                  <InfoItem label="Geschlecht" value={horse.sex || '-'} />
                  <InfoItem label="Kastriert" value={formatNeuteredLabel(horse.neutered)} />
                  <InfoItem
                    label="Geburtsjahr"
                    value={
                      horse.birth_year
                        ? `${horse.birth_year}${age ? ` (${age} Jahre)` : ''}`
                        : '-'
                    }
                  />
                  <InfoItem label="Gewicht" value={formatWeightKgKg(horse.weight_kg)} />
                  <InfoItem label="Fellfarbe" value={horse.coat_color?.trim() || '-'} />
                  <InfoItem
                    label="Chip-Nr. / Tätowierung"
                    value={horse.chip_id?.trim() || '-'}
                  />
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </section>

          <section id="dokumentationen" className="huf-card mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E2DC] px-[22px] py-[18px]">
              <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                Dokumentationen
              </h2>
              <div className="flex flex-wrap items-center gap-4">
                {profile.isHufbearbeiter && recordRows.length >= 2 && (
                  <span className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/animals/${horse.id}/records/compare`}
                      className="text-[13px] font-medium text-[#52b788] hover:underline"
                    >
                      Fotovergleich
                    </Link>
                    <span className="text-[#E5E2DC]" aria-hidden>
                      ·
                    </span>
                    <Link
                      href={`/animals/${horse.id}/records/compare/mobile`}
                      className="text-[13px] font-medium text-[#52b788] hover:underline"
                    >
                      App
                    </Link>
                  </span>
                )}
                <Link href={`/animals/${horse.id}/records/new`} className="text-[13px] font-medium text-[#52b788] hover:underline">
                  Neue Dokumentation →
                </Link>
              </div>
            </div>

            <div className="huf-table-wrap">
              <table className="huf-table">
                <thead>
                  <tr>
                    <th>Datum und Uhrzeit</th>
                    <th>Fotos</th>
                    <th>Geändert</th>
                    <th className="text-right">Aktion</th>
                  </tr>
                </thead>

                <tbody>
                  {recordRows.map(({ record, photoCount }) => (
                    <tr key={record.id}>
                      <td className="font-bold text-[#1B1F23]">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatGermanDate(record.record_date)}</span>
                          <span className="text-[12px] font-normal text-[#6B7280]">
                            {[
                              record.created_at && formatGermanTime(record.created_at),
                              buildDocNumber(record.id, record.record_date),
                            ].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[#1B1F23]">
                          <i className="bi bi-images text-[14px]" />
                          {photoCount}
                        </span>
                      </td>

                      <td className="text-[13px] text-[#6B7280]">
                        {record.updated_at && record.created_at && record.updated_at !== record.created_at
                          ? formatGermanDatetime(record.updated_at)
                          : '–'}
                      </td>

                      <td>
                        <div className="flex justify-end">
                          <Link
                            href={`/animals/${horse.id}/records/${record.id}`}
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
                      <td colSpan={4} className="py-10 text-center text-sm text-[#6B7280]">
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
          {profilePhotoSignedUrl && (
            <section className="huf-card mb-6 overflow-hidden">
              <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Tierfoto
                </h2>
              </div>
              <div className="p-[22px]">
                {/* Signed URL aus Storage — next/image ohne Remote-Pattern */}
                <img
                  src={profilePhotoSignedUrl}
                  alt={horse.name ? `Tierfoto ${horse.name}` : 'Tierfoto'}
                  className="mx-auto max-h-[320px] w-full max-w-md rounded-xl object-contain object-center"
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

          {!profile.isHufbearbeiter && (
            <section className="huf-card mb-6">
              <div className="border-b border-[#E5E2DC] px-[22px] py-[18px]">
                <h2 className="dashboard-serif text-[16px] font-medium tracking-[-0.01em] text-[#1B1F23]">
                  Erstanamnese
                </h2>
              </div>
              <div className="px-[22px] py-[22px]">
                <p className="mb-4 text-[13px] leading-relaxed text-[#6B7280]">
                  Fachliche Erstaufnahme: allgemeine Anamnese, Bewegungsapparat und Vorgeschichte. Interne Notizen sind
                  davon getrennt und findest du unter Bearbeiten.
                </p>
                <Link
                  href={`/animals/${horse.id}/erstanamnese`}
                  className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-[18px] py-[10px] text-[13px] font-medium text-white shadow-sm hover:bg-[#0f301b]"
                >
                  <i className="bi bi-clipboard2-pulse text-[15px]" />
                  Erstanamnese öffnen
                </Link>
              </div>
            </section>
          )}

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
                  dateLabel={
                    latestRecordId && recordRows[0]?.record.record_date
                      ? formatGermanDate(recordRows[0].record.record_date)
                      : undefined
                  }
                />
              </div>
            </section>
          )}

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
        </div>
      </div>
    </main>
  )
}