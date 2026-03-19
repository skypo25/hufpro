import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import HorseForm from '@/components/horses/HorseForm'

type EditHorsePageProps = {
  params: Promise<{
    id: string
  }>
}

type HorseRow = {
  id: string
  customer_id: string | null
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  birth_date: string | null
  usage: string | null
  housing: string | null
  hoof_status: string | null
  care_interval: string | null
  special_notes: string | null
  notes: string | null
}

export default async function EditHorsePage({
  params,
}: EditHorsePageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: horse, error: horseError } = await supabase
    .from('horses')
    .select(`
      id,
      customer_id,
      name,
      breed,
      sex,
      birth_year,
      birth_date,
      usage,
      housing,
      hoof_status,
      care_interval,
      special_notes,
      notes
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single<HorseRow>()

  if (horseError || !horse) {
    return (
      <main className="mx-auto max-w-[920px] space-y-7">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Pferd konnte nicht geladen werden.
        </div>
      </main>
    )
  }

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, customer_number, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (customersError) {
    return (
      <main className="mx-auto max-w-[920px] space-y-7">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kunden konnten nicht geladen werden: {customersError.message}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[920px] space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/horses" className="text-[#52b788] hover:underline">
          Pferde
        </Link>
        <span>›</span>
        <Link href={`/horses/${horse.id}`} className="text-[#52b788] hover:underline">
          {horse.name || 'Pferd'}
        </Link>
        <span>›</span>
        <span>Pferd bearbeiten</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Pferd bearbeiten
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Änderungen werden direkt auf den bestehenden Pferdedatensatz gespeichert
        </p>
      </div>

      <HorseForm
        mode="edit"
        customers={customers || []}
        initialData={{
          id: horse.id,
          customerId: horse.customer_id || '',
          name: horse.name || '',
          breed: horse.breed || '',
          sex: horse.sex || '',
          birthYear: horse.birth_year ? String(horse.birth_year) : '',
          birthDate: horse.birth_date || '',
          usage: horse.usage || '',
          housing: horse.housing || '',
          hoofStatus: horse.hoof_status || '',
          careInterval: horse.care_interval || '',
          specialNotes: horse.special_notes || '',
          notes: horse.notes || '',
        }}
      />
    </main>
  )
}