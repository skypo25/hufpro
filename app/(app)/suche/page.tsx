import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import SearchPageContent, { type SearchFilter, type SearchPageContentProps } from '@/components/search/SearchPageContent'
import { Suspense } from 'react'

type SearchPageProps = {
  searchParams: Promise<{ q?: string; filter?: string }>
}

const VALID_FILTERS: SearchFilter[] = ['alle', 'kunden', 'pferde', 'termine', 'dokumentationen', 'rechnungen']

function parseFilter(raw: string | undefined): SearchFilter {
  const f = (raw || 'alle').toLowerCase()
  return VALID_FILTERS.includes(f as SearchFilter) ? (f as SearchFilter) : 'alle'
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { q, filter } = await searchParams
  const searchQuery = (q || '').trim()
  const currentFilter = parseFilter(filter)

  // Counts (always needed for filter tabs)
  const [
    { count: customerCount },
    { count: horseCount },
    { count: appointmentCount },
    { count: hoofRecordCount },
    { count: invoiceCount },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('horses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('hoof_records').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const counts = {
    customers: customerCount ?? 0,
    horses: horseCount ?? 0,
    appointments: appointmentCount ?? 0,
    hoofRecords: hoofRecordCount ?? 0,
    invoices: invoiceCount ?? 0,
  }

  let customers: SearchPageContentProps['customers'] = []
  let horses: SearchPageContentProps['horses'] = []
  let appointments: SearchPageContentProps['appointments'] = []
  let hoofRecords: SearchPageContentProps['hoofRecords'] = []
  let invoices: SearchPageContentProps['invoices'] = []

  if (searchQuery) {
    const pattern = `%${searchQuery}%`
    const numQuery = /^\d+$/.test(searchQuery) ? parseInt(searchQuery, 10) : null

    // Customers
    if (currentFilter === 'alle' || currentFilter === 'kunden') {
      const orParts = [
        `name.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `company.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `stable_name.ilike.${pattern}`,
        `stable_city.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
      ]
      if (numQuery != null) orParts.push(`customer_number.eq.${numQuery}`)
      const { data } = await supabase
        .from('customers')
        .select('id, customer_number, name, first_name, last_name, phone, email, city, stable_name')
        .eq('user_id', user.id)
        .or(orParts.join(','))
        .order('name', { ascending: true })
        .limit(50)
      customers = (data || []) as SearchPageContentProps['customers']
    }

    // Horses (search by name, breed, or customer name)
    if (currentFilter === 'alle' || currentFilter === 'pferde') {
      const { data: byHorse } = await supabase
        .from('horses')
        .select('id, name, breed, birth_year, customer_id, customers(name)')
        .eq('user_id', user.id)
        .or(`name.ilike.${pattern},breed.ilike.${pattern}`)
        .order('name', { ascending: true })
        .limit(50)

      let customerIdsFromSearch: string[] = []
      const custOr = [
        `name.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `company.ilike.${pattern}`,
      ]
      if (numQuery != null) custOr.push(`customer_number.eq.${numQuery}`)
      const { data: custMatch } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .or(custOr.join(','))
      customerIdsFromSearch = (custMatch || []).map((r) => r.id)

      let byCustomer: typeof byHorse = []
      if (customerIdsFromSearch.length > 0) {
        const { data } = await supabase
          .from('horses')
          .select('id, name, breed, birth_year, customer_id, customers(name)')
          .eq('user_id', user.id)
          .in('customer_id', customerIdsFromSearch)
          .order('name', { ascending: true })
          .limit(50)
        byCustomer = data || []
      }

      const seen = new Set<string>()
      horses = [...(byHorse || []), ...byCustomer]
        .filter((h) => {
          if (seen.has(h.id)) return false
          seen.add(h.id)
          return true
        })
        .slice(0, 50) as SearchPageContentProps['horses']
    }

    // Appointments (search by notes, type, or customer name)
    if (currentFilter === 'alle' || currentFilter === 'termine') {
      const { data: byNotes } = await supabase
        .from('appointments')
        .select('id, appointment_date, notes, type, customer_id, customers(name)')
        .eq('user_id', user.id)
        .or(`notes.ilike.${pattern},type.ilike.${pattern}`)
        .order('appointment_date', { ascending: false })
        .limit(50)

      const custOr = [
        `name.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `company.ilike.${pattern}`,
      ]
      if (numQuery != null) custOr.push(`customer_number.eq.${numQuery}`)
      const { data: custMatch } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .or(custOr.join(','))
      const custIds = (custMatch || []).map((r) => r.id)

      let byCustomer: typeof byNotes = []
      if (custIds.length > 0) {
        const { data } = await supabase
          .from('appointments')
          .select('id, appointment_date, notes, type, customer_id, customers(name)')
          .eq('user_id', user.id)
          .in('customer_id', custIds)
          .order('appointment_date', { ascending: false })
          .limit(50)
        byCustomer = data || []
      }

      const seen = new Set<string>()
      appointments = [...(byNotes || []), ...byCustomer]
        .filter((a) => {
          if (seen.has(a.id)) return false
          seen.add(a.id)
          return true
        })
        .slice(0, 50) as unknown as SearchPageContentProps['appointments']
    }

    // Hoof records (search by hoof_condition, treatment, notes, doc_number, horse name)
    if (currentFilter === 'alle' || currentFilter === 'dokumentationen') {
      const { data: byRecord } = await supabase
        .from('hoof_records')
        .select(`
          id, horse_id, record_date, hoof_condition, treatment, notes, doc_number,
          horses (name, customers(name))
        `)
        .eq('user_id', user.id)
        .or(`hoof_condition.ilike.${pattern},treatment.ilike.${pattern},notes.ilike.${pattern},doc_number.ilike.${pattern}`)
        .order('record_date', { ascending: false })
        .limit(50)

      const { data: horsesByName } = await supabase
        .from('horses')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', pattern)
      const horseIds = (horsesByName || []).map((r) => r.id)

      let byHorse: typeof byRecord = []
      if (horseIds.length > 0) {
        const { data } = await supabase
          .from('hoof_records')
          .select(`
            id, horse_id, record_date, hoof_condition, treatment, notes, doc_number,
            horses (name, customers(name))
          `)
          .eq('user_id', user.id)
          .in('horse_id', horseIds)
          .order('record_date', { ascending: false })
          .limit(50)
        byHorse = data || []
      }

      const seen = new Set<string>()
      hoofRecords = [...(byRecord || []), ...byHorse]
        .filter((r) => {
          if (seen.has(r.id)) return false
          seen.add(r.id)
          return true
        })
        .slice(0, 50) as unknown as SearchPageContentProps['hoofRecords']
    }

    // Invoices (search by invoice_number, customer name)
    if (currentFilter === 'alle' || currentFilter === 'rechnungen') {
      const { data: byNumber } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, status, customer_id, customers(name)')
        .eq('user_id', user.id)
        .ilike('invoice_number', pattern)
        .order('invoice_date', { ascending: false })
        .limit(50)

      const custOr = [
        `name.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `company.ilike.${pattern}`,
      ]
      if (numQuery != null) custOr.push(`customer_number.eq.${numQuery}`)
      const { data: custMatch } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .or(custOr.join(','))
      const custIds = (custMatch || []).map((r) => r.id)

      let byCustomer: typeof byNumber = []
      if (custIds.length > 0) {
        const { data } = await supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date, status, customer_id, customers(name)')
          .eq('user_id', user.id)
          .in('customer_id', custIds)
          .order('invoice_date', { ascending: false })
          .limit(50)
        byCustomer = data || []
      }

      const seen = new Set<string>()
      invoices = [...(byNumber || []), ...byCustomer]
        .filter((inv) => {
          if (seen.has(inv.id)) return false
          seen.add(inv.id)
          return true
        })
        .slice(0, 50) as unknown as SearchPageContentProps['invoices']
    }
  }

  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageContent
        initialQuery={searchQuery}
        initialFilter={currentFilter}
        counts={counts}
        customers={customers}
        horses={horses}
        appointments={appointments}
        hoofRecords={hoofRecords}
        invoices={invoices}
      />
    </Suspense>
  )
}

function SearchPageSkeleton() {
  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-8">
      <div>
        <div className="h-8 w-32 animate-pulse rounded bg-[#E5E2DC]" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-[#E5E2DC]" />
      </div>
      <div className="h-12 w-full animate-pulse rounded-xl bg-[#E5E2DC]" />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-lg bg-[#E5E2DC]" />
        ))}
      </div>
    </main>
  )
}
