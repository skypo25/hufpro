import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  animalSingularLabel,
  animalsEmptyMessage,
  animalsInCareLine,
  animalsNavLabel,
  animalsPaginationLine,
  animalsStatLabel,
  deriveAppProfile,
  horsesLoadErrorDescription,
  newAnimalButtonLabel,
  searchAnimalsPlaceholder,
  statCardAllAnimalsSubtext,
} from '@/lib/appProfile'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { countDocumentationByHorseIds } from '@/lib/documentation/countDocumentationByHorseIds'
import { formatGermanDate, getAgeFromBirthYear } from '@/lib/format'
import { getCurrentWeekRange } from '@/lib/date'
import { animalTypeBadgeClassName, formatAnimalTypeLabel } from '@/lib/animalTypeDisplay'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDog, faCat, faHorse, faPaw, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'

type HorsesPageProps = {
  searchParams: Promise<{
    q?: string
    sort?: string
    page?: string
    perPage?: string
  }>
}

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex?: string | null
  birth_year?: number | null
  animal_type?: string | null
  usage?: string | null
  hoof_status?: string | null
  special_notes?: string | null
  customer_id: string | null
  stable_name?: string | null
  stable_city?: string | null
  stable_street?: string | null
  stable_zip?: string | null
}

type Customer = {
  id: string
  customer_number?: number | null
  name: string | null
  city: string | null
  interval_weeks?: string | null
}

type Appointment = {
  id: string
  appointment_date: string | null
}

type AppointmentHorse = {
  appointment_id: string
  horse_id: string
}

type HorseRow = {
  horse: Horse
  customer: Customer | null
  nextAppointment: string | null
  documentationCount: number
}

const HORSE_TILE_CLASSES = [
  'bg-[#edf3ef]',
  'bg-[#DBEAFE]',
  'bg-[#DCFCE7]',
  'bg-[#EDE9FE]',
  'bg-[#FEF3C7]',
  'bg-[#FCE7F3]',
]

function horseTileClass(index: number) {
  return HORSE_TILE_CLASSES[index % HORSE_TILE_CLASSES.length]
}

function getOwnerLocation(horse: Horse, customer: Customer | null) {
  if (horse.stable_name) return horse.stable_name
  if (horse.stable_city) return horse.stable_city
  return customer?.city || '-'
}

function getHorseMeta(horse: Horse) {
  const parts = [horse.breed, horse.sex].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '-'
}

function getTimeLabel(dateString: string | null) {
  if (!dateString) return ''

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildPageHref({
  q,
  sort,
  page,
  perPage,
}: {
  q: string
  sort: string
  page: number
  perPage: number
}) {
  const params = new URLSearchParams()

  if (q) params.set('q', q)
  if (sort) params.set('sort', sort)
  if (page > 1) params.set('page', String(page))
  if (perPage !== 10) params.set('perPage', String(perPage))

  const query = params.toString()
  return `/animals${query ? `?${query}` : ''}`
}

export default async function HorsesPage({
  searchParams,
}: HorsesPageProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const settings = settingsRow?.settings as Record<string, unknown> | undefined
  const profile = deriveAppProfile(settings?.profession, settings?.animal_focus)
  const term = profile.terminology

  const { q, sort, page, perPage } = await searchParams

  const searchQuery = q?.trim().toLowerCase() || ''
  const currentSort = sort || 'name_asc'

  const currentPerPageRaw = Number(perPage || '10')
  const currentPerPage = [10, 20, 50].includes(currentPerPageRaw)
    ? currentPerPageRaw
    : 10

  const currentPageRaw = Number(page || '1')
  const currentPage = Number.isFinite(currentPageRaw) && currentPageRaw > 0
    ? currentPageRaw
    : 1

  const { data: horses, error } = await supabase
    .from('horses')
    .select('*')
    .eq('user_id', user.id)
    .returns<Horse[]>()

  if (error) {
    return (
      <main className="space-y-4">
        <EmptyState
          title="Fehler"
          description={horsesLoadErrorDescription(term, error.message)}
          className="border-red-200 bg-red-50"
        />
      </main>
    )
  }

  const horseList = horses || []
  const customerIds = [
    ...new Set(
      horseList.map((horse) => horse.customer_id).filter(Boolean)
    ),
  ] as string[]
  const horseIds = horseList.map((horse) => horse.id)

  let customers: Customer[] = []
  let appointmentLinks: AppointmentHorse[] = []
  let appointments: Appointment[] = []

  if (customerIds.length > 0) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, customer_number, name, city, interval_weeks')
      .eq('user_id', user.id)
      .in('id', customerIds)
      .returns<Customer[]>()

    customers = customerData || []
  }

  if (horseIds.length > 0) {
    const { data: linkData } = await supabase
      .from('appointment_horses')
      .select('appointment_id, horse_id')
      .eq('user_id', user.id)
      .in('horse_id', horseIds)
      .returns<AppointmentHorse[]>()

    appointmentLinks = linkData || []

    const appointmentIds = [...new Set(appointmentLinks.map((item) => item.appointment_id))]

    if (appointmentIds.length > 0) {
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('id, appointment_date')
        .eq('user_id', user.id)
        .in('id', appointmentIds)
        .gte('appointment_date', new Date().toISOString())
        .order('appointment_date', { ascending: true })
        .returns<Appointment[]>()

      appointments = appointmentData || []
    }
  }

  let documentationCountByHorse = new Map<string, number>()
  if (horseIds.length > 0) {
    documentationCountByHorse = await countDocumentationByHorseIds(
      supabase,
      user.id,
      horseIds
    )
  }

  const customersById = new Map(customers.map((customer) => [customer.id, customer]))
  const appointmentsById = new Map(appointments.map((appointment) => [appointment.id, appointment]))

  const nextAppointmentByHorse = new Map<string, string>()
  for (const link of appointmentLinks) {
    const appointment = appointmentsById.get(link.appointment_id)
    if (!appointment?.appointment_date) continue

    const existing = nextAppointmentByHorse.get(link.horse_id)
    if (!existing || appointment.appointment_date < existing) {
      nextAppointmentByHorse.set(link.horse_id, appointment.appointment_date)
    }
  }

  let rows: HorseRow[] = horseList.map((horse) => ({
    horse,
    customer: horse.customer_id ? customersById.get(horse.customer_id) || null : null,
    nextAppointment: nextAppointmentByHorse.get(horse.id) || null,
    documentationCount: documentationCountByHorse.get(horse.id) || 0,
  }))

  if (searchQuery) {
    rows = rows.filter((row) => {
      const haystack = [
        row.horse.name,
        row.horse.breed,
        row.horse.sex,
        row.horse.usage,
        row.horse.animal_type,
        formatAnimalTypeLabel(row.horse.animal_type),
        row.customer?.name,
        row.customer?.city,
        row.horse.stable_name,
        row.horse.stable_city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(searchQuery)
    })
  }

  rows = [...rows].sort((a, b) => {
    switch (currentSort) {
      case 'name_desc':
        return (b.horse.name || '').localeCompare(a.horse.name || '', 'de')
      case 'owner_asc':
        return (a.customer?.name || '').localeCompare(b.customer?.name || '', 'de')
      case 'next_appointment':
        if (!a.nextAppointment && !b.nextAppointment) return 0
        if (!a.nextAppointment) return 1
        if (!b.nextAppointment) return -1
        return a.nextAppointment.localeCompare(b.nextAppointment)
      case 'breed':
        return (a.horse.breed || '').localeCompare(b.horse.breed || '', 'de')
      case 'age_asc': {
        const ageA = getAgeFromBirthYear(a.horse.birth_year ?? null) ?? 999
        const ageB = getAgeFromBirthYear(b.horse.birth_year ?? null) ?? 999
        return ageA - ageB
      }
      default:
        return (a.horse.name || '').localeCompare(b.horse.name || '', 'de')
    }
  })

  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * currentPerPage
  const endIndex = startIndex + currentPerPage
  const pagedRows = rows.slice(startIndex, endIndex)

  const horseCount = horseList.length
  const customerCount = customers.length

  const barhufCount = horseList.filter((horse) =>
    (horse.hoof_status || '').toLowerCase().includes('barhuf')
  ).length

  const hoofschutzCount = horseList.filter((horse) => {
    const value = (horse.hoof_status || '').toLowerCase()
    return value.includes('hufschuhe') || value.includes('kunststoff') || value.includes('scoot')
  }).length

  const correctionCount = horseList.filter((horse) => {
    const value = `${horse.hoof_status || ''} ${horse.special_notes || ''}`.toLowerCase()
    return (
      value.includes('korrektur') ||
      value.includes('trachten') ||
      value.includes('sohle') ||
      value.includes('problem')
    )
  }).length

  const intervals = customers
    .map((customer) => customer.interval_weeks)
    .filter(Boolean)
    .map((value) => Number(String(value).replace(/[^\d.,]/g, '').replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0)

  const avgInterval =
    intervals.length > 0
      ? (intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
          .toFixed(1)
          .replace('.', ',')
      : '-'

  const dogsCount = horseList.filter((a) => (a.animal_type ?? '').trim() === 'dog').length
  const catsCount = horseList.filter((a) => (a.animal_type ?? '').trim() === 'cat').length
  const smallCount = horseList.filter((a) => (a.animal_type ?? '').trim() === 'small').length
  const otherCount = horseList.filter((a) => (a.animal_type ?? '').trim() === 'other').length
  // NULL/leer = Pferd (Legacy / Pferde-only Profil)
  const horsesCount = horseList.filter((a) => {
    const t = (a.animal_type ?? '').trim()
    return !t || t === 'horse'
  }).length

  const { weekStart, weekEnd } = getCurrentWeekRange()
  const appointmentsThisWeek = appointments.filter((appointment) => {
    if (!appointment.appointment_date) return false
    const d = new Date(appointment.appointment_date)
    return d >= weekStart && d < weekEnd
  }).length

  const isTierTerm = term === 'tier'
  const listHeaderClass = isTierTerm
    ? 'grid grid-cols-[52px_minmax(0,1.4fr)_120px_1fr_70px_130px_110px_48px] items-center gap-3 border-b-2 border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-[22px] py-[14px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] max-[1200px]:grid-cols-[52px_1.4fr_1fr_130px_110px_48px] max-[1200px]:[&>*:nth-child(3)]:hidden max-[1200px]:[&>*:nth-child(5)]:hidden max-[900px]:grid-cols-[42px_1fr_130px_110px_48px] max-[900px]:[&>*:nth-child(3)]:hidden max-[900px]:[&>*:nth-child(4)]:hidden max-[900px]:[&>*:nth-child(5)]:hidden'
    : 'grid grid-cols-[52px_1.5fr_1fr_110px_70px_130px_110px_48px] items-center gap-3 border-b-2 border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-[22px] py-[14px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] max-[1200px]:grid-cols-[52px_1.5fr_1fr_130px_110px_48px] max-[1200px]:[&>*:nth-child(4)]:hidden max-[1200px]:[&>*:nth-child(5)]:hidden max-[900px]:grid-cols-[42px_1fr_130px_110px_48px] max-[900px]:[&>*:nth-child(3)]:hidden max-[900px]:[&>*:nth-child(4)]:hidden max-[900px]:[&>*:nth-child(5)]:hidden'
  const listRowClass = isTierTerm
    ? 'relative grid grid-cols-[52px_minmax(0,1.4fr)_120px_1fr_70px_130px_110px_48px] items-center gap-3 border-b border-[#E5E2DC] px-[22px] py-[14px] transition hover:bg-[rgba(21,66,38,0.03)] last:border-b-0 max-[1200px]:grid-cols-[52px_1.4fr_1fr_130px_110px_48px] max-[1200px]:[&>*:nth-child(3)]:hidden max-[1200px]:[&>*:nth-child(5)]:hidden max-[900px]:grid-cols-[42px_1fr_130px_110px_48px] max-[900px]:[&>*:nth-child(3)]:hidden max-[900px]:[&>*:nth-child(4)]:hidden max-[900px]:[&>*:nth-child(5)]:hidden'
    : 'relative grid grid-cols-[52px_1.5fr_1fr_110px_70px_130px_110px_48px] items-center gap-3 border-b border-[#E5E2DC] px-[22px] py-[14px] transition hover:bg-[rgba(21,66,38,0.03)] last:border-b-0 max-[1200px]:grid-cols-[52px_1.5fr_1fr_130px_110px_48px] max-[1200px]:[&>*:nth-child(4)]:hidden max-[1200px]:[&>*:nth-child(5)]:hidden max-[900px]:grid-cols-[42px_1fr_130px_110px_48px] max-[900px]:[&>*:nth-child(3)]:hidden max-[900px]:[&>*:nth-child(4)]:hidden max-[900px]:[&>*:nth-child(5)]:hidden'

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <PageHeader
        title={animalsNavLabel(term)}
        description={`${animalsInCareLine(term, horseCount)} · ${customerCount} Kunden`}
        actions={
          <div className="flex gap-2.5">
            <Link
              href="#"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-[18px] py-[10px] text-[13px] font-medium text-[#1B1F23] shadow-sm hover:border-[#9CA3AF]"
            >
              <i className="bi bi-download text-[14px]" />
              Export
            </Link>

            <Link
              href="/animals/new"
              className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-[18px] py-[10px] text-[13px] font-medium text-white shadow-sm hover:bg-[#0f301b]"
            >
              <i className="bi bi-plus-lg text-[14px]" />
              {newAnimalButtonLabel(term)}
            </Link>
          </div>
        }
      />

      {term === 'pferd' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label={animalsStatLabel(term)}
            value={horseCount}
            subtext={statCardAllAnimalsSubtext(term)}
          />
          <StatCard
            label="Barhuf"
            value={barhufCount}
            subtext="ohne festen Beschlag"
          />
          <StatCard
            label="Hufschutz"
            value={hoofschutzCount}
            subtext="z. B. Hufschuhe"
          />
          <StatCard
            label="In Korrektur"
            value={correctionCount}
            subtext="laut Status / Notiz"
          />
          <StatCard
            label="Ø Intervall"
            value={avgInterval}
            subtext="Wochen"
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Tiere gesamt"
            value={horseCount}
            subtext="alle Tierarten"
          />
          <StatCard
            label="Hunde"
            value={dogsCount}
            subtext="Tierart"
          />
          <StatCard
            label="Katzen"
            value={catsCount}
            subtext="Tierart"
          />
          <StatCard
            label="Pferde"
            value={horsesCount}
            subtext="Tierart"
          />
          <StatCard
            label="Kleintiere"
            value={smallCount}
            subtext="Tierart"
          />
          <StatCard
            label="Sonstige"
            value={otherCount}
            subtext="Tierart"
          />
        </div>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <form
            method="get"
            className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center"
          >
            <input type="hidden" name="sort" value={currentSort} />
            <input type="hidden" name="perPage" value={currentPerPage} />

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#52b788] bg-white px-4 py-2 text-[12px]">
              <i className="bi bi-search text-[14px] text-[#9CA3AF]" />
              <input
                type="text"
                name="q"
                defaultValue={q || ''}
                placeholder={searchAnimalsPlaceholder(term)}
                className="w-full border-0 bg-transparent text-[14px] text-[#1B1F23] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] bg-white px-4 py-2 text-[12px] font-medium text-[#1B1F23] hover:border-[#52b788]"
            >
              Suchen
            </button>
          </form>

          <div className="flex gap-2">
            <span className="rounded-full bg-[#52b788] px-4 py-2 text-[12px] font-medium text-white">
              Alle ({horseCount})
            </span>
            {term === 'pferd' && (
              <>
                <span className="rounded-full border border-[#E5E2DC] bg-white px-4 py-2 text-[12px] font-medium text-[#6B7280]">
                  Barhuf ({barhufCount})
                </span>
                <span className="rounded-full border border-[#E5E2DC] bg-white px-4 py-2 text-[12px] font-medium text-[#6B7280]">
                  Hufschutz ({hoofschutzCount})
                </span>
                <span className="rounded-full border border-[#F59E0B] bg-white px-4 py-2 text-[12px] font-medium text-[#F59E0B]">
                  Korrektur ({correctionCount})
                </span>
              </>
            )}
          </div>
        </div>

        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="q" value={q || ''} />
          <input type="hidden" name="perPage" value={currentPerPage} />

          <select
            name="sort"
            defaultValue={currentSort}
            className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] text-[#1B1F23] outline-none"
          >
            <option value="name_asc">Sortieren: Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="owner_asc">Besitzer A–Z</option>
            <option value="next_appointment">Nächster Termin</option>
            <option value="breed">Rasse</option>
            <option value="age_asc">Alter (jung → alt)</option>
          </select>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] bg-white px-4 py-2 text-[12px] font-medium text-[#1B1F23]"
          >
            OK
          </button>
        </form>
      </div>

      <div className="huf-card">
        <div className={listHeaderClass}>
          <div></div>
          <div>{animalSingularLabel(term)}</div>
          {isTierTerm ? <div>Tierart</div> : null}
          <div>Besitzer / Stall</div>
          {!isTierTerm ? <div>Nutzung</div> : null}
          <div>Alter</div>
          <div>Nächster Termin</div>
          <div>Dokumentationen</div>
          <div></div>
        </div>

        <div>
          {pagedRows.map((row, index) => {
            const age = getAgeFromBirthYear(row.horse.birth_year ?? null)
            const ownerLocation = getOwnerLocation(row.horse, row.customer)
            const globalIndex = startIndex + index
            const animalType = (row.horse.animal_type ?? '').toString().trim()
            const rowIcon =
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

            return (
              <div
                key={row.horse.id}
                className={listRowClass}
              >
                <Link
                  href={`/animals/${row.horse.id}`}
                  className="absolute inset-0 z-0"
                  aria-label={`${animalSingularLabel(term)} ${row.horse.name || ''} öffnen`}
                />

                <div className="pointer-events-none z-10 flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-[10px] bg-[#edf3ef] text-[#154226]">
                  <FontAwesomeIcon icon={rowIcon} className="h-4 w-4" />
                </div>

                <div className="pointer-events-none z-10 min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#1B1F23]">
                    {row.horse.name || '-'}
                  </div>
                  <div className="truncate text-[12px] text-[#6B7280]">
                    {getHorseMeta(row.horse)}
                  </div>
                </div>

                {isTierTerm ? (
                  <div className="pointer-events-none z-10 flex min-w-0 items-center">
                    <span className={`${animalTypeBadgeClassName} truncate`}>
                      {formatAnimalTypeLabel(row.horse.animal_type)}
                    </span>
                  </div>
                ) : null}

                <div className="pointer-events-none z-10 min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[#1B1F23]">
                    {row.customer?.name ?? '-'}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[#9CA3AF]">
                    <i className="bi bi-geo-alt text-[11px]" />
                    <span className="truncate">{ownerLocation}</span>
                  </div>
                </div>

                {!isTierTerm ? (
                  <div className="pointer-events-none z-10 text-[13px] text-[#1B1F23]">
                    {row.horse.usage || '-'}
                  </div>
                ) : null}

                <div className="pointer-events-none z-10 text-[13px] text-[#6B7280]">
                  {age ? `${age} J.` : '-'}
                </div>

                <div className="pointer-events-none z-10">
                  {row.nextAppointment ? (
                    <>
                      <div className="text-[13px] font-medium text-[#52b788]">
                        {formatGermanDate(row.nextAppointment)}
                      </div>
                      <div className="text-[11px] text-[#9CA3AF]">
                        {getTimeLabel(row.nextAppointment)}
                      </div>
                    </>
                  ) : (
                    <div className="text-[13px] italic text-[#9CA3AF]">
                      kein Termin
                    </div>
                  )}
                </div>

                <div
                  className={[
                    'pointer-events-none z-10 flex items-center gap-1.5 text-[13px]',
                    row.documentationCount > 0
                      ? 'font-medium text-[#52b788]'
                      : 'text-[#9CA3AF]',
                  ].join(' ')}
                >
                  <i className="fa-solid fa-file-lines text-[13px]" />
                  {row.documentationCount}
                </div>

                <div className="z-20 flex justify-end">
                  <Link
                    href={`/appointments/new?horseId=${row.horse.id}`}
                    className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E2DC] bg-white text-[#6B7280] transition hover:border-[#52b788] hover:text-[#52b788]"
                    title="Termin anlegen"
                  >
                    <i className="bi bi-calendar-plus text-[14px]" />
                  </Link>
                </div>
              </div>
            )
          })}

          {pagedRows.length === 0 && (
            <div className="px-6 py-12">
              <EmptyState description={animalsEmptyMessage(term)} />
            </div>
          )}
        </div>
      </div>

      {totalRows > currentPerPage && (
        <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
          <div className="text-[13px] text-[#6B7280]">
            {animalsPaginationLine(
              term,
              startIndex + 1,
              Math.min(endIndex, totalRows),
              totalRows
            )}
          </div>

          <div className="flex items-center gap-3">
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="q" value={q || ''} />
              <input type="hidden" name="sort" value={currentSort} />

              <label className="text-[12px] text-[#6B7280]">pro Seite</label>
              <select
                name="perPage"
                defaultValue={String(currentPerPage)}
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] text-[#1B1F23] outline-none"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>

              <button
                type="submit"
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-medium text-[#1B1F23]"
              >
                OK
              </button>
            </form>

            <div className="flex items-center gap-1">
              <Link
                href={buildPageHref({
                  q: q || '',
                  sort: currentSort,
                  page: Math.max(1, safePage - 1),
                  perPage: currentPerPage,
                })}
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-[12px]',
                  safePage === 1
                    ? 'pointer-events-none border-[#E5E2DC] bg-white text-[#9CA3AF] opacity-50'
                    : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-[#52b788] hover:text-[#52b788]',
                ].join(' ')}
              >
                <i className="bi bi-chevron-left" />
              </Link>

              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNumber = index + 1

                return (
                  <Link
                    key={pageNumber}
                    href={buildPageHref({
                      q: q || '',
                      sort: currentSort,
                      page: pageNumber,
                      perPage: currentPerPage,
                    })}
                    className={[
                      'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-[12px] font-medium',
                      pageNumber === safePage
                        ? 'border-[#52b788] bg-[#52b788] text-white'
                        : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-[#52b788] hover:text-[#52b788]',
                    ].join(' ')}
                  >
                    {pageNumber}
                  </Link>
                )
              })}

              <Link
                href={buildPageHref({
                  q: q || '',
                  sort: currentSort,
                  page: Math.min(totalPages, safePage + 1),
                  perPage: currentPerPage,
                })}
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-[12px]',
                  safePage === totalPages
                    ? 'pointer-events-none border-[#E5E2DC] bg-white text-[#9CA3AF] opacity-50'
                    : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-[#52b788] hover:text-[#52b788]',
                ].join(' ')}
              >
                <i className="bi bi-chevron-right" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}