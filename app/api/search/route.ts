import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { countDocumentationTotalForUser } from '@/lib/documentation/countDocumentationTotalForUser'
import { searchDocumentationHits } from '@/lib/documentation/searchDocumentationHits'

type SearchFilter = 'alle' | 'kunden' | 'pferde' | 'termine' | 'dokumentationen' | 'rechnungen'

const VALID_FILTERS: SearchFilter[] = ['alle', 'kunden', 'pferde', 'termine', 'dokumentationen', 'rechnungen']

function parseFilter(raw: string | undefined): SearchFilter {
  const f = (raw || 'alle').toLowerCase()
  return VALID_FILTERS.includes(f as SearchFilter) ? (f as SearchFilter) : 'alle'
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const searchQuery = (searchParams.get('q') ?? '').trim()
  const currentFilter = parseFilter(searchParams.get('filter') ?? undefined)

  const [
    { count: customerCount },
    { count: horseCount },
    { count: appointmentCount },
    hoofRecordCount,
    { count: invoiceCount },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('horses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    countDocumentationTotalForUser(supabase, user.id),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const counts = {
    customers: customerCount ?? 0,
    horses: horseCount ?? 0,
    appointments: appointmentCount ?? 0,
    hoofRecords: hoofRecordCount ?? 0,
    invoices: invoiceCount ?? 0,
  }

  let customers: unknown[] = []
  let horses: unknown[] = []
  let appointments: unknown[] = []
  let hoofRecords: unknown[] = []
  let invoices: unknown[] = []

  if (searchQuery) {
    const pattern = `%${searchQuery}%`
    const numQuery = /^\d+$/.test(searchQuery) ? parseInt(searchQuery, 10) : null

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
      customers = data || []
    }

    if (currentFilter === 'alle' || currentFilter === 'pferde') {
      const { data: byHorse } = await supabase
        .from('horses')
        .select('id, name, breed, birth_year, customer_id, customers(name)')
        .eq('user_id', user.id)
        .or(`name.ilike.${pattern},breed.ilike.${pattern}`)
        .order('name', { ascending: true })
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
      const customerIdsFromSearch = (custMatch || []).map((r) => r.id)

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
        .slice(0, 50)
    }

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
        .slice(0, 50)
    }

    if (currentFilter === 'alle' || currentFilter === 'dokumentationen') {
      hoofRecords = await searchDocumentationHits(supabase, user.id, searchQuery)
    }

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
        .slice(0, 50)
    }
  }

  return NextResponse.json({
    counts,
    customers,
    horses,
    appointments,
    hoofRecords,
    invoices,
  })
}
