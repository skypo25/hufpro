import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AppPage from '@/components/layout/AppPage'
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

  let filterIds: string[] | null = null

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
    const [{ data: textMatch }, { data: horsesMatch }] = await Promise.all([
      textMatchQuery.returns<{ id: string }[]>(),
      supabase
        .from('horses')
        .select('customer_id')
        .eq('user_id', user.id)
        .not('customer_id', 'is', null)
        .or(
          `name.ilike.%${searchQuery}%,stable_name.ilike.%${searchQuery}%,stable_city.ilike.%${searchQuery}%,breed.ilike.%${searchQuery}%`
        )
        .returns<{ customer_id: string | null }[]>(),
    ])
    filterIds = [
      ...new Set([
        ...(textMatch || []).map((r) => r.id),
        ...(horsesMatch || []).map((r) => r.customer_id).filter((id): id is string => Boolean(id)),
      ]),
    ]
  }

  const customerCols =
    'id, customer_number, name, first_name, last_name, phone, email, city, created_at'
  const dbSortable =
    currentSort === 'name_asc' ||
    currentSort === 'name_desc' ||
    currentSort === 'newest'

  let customers: Customer[] = []
  let totalRows = 0
  let listError: string | null = null

  if (filterIds !== null && filterIds.length === 0) {
    totalRows = 0
    customers = []
  } else if (dbSortable) {
    let safeGuess = currentPage
    let from = (safeGuess - 1) * currentPerPage
    let to = from + currentPerPage - 1

    const build = () => {
      let q = supabase
        .from('customers')
        .select(customerCols, { count: 'exact' })
        .eq('user_id', user.id)
      if (filterIds) q = q.in('id', filterIds)
      if (currentSort === 'name_desc') {
        q = q.order('name', { ascending: false, nullsFirst: false })
      } else if (currentSort === 'newest') {
        q = q.order('created_at', { ascending: false, nullsFirst: false })
      } else {
        q = q.order('name', { ascending: true, nullsFirst: false })
      }
      return q
    }

    let { data, count, error } = await build().range(from, to).returns<Customer[]>()
    totalRows = count ?? 0
    const totalPagesTmp = Math.max(1, Math.ceil(totalRows / currentPerPage) || 1)
    if (currentPage > totalPagesTmp && totalRows > 0) {
      safeGuess = totalPagesTmp
      from = (safeGuess - 1) * currentPerPage
      to = from + currentPerPage - 1
      ;({ data, count, error } = await build().range(from, to).returns<Customer[]>())
      totalRows = count ?? totalRows
    }
    if (error) listError = error.message
    customers = data || []
  } else {
    // Sortierung nach Termin / Tieranzahl: nur IDs laden, dann Seite anreichern
    let idQuery = supabase.from('customers').select('id, name, created_at').eq('user_id', user.id)
    if (filterIds) idQuery = idQuery.in('id', filterIds)
    const { data: idRows, error: idErr } = await idQuery.returns<
      { id: string; name: string | null; created_at: string | null }[]
    >()
    if (idErr) {
      listError = idErr.message
    } else {
      const ids = (idRows || []).map((r) => r.id)
      const horseCountByCustomer = new Map<string, number>()
      const nextAppointmentByCustomer = new Map<string, string>()

      if (ids.length > 0 && currentSort === 'horses_desc') {
        const { data: horseData } = await supabase
          .from('horses')
          .select('customer_id')
          .eq('user_id', user.id)
          .in('customer_id', ids)
          .returns<{ customer_id: string | null }[]>()
        for (const h of horseData || []) {
          if (!h.customer_id) continue
          horseCountByCustomer.set(
            h.customer_id,
            (horseCountByCustomer.get(h.customer_id) || 0) + 1
          )
        }
      }
      if (ids.length > 0 && currentSort === 'next_appointment') {
        const { data: appointmentData } = await supabase
          .from('appointments')
          .select('customer_id, appointment_date')
          .eq('user_id', user.id)
          .in('customer_id', ids)
          .gte('appointment_date', new Date().toISOString())
          .order('appointment_date', { ascending: true })
          .returns<{ customer_id: string | null; appointment_date: string | null }[]>()
        for (const a of appointmentData || []) {
          if (!a.customer_id || !a.appointment_date) continue
          if (!nextAppointmentByCustomer.has(a.customer_id)) {
            nextAppointmentByCustomer.set(a.customer_id, a.appointment_date)
          }
        }
      }

      const sortedIds = [...(idRows || [])].sort((a, b) => {
        if (currentSort === 'horses_desc') {
          return (horseCountByCustomer.get(b.id) || 0) - (horseCountByCustomer.get(a.id) || 0)
        }
        const na = nextAppointmentByCustomer.get(a.id) || null
        const nb = nextAppointmentByCustomer.get(b.id) || null
        if (!na && !nb) return (a.name || '').localeCompare(b.name || '', 'de')
        if (!na) return 1
        if (!nb) return -1
        return na.localeCompare(nb)
      })

      totalRows = sortedIds.length
      const totalPagesTmp = Math.max(1, Math.ceil(totalRows / currentPerPage) || 1)
      const safePageTmp = Math.min(currentPage, Math.max(1, totalPagesTmp))
      const pageIds = sortedIds
        .slice((safePageTmp - 1) * currentPerPage, safePageTmp * currentPerPage)
        .map((r) => r.id)

      if (pageIds.length > 0) {
        const { data, error } = await supabase
          .from('customers')
          .select(customerCols)
          .eq('user_id', user.id)
          .in('id', pageIds)
          .returns<Customer[]>()
        if (error) listError = error.message
        const byId = new Map((data || []).map((c) => [c.id, c]))
        customers = pageIds.map((id) => byId.get(id)).filter((c): c is Customer => Boolean(c))
      }
    }
  }

  if (listError) {
    return (
      <AppPage>
        <EmptyState
          title="Fehler"
          description={`Kunden konnten nicht geladen werden: ${listError}`}
          className="border-red-200 bg-red-50"
        />
      </AppPage>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / currentPerPage) || 1)
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = totalRows === 0 ? 0 : (safePage - 1) * currentPerPage
  const endIndex = startIndex + currentPerPage
  const pagedCustomerIds = customers.map((c) => c.id)

  let horses: Horse[] = []
  let appointments: Appointment[] = []
  let appointmentHorseRows: AppointmentHorse[] = []
  const nowIso = new Date().toISOString()

  const [{ count: horseCountExact }, { count: appointmentsThisWeekCount }, { count: allCustomerCount }, pageExtras] =
    await Promise.all([
      supabase.from('horses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      (() => {
        const { weekStart, weekEnd } = getCurrentWeekRange()
        return supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('appointment_date', weekStart.toISOString())
          .lt('appointment_date', weekEnd.toISOString())
      })(),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      pagedCustomerIds.length === 0
        ? Promise.resolve({ horses: [] as Horse[], appointments: [] as Appointment[], links: [] as AppointmentHorse[] })
        : (async () => {
            const [{ data: horseData }, { data: appointmentData }] = await Promise.all([
              supabase
                .from('horses')
                .select(
                  'id, name, customer_id, animal_type, stable_name, stable_city, stable_street, stable_zip'
                )
                .eq('user_id', user.id)
                .in('customer_id', pagedCustomerIds)
                .returns<Horse[]>(),
              supabase
                .from('appointments')
                .select('id, customer_id, appointment_date')
                .eq('user_id', user.id)
                .in('customer_id', pagedCustomerIds)
                .gte('appointment_date', nowIso)
                .order('appointment_date', { ascending: true })
                .returns<Appointment[]>(),
            ])
            const appts = appointmentData || []
            let links: AppointmentHorse[] = []
            const appointmentIds = appts.map((a) => a.id)
            if (appointmentIds.length > 0) {
              const { data: linkData } = await supabase
                .from('appointment_horses')
                .select('appointment_id, horse_id')
                .eq('user_id', user.id)
                .in('appointment_id', appointmentIds)
                .returns<AppointmentHorse[]>()
              links = linkData || []
            }
            return { horses: horseData || [], appointments: appts, links }
          })(),
    ])

  horses = pageExtras.horses
  appointments = pageExtras.appointments
  appointmentHorseRows = pageExtras.links

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

  const nextAppointmentByCustomer = new Map<string, { date: string; horseCount: number }>()
  for (const appointment of appointments) {
    if (!appointment.customer_id || !appointment.appointment_date) continue
    if (!nextAppointmentByCustomer.has(appointment.customer_id)) {
      nextAppointmentByCustomer.set(appointment.customer_id, {
        date: appointment.appointment_date,
        horseCount: horseCountByAppointment.get(appointment.id) || 0,
      })
    }
  }

  const pagedRows: CustomerRow[] = customers.map((customer) => {
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

  const customerCount = allCustomerCount ?? 0
  const horseCount = horseCountExact ?? 0
  const appointmentsThisWeek = appointmentsThisWeekCount ?? 0

  const avgHorsesPerCustomer =
    customerCount > 0
      ? (horseCount / customerCount).toFixed(1).replace('.', ',')
      : '0,0'

  return (
    <AppPage>
      <PageHeader
        title="Kunden"
        description={`${customerCount} Kunden · ${horseCount} Tiere in Betreuung`}
        actions={
          <Link
            href="/customers/new"
            className="primary-button"
          >
            <i className="bi bi-person-fill-add text-[13px]" />
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
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-primary"
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
                  ? 'bg-[var(--accent)] text-white'
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
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-white text-[#6B7280]',
              ].join(' ')}
            >
              Karten
            </Link>
          </div>
        </div>
      </div>

      {currentView === 'list' ? (
        <div className="content-card">
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
                  className="relative grid grid-cols-[52px_minmax(0,1fr)_160px_90px_140px_70px] items-center gap-3 border-b border-[#E5E2DC] px-[22px] py-[14px] transition hover:bg-[rgba(1,85,85,0.03)] last:border-b-0 max-[1000px]:grid-cols-[52px_minmax(0,1fr)_80px_140px_70px] max-[1000px]:[&>*:nth-child(4)]:hidden max-[768px]:grid-cols-[42px_minmax(0,1fr)_70px_70px] max-[768px]:[&>*:nth-child(5)]:hidden"
                >
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Kunde ${row.customer.name || ''} öffnen`}
                  />
                  <div
                    className="pointer-events-none flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white"
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
                        <div className="text-[13px] font-medium text-primary">
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
                      className="pointer-events-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] hover:border-primary hover:text-primary"
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
                    : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-primary hover:text-primary',
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
                        ? 'primary-button'
                        : 'secondary-button hover:border-[var(--accent)] hover:text-[var(--accent)]',
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
                    : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-primary hover:text-primary',
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
    </AppPage>
  )
}