import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import CustomerForm from '@/components/customers/CustomerForm'
import { emptyCustomerFormData } from '@/components/customers/customerFormDefaults'

export default async function NewCustomerPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#154226] hover:underline">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/customers" className="text-[#154226] hover:underline">
          Kunden
        </Link>
        <span>›</span>
        <span>Neuen Kunden anlegen</span>
      </div>

      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Neuen Kunden anlegen
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Pflichtfelder sind mit * gekennzeichnet
        </p>
      </div>

     <CustomerForm mode="create" initialData={emptyCustomerFormData} />
    </main>
  )
}