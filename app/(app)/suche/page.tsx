import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { formatCustomerNumber } from '@/lib/format'

type SearchPageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

type Customer = {
  id: string
  customer_number?: number | null
  name: string | null
  phone: string | null
  email: string | null
}

type Horse = {
  id: string
  name: string | null
  breed: string | null
  birth_date: string | null
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { q } = await searchParams
  const searchQuery = q?.trim() || ''

  let customers: Customer[] = []
  let horses: Horse[] = []

  if (searchQuery) {
    const { data: customersData } = await supabase
      .from('customers')
      .select('id, customer_number, name, phone, email')
      .eq('user_id', user.id)
      .ilike('name', `%${searchQuery}%`)
      .order('name', { ascending: true })
      .returns<Customer[]>()

    const { data: horsesData } = await supabase
      .from('horses')
      .select('id, name, breed, birth_date')
      .eq('user_id', user.id)
      .ilike('name', `%${searchQuery}%`)
      .order('name', { ascending: true })
      .returns<Horse[]>()

    customers = customersData || []
    horses = horsesData || []
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Globale Suche</h1>

      <form method="get" style={{ marginTop: 20, marginBottom: 30, display: 'flex', gap: 10, maxWidth: 600 }}>
        <input
          type="text"
          name="q"
          defaultValue={searchQuery}
          placeholder="Kunde oder Pferd suchen"
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit">Suchen</button>
      </form>

      {!searchQuery && <p>Bitte gib einen Suchbegriff ein.</p>}

      {searchQuery && (
        <>
          <section style={{ marginBottom: 30 }}>
            <h2>Kunden</h2>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {customers.map((customer) => (
                <Link key={customer.id} href={`/customers/${customer.id}`}>
                  <div
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 10,
                      padding: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{customer.name || 'Ohne Namen'}</strong>
                    {customer.customer_number != null && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{formatCustomerNumber(customer.customer_number)}</div>
                    )}
                    <div>{customer.phone || '-'}</div>
                    <div>{customer.email || '-'}</div>
                  </div>
                </Link>
              ))}

              {customers.length === 0 && <p>Keine Kunden gefunden.</p>}
            </div>
          </section>

          <section>
            <h2>Pferde</h2>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {horses.map((horse) => (
                <Link key={horse.id} href={`/horses/${horse.id}`}>
                  <div
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 10,
                      padding: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{horse.name || 'Ohne Namen'}</strong>
                    <div>Rasse: {horse.breed || '-'}</div>
                    <div>Geburtsdatum: {horse.birth_date || '-'}</div>
                  </div>
                </Link>
              ))}

              {horses.length === 0 && <p>Keine Pferde gefunden.</p>}
            </div>
          </section>
        </>
      )}
    </main>
  )
}