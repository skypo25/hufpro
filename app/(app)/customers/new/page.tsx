import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import CustomerForm from '@/components/customers/CustomerForm'
import { emptyCustomerFormData } from '@/components/customers/customerFormDefaults'
import AppPage from '@/components/layout/AppPage'

export default async function NewCustomerPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AppPage>
      <div>
        <h1 className="dashboard-serif text-[28px] font-medium tracking-[-0.02em] text-[#1B1F23]">
          Neuen Kunden anlegen
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Pflichtfelder sind mit * gekennzeichnet
        </p>
      </div>

     <CustomerForm mode="create" initialData={emptyCustomerFormData} />
    </AppPage>
  )
}