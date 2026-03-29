import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  formatGermanDate,
  formatShortGermanDate,
  getInitials,
} from '@/lib/format'
import { getCurrentWeekRange } from '@/lib/date'
import { pickPrimaryStallHorse, stallDisplayLabel } from '@/lib/nav/horseStableAddress'
import {
  formatCustomerAnimalsSummary,
  formatGenericAnimalCount,
} from '@/lib/animalTypeDisplay'
import { deriveAppProfile, searchCustomersPlaceholder } from '@/lib/appProfile'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import CustomersStatsCards from '@/components/customers/CustomersStatsCards'
import CustomersCardsAnimated from '@/components/customers/CustomersCardsAnimated'

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string
    sort?: string
    view?: string
    page?: string
    perPage?: string
  }>
}

function buildPageHref({
  q,
  sort,
  view,
  page,
  perPage,
}: {
  q: string
  sort: string
  view: string
  page: number
  perPage: number
}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (sort) params.set('sort', sort)
  // Default ist "cards" (wenn view fehlt). Für Listenansicht muss der Queryparam gesetzt werden.
  if (view === 'list') params.set('view', 'list')
  if (page > 1) params.set('page', String(page))
  if (perPage !== 10) params.set('perPage', String(perPage))
  const query = params.toString()
  return `/customers${query ? `?${query}` : ''}`
}

type Customer = {
  id: string
  customer_number?: number | null
  name: string | null
  first_name?: string | null
  last_name?: string | null
  phone: string | null
  email: string | null
  city: string | null
  created_at?: string | null
}

type Horse = {
  id: string
  name: string | null
  customer_id: string | null
  animal_type?: string | null
  stable_name?: string | null
  stable_city?: string | null
  stable_street?: string | null
  stable_zip?: string | null
}

type Appointment = {
  id: string
  customer_id: string | null
  appointment_date: string | null
}

type AppointmentHorse = {
  appointment_id: string
  horse_id: string
}

type CustomerRow = {
  customer: Customer
  locationLine: string
  horseCount: number
  animalsSummary: string
  horseNames: string[]
  nextAppointment: string | null
  nextAppointmentHorseCount: number
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
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

  const { q, sort, view, page, perPage } = await searchParams
  const searchQuery = q?.trim() || ''
  const currentSort = sort || 'name_asc'
  const currentView = view === 'list' ? 'list' : 'cards'

  const currentPerPageRaw = Number(perPage || '10')
  const currentPerPage = [10, 20, 50].includes(currentPerPageRaw)
    ? currentPerPageRaw
    : 10

  const currentPageRaw = Number(page || '1')
  const currentPage = Number.isFinite(currentPageRaw) && currentPageRaw > 0
    ? currentPageRaw
    : 1

  let customerIdsFromSearch: string[] = []
  let customerIdsFromHorses: string[] = []

  if (searchQuery) {
    const textMatchQuery = supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .or(
        [
          `name.ilike.%${searchQuery}%`,
          `first_name.ilike.%${searchQuery}%`,
          `last_name.ilike.%${searchQuery}%`,
          `city.ilike.%${searchQuery}%`,
          `street.ilike.%${searchQuery}%`,
          `email.ilike.%${searchQuery}%`,
          `phone.ilike.%${searchQuery}%`,
          ...(Number.isInteger(Number(searchQuery)) ? [`customer_number.eq.${Number(searchQuery)}`] : []),
        ].join(',')
      )
    const { data: textMatch } = await textMatchQuery.returns<{ id: string }[]>()
    customerIdsFromSearch = (textMatch || []).map((r) => r.id)

    const { data: horsesMatch } = await supabase
      .from('horses')
      .select('customer_id')
      .eq('user_id', user.id)
      .not('customer_id', 'is', null)
      .or(
        `name.ilike.%${searchQuery}%,stable_name.ilike.%${searchQuery}%,stable_city.ilike.%${searchQuery}%,breed.ilike.%${searchQuery}%`
      )
      .returns<{ customer_id: string | null }[]>()
    customerIdsFromHorses = (horsesMatch || [])
      .map((r) => r.customer_id)
      .filter((id): id is string => Boolean(id))
  }

  const allFilteredIds =
    searchQuery.length > 0
      ? [...new Set([...customerIdsFromSearch, ...customerIdsFromHorses])]
      : null

  let query = supabase
    .from('customers')
    .select(
      'id, customer_number, name, first_name, last_name, phone, email, city, created_at'
    )
    .eq('user_id', user.id)

  if (allFilteredIds !== null) {
    if (allFilteredIds.length === 0) {
      query = query.eq('id', '__none__')
    } else {
      query = query.in('id', allFilteredIds)
    }
  }

  const { data: customers, error } = await query.returns<Customer[]>()

  if (error) {
    return (
      <main className="space-y-4">
        <EmptyState
          title="Fehler"
          description={`Kunden konnten nicht geladen werden: ${error.message}`}
          className="border-red-200 bg-red-50"
        />
      </main>
    )
  }

  const customerIds = (customers || []).map((customer) => customer.id)
  const nowIso = new Date().toISOString()

  let horses: Horse[] = []
  let appointments: Appointment[] = []
  let appointmentHorseRows: AppointmentHorse[] = []

  if (customerIds.length > 0) {
    const { data: horseData } = await supabase
      .from('horses')
      .select('id, name, customer_id, animal_type, stable_name, stable_city, stable_street, stable_zip')
      .eq('user_id', user.id)
      .in('customer_id', customerIds)
      .returns<Horse[]>()

    horses = horseData || []

    const { data: appointmentData } = await supabase
      .from('appointments')
      .select('id, customer_id, appointment_date')
      .eq('user_id', user.id)
      .in('customer_id', customerIds)
      .gte('appointment_date', nowIso)
      .order('appointment_date', { ascending: true })
      .returns<Appointment[]>()

    appointments = appointmentData || []

    const appointmentIds = appointments.map((appointment) => appointment.id)

    if (appointmentIds.length > 0) {
      const { data: linkData } = await supabase
        .from('appointment_horses')
        .select('appointment_id, horse_id')
        .eq('user_id', user.id)
        .in('appointment_id', appointmentIds)
        .returns<AppointmentHorse[]>()

      appointmentHorseRows = linkData || []
    }
  }

  const horsesByCustomer = new Map<string, Horse[]>()

  for (const horse of horses) {
    if (!horse.customer_id) continue
    const existing = horsesByCustomer.get(horse.customer_id) || []
    horsesByCustomer.set(horse.customer_id, [...existing, horse])
  }

  const horseCountByAppointment = new Map<string, number>()

  for (const row of appointmentHorseRows) {
    horseCountByAppointment.set(
      row.appointment_id,
      (horseCountByAppointment.get(row.appointment_id) || 0) + 1
    )
  }

  const nextAppointmentByCustomer = new Map<
    string,
    { date: string; horseCount: number }
  >()

  for (const appointment of appointments) {
    if (!appointment.customer_id || !appointment.appointment_date) continue

    if (!nextAppointmentByCustomer.has(appointment.customer_id)) {
      nextAppointmentByCustomer.set(appointment.customer_id, {
        date: appointment.appointment_date,
        horseCount: horseCountByAppointment.get(appointment.id) || 0,
      })
    }
  }

  const rows: CustomerRow[] = (customers || []).map((customer) => {
    const customerHorses = horsesByCustomer.get(customer.id) || []
    const next = nextAppointmentByCustomer.get(customer.id)
    const stallHorse = pickPrimaryStallHorse(customerHorses)
    const locationLine =
      stallDisplayLabel(stallHorse ?? {}, customer.city) || customer.city || '-'

    return {
      customer,
      locationLine,
      horseCount: customerHorses.length,
      animalsSummary: formatCustomerAnimalsSummary(customerHorses),
      horseNames: customerHorses
        .map((horse) => horse.name)
        .filter((name): name is string => Boolean(name)),
      nextAppointment: next?.date || null,
      nextAppointmentHorseCount: next?.horseCount || 0,
    }
  })

  const sortedRows = [...rows].sort((a, b) => {
    switch (currentSort) {
      case 'name_desc':
        return (b.customer.name || '').localeCompare(a.customer.name || '', 'de')
      case 'next_appointment':
        if (!a.nextAppointment && !b.nextAppointment) return 0
        if (!a.nextAppointment) return 1
        if (!b.nextAppointment) return -1
        return a.nextAppointment.localeCompare(b.nextAppointment)
      case 'horses_desc':
        return b.horseCount - a.horseCount
      case 'newest':
        return (
          new Date(b.customer.created_at || 0).getTime() -
          new Date(a.customer.created_at || 0).getTime()
        )
      default:
        return (a.customer.name || '').localeCompare(b.customer.name || '', 'de')
    }
  })

  const totalRows = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * currentPerPage
  const endIndex = startIndex + currentPerPage
  const pagedRows = sortedRows.slice(startIndex, endIndex)

  const customerCount = rows.length
  const horseCount = horses.length

  const { weekStart, weekEnd } = getCurrentWeekRange()
  const appointmentsThisWeek = appointments.filter((appointment) => {
    if (!appointment.appointment_date) return false
    const appointmentDate = new Date(appointment.appointment_date)
    return appointmentDate >= weekStart && appointmentDate < weekEnd
  }).length

  const avgHorsesPerCustomer =
    customerCount > 0
      ? (horseCount / customerCount).toFixed(1).replace('.', ',')
      : '0,0'

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <PageHeader
        title="Kunden"
        description={`${customerCount} Kunden · ${horseCount} Tiere in Betreuung`}
        actions={
          <Link
            href="/customers/new"
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-[18px] py-[10px] text-[13px] font-medium text-white shadow-sm hover:bg-[#0f301b]"
          >
            <i className="bi bi-person-fill-add text-[15px]" />
            Kunde anlegen
          </Link>
        }
      />

      <CustomersStatsCards
        customerCount={customerCount}
        horseCount={horseCount}
        appointmentsThisWeek={appointmentsThisWeek}
        currentView={currentView}
        avgHorsesPerCustomer={avgHorsesPerCustomer}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <form
            method="get"
            className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center"
          >
            <input type="hidden" name="sort" value={currentSort} />
            <input type="hidden" name="view" value={currentView} />
            <input type="hidden" name="page" value={safePage} />
            <input type="hidden" name="perPage" value={currentPerPage} />

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5">
              <i className="bi bi-search text-[15px] text-[#9CA3AF]" />
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder={searchCustomersPlaceholder(term)}
                className="w-full border-0 bg-transparent text-[14px] text-[#1B1F23] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-[#52b788]"
            >
              Suchen
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="q" value={searchQuery} />
            <input type="hidden" name="view" value={currentView} />
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="perPage" value={currentPerPage} />

            <select
              name="sort"
              defaultValue={currentSort}
              className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2.5 text-[14px] text-[#1B1F23] outline-none"
            >
              <option value="name_asc">Sortieren: Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="next_appointment">Nächster Termin</option>
              <option value="horses_desc">Meiste Tiere</option>
              <option value="newest">Neueste zuerst</option>
            </select>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23]"
            >
              OK
            </button>
          </form>

          <div className="inline-flex overflow-hidden rounded-lg border border-[#E5E2DC]">
            <Link
              href={buildPageHref({
                q: searchQuery,
                sort: currentSort,
                view: 'list',
                page: 1,
                perPage: currentPerPage,
              })}
              className={[
                'px-4 py-2.5 text-[14px] font-medium',
                currentView === 'list'
                  ? 'huf-btn-dark bg-[#52b788] text-white'
                  : 'bg-white text-[#6B7280]',
              ].join(' ')}
            >
              Liste
            </Link>

            <Link
              href={buildPageHref({
                q: searchQuery,
                sort: currentSort,
                view: 'cards',
                page: 1,
                perPage: currentPerPage,
              })}
              className={[
                'border-l border-[#E5E2DC] px-4 py-2.5 text-[14px] font-medium',
                currentView === 'cards'
                  ? 'huf-btn-dark bg-[#52b788] text-white'
                  : 'bg-white text-[#6B7280]',
              ].join(' ')}
            >
              Karten
            </Link>
          </div>
        </div>
      </div>

      {currentView === 'list' ? (
        <div className="huf-card">
          <div className="grid grid-cols-[52px_minmax(0,1fr)_160px_90px_140px_70px] items-center gap-3 border-b-2 border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-[22px] py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] max-[1000px]:grid-cols-[52px_minmax(0,1fr)_80px_140px_70px] max-[1000px]:[&>*:nth-child(4)]:hidden max-[768px]:grid-cols-[42px_minmax(0,1fr)_70px_70px] max-[768px]:[&>*:nth-child(5)]:hidden">
            <div></div>
            <div>Kunde</div>
            <div>Kontakt</div>
            <div>Tiere</div>
            <div>Nächster Termin</div>
            <div></div>
          </div>

          <div>
            {pagedRows.map((row, index) => {
              const location = row.locationLine

              return (
                <div
                  key={row.customer.id}
                  className="relative grid grid-cols-[52px_minmax(0,1fr)_160px_90px_140px_70px] items-center gap-3 border-b border-[#E5E2DC] px-[22px] py-[14px] transition hover:bg-[rgba(21,66,38,0.03)] last:border-b-0 max-[1000px]:grid-cols-[52px_minmax(0,1fr)_80px_140px_70px] max-[1000px]:[&>*:nth-child(4)]:hidden max-[768px]:grid-cols-[42px_minmax(0,1fr)_70px_70px] max-[768px]:[&>*:nth-child(5)]:hidden"
                >
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Kunde ${row.customer.name || ''} öffnen`}
                  />
                  <div
                    className="pointer-events-none flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#154227] text-[12px] font-semibold text-white"
                  >
                    {getInitials(row.customer.name)}
                  </div>

                  <div className="pointer-events-none min-w-0">
                    <div className="block truncate text-[14px] font-semibold text-[#1B1F23]">
                      {row.customer.name || '-'}
                    </div>

                    <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[#6B7280]">
                      <i className="bi bi-geo-alt text-[12px]" />
                      <span className="truncate">{location}</span>
                    </div>
                  </div>

                  <div className="pointer-events-none min-w-0">
                    <div className="truncate text-[13px] tabular-nums text-[#1B1F23]">
                      {row.customer.phone || '-'}
                    </div>
                    <div className="truncate text-[11px] text-[#6B7280]">
                      {row.customer.email || '-'}
                    </div>
                  </div>

                  <div className="pointer-events-none text-[14px] font-semibold text-[#1B1F23]">
                    {row.animalsSummary}
                  </div>

                  <div className="pointer-events-none">
                    {row.nextAppointment ? (
                      <>
                        <div className="text-[13px] font-medium text-[#52b788]">
                          {formatGermanDate(row.nextAppointment)}
                        </div>
                        <div className="text-[11px] text-[#9CA3AF]">
                          {formatGenericAnimalCount(row.nextAppointmentHorseCount)}
                        </div>
                      </>
                    ) : (
                      <div className="text-[13px] italic text-[#9CA3AF]">
                        kein Termin
                      </div>
                    )}
                  </div>

                  <div className="relative z-20 flex justify-end">
                    <Link
                      href={`/appointments/new?customerId=${row.customer.id}`}
                      className="pointer-events-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] hover:border-[#52b788] hover:text-[#52b788]"
                      title="Termin anlegen"
                    >
                      <i className="bi bi-calendar-plus text-[14px]" />
                    </Link>
                  </div>
                </div>
              )
            })}

            {pagedRows.length === 0 && (
              <EmptyState
                description="Keine Kunden gefunden."
                className="rounded-none border-0 shadow-none"
              />
            )}
          </div>
        </div>
      ) : (
        <CustomersCardsAnimated
          rows={pagedRows}
          emptyDescription="Keine Kunden gefunden."
        />
      )}

      {totalRows > currentPerPage ? (
        <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
          <div className="text-[14px] text-[#6B7280]">
            Zeige {startIndex + 1}–{Math.min(endIndex, totalRows)} von {totalRows} Kunden
          </div>

          <div className="flex items-center gap-3">
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="q" value={searchQuery} />
              <input type="hidden" name="sort" value={currentSort} />
              <input type="hidden" name="view" value={currentView} />

              <label className="text-[14px] text-[#6B7280]">pro Seite</label>
              <select
                name="perPage"
                defaultValue={String(currentPerPage)}
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[14px] text-[#1B1F23] outline-none"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>

              <button
                type="submit"
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[14px] font-medium text-[#1B1F23]"
              >
                OK
              </button>
            </form>

            <div className="flex items-center gap-1">
              <Link
                href={buildPageHref({
                  q: searchQuery,
                  sort: currentSort,
                  view: currentView,
                  page: Math.max(1, safePage - 1),
                  perPage: currentPerPage,
                })}
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-[14px]',
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
                      q: searchQuery,
                      sort: currentSort,
                      view: currentView,
                      page: pageNumber,
                      perPage: currentPerPage,
                    })}
                    className={[
                      'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-[14px] font-medium',
                      pageNumber === safePage
                        ? 'huf-btn-dark border-[#52b788] bg-[#52b788] text-white'
                        : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-[#52b788] hover:text-[#52b788]',
                    ].join(' ')}
                  >
                    {pageNumber}
                  </Link>
                )
              })}

              <Link
                href={buildPageHref({
                  q: searchQuery,
                  sort: currentSort,
                  view: currentView,
                  page: Math.min(totalPages, safePage + 1),
                  perPage: currentPerPage,
                })}
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-[14px]',
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
      ) : (
        <div className="pt-2 text-[14px] text-[#6B7280]">
          Zeige {totalRows} von {customerCount} Kunden
        </div>
      )}
    </main>
  )
}