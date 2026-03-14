import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type CustomerRecordsPageProps = {
  params: Promise<{
    id: string
  }>
}

type Horse = {
  id: string
  name: string | null
}

type HoofRecord = {
  id: string
  horse_id: string
  record_date: string | null
  hoof_condition: string | null
  treatment: string | null
  notes: string | null
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

export default async function CustomerRecordsPage({
  params,
}: CustomerRecordsPageProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!customer) {
    return (
      <main className="mx-auto max-w-[1280px] w-full space-y-7">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">
            Kunde nicht gefunden
          </h1>
        </div>
      </main>
    )
  }

  const { data: horses } = await supabase
    .from('horses')
    .select('id, name')
    .eq('customer_id', id)
    .eq('user_id', user.id)
    .returns<Horse[]>()

  const horseIds = (horses || []).map((horse) => horse.id)

  let records: HoofRecord[] = []

  if (horseIds.length > 0) {
    const { data } = await supabase
      .from('hoof_records')
      .select('id, horse_id, record_date, hoof_condition, treatment, notes')
      .in('horse_id', horseIds)
      .eq('user_id', user.id)
      .order('record_date', { ascending: false })
      .returns<HoofRecord[]>()

    records = data || []
  }

  const horseMap = new Map(
    (horses || []).map((horse) => [horse.id, horse.name || '-'])
  )

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dokumentationen – {customer.name}
          </h1>
          <p className="text-sm text-slate-500">
            Alle Hufdokumentationen dieses Kunden auf einen Blick.
          </p>
        </div>

        <Link
          href={`/customers/${id}`}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Zurück zum Kunden
        </Link>
      </div>

      <div className="huf-card">
        <div className="huf-table-wrap">
          <table className="huf-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Pferd</th>
                <th>Hufzustand</th>
                <th>Behandlung</th>
                <th className="text-right">Aktion</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    {formatGermanDate(record.record_date)}
                  </td>

                  <td className="font-medium text-[#1B1F23]">
                    {horseMap.get(record.horse_id) || '-'}
                  </td>

                  <td>
                    {record.hoof_condition || '-'}
                  </td>

                  <td>
                    {record.treatment || '-'}
                  </td>

                  <td>
                    <div className="flex justify-end">
                      <Link
                        href={`/horses/${record.horse_id}/records/${record.id}`}
                        className="huf-btn-dark inline-flex items-center justify-center rounded-lg bg-[#1B1F23] px-3 py-2 text-sm font-medium text-white hover:bg-[#2A2F35]"
                      >
                        Öffnen
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {records.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-sm text-[#6B7280]"
                  >
                    Noch keine Dokumentationen vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}