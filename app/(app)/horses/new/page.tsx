import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import HorseForm from '@/components/horses/HorseForm'
import { emptyHorseFormData } from '@/components/horses/horseFormDefaults'

type NewHorsePageProps = {
  searchParams: Promise<{
    customerId?: string
  }>
}

export default async function NewHorsePage({ searchParams }: NewHorsePageProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { customerId } = await searchParams

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, customer_number, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return (
      <main className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-700">Fehler</h1>
          <p className="text-red-600">
            Kunden konnten nicht geladen werden: {error.message}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#154226] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/horses" className="text-[#154226] hover:underline">
          Pferde
        </Link>
        <span>›</span>
        <span>Neues Pferd anlegen</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Neues Pferd anlegen
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Pflichtfelder sind mit * gekennzeichnet
        </p>
      </div>

      <HorseForm
        mode="create"
        customers={customers || []}
        initialData={{
          ...emptyHorseFormData,
          customerId: customerId || '',
        }}
      />
    </main>
  )
}