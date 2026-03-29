import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import CustomerForm from '@/components/customers/CustomerForm'
import { formatCustomerNumber } from '@/lib/format'

type EditCustomerPageProps = {
  params: Promise<{
    id: string
  }>
}

type CustomerRow = {
  id: string
  customer_number?: number | null
  salutation?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  phone2?: string | null
  email?: string | null
  preferred_contact?: string | null

  street?: string | null
  city?: string | null
  postal_code?: string | null
  country?: string | null
  company?: string | null
  vat_id?: string | null

  drive_time?: string | null

  preferred_days?: string[] | null
  preferred_time?: string | null
  interval_weeks?: string | null
  reminder_timing?: string | null

  notes?: string | null
  source?: string | null
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      id,
      customer_number,
      salutation,
      first_name,
      last_name,
      phone,
      phone2,
      email,
      preferred_contact,
      street,
      city,
      postal_code,
      country,
      company,
      vat_id,
      drive_time,
      preferred_days,
      preferred_time,
      interval_weeks,
      reminder_timing,
      notes,
      source
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single<CustomerRow>()

  if (error || !customer) {
    return (
      <main className="mx-auto max-w-[920px] space-y-7">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Kunde konnte nicht geladen werden.
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
        <Link href="/customers" className="text-[#52b788] hover:underline">
          Kunden
        </Link>
        <span>›</span>
        <Link href={`/customers/${id}`} className="text-[#52b788] hover:underline">
          {customer.first_name || customer.last_name
            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            : 'Kundendetail'}
        </Link>
        <span>›</span>
        <span>Kunde bearbeiten</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Kunde bearbeiten
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          {customer.customer_number != null ? (
            <>
              <span className="font-medium tabular-nums text-[#52b788]">{formatCustomerNumber(customer.customer_number)}</span>
              {' · '}
            </>
          ) : null}
          Änderungen werden direkt auf den bestehenden Kundendatensatz gespeichert
        </p>
      </div>

      <CustomerForm
        mode="edit"
        initialData={{
          id: customer.id,
          salutation: customer.salutation || '',
          firstName: customer.first_name || '',
          lastName: customer.last_name || '',
          phone: customer.phone || '',
          phone2: customer.phone2 || '',
          email: customer.email || '',
          preferredContact: customer.preferred_contact || 'Telefon / Anruf',

          billingStreet: customer.street || '',
          billingCity: customer.city || '',
          billingZip: customer.postal_code || '',
          billingCountry: customer.country || 'Deutschland',
          company: customer.company || '',
          vatId: customer.vat_id || '',

          driveTime: customer.drive_time || '',

          preferredDays: customer.preferred_days || [],
          preferredTime: customer.preferred_time || 'Vormittags (8–12 Uhr)',
          intervalWeeks: customer.interval_weeks || '6 Wochen',
          reminderTiming: customer.reminder_timing || '3 Tage vorher',

          notes: customer.notes || '',
          source: customer.source || '',
        }}
      />
    </main>
  )
}