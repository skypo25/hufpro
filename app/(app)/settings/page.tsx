import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { canAccessApp, getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'
import SettingsForm from '@/components/settings/SettingsForm'
import SeedTestDataButton from '@/components/settings/SeedTestDataButton'
import { AppProfileProvider } from '@/context/AppProfileContext'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let initialSettings: Record<string, unknown> | null = null
  const { data: settingsRow, error: settingsError } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!settingsError && settingsRow?.settings) {
    const raw = settingsRow.settings as Record<string, unknown>
    initialSettings = { ...raw }
    if ('smtpPassword' in initialSettings) {
      delete initialSettings.smtpPassword
    }
  }

  const { data: billingRow } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()
  const billingState = getBillingState({
    account: (billingRow as BillingAccountRow | null) ?? null,
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
  })
  const canExportData = canAccessApp(billingState)

  const { data: customerRows } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, company, street, postal_code, city, country')
    .eq('user_id', user.id)
    .order('name')
  const customers = (customerRows ?? []).map((c) => ({
    id: c.id,
    label: c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Unbenannt',
    name: c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || null,
    first_name: c.first_name ?? null,
    last_name: c.last_name ?? null,
    company: c.company ?? null,
    street: c.street ?? null,
    postal_code: c.postal_code ?? null,
    city: c.city ?? null,
    country: c.country ?? null,
  }))

  return (
    <div className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
          Dashboard
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Einstellungen</span>
      </div>

      <div>
        <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">
          Einstellungen
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Deine Betriebsdaten, Rechnungseinstellungen und Profil
        </p>
      </div>

      <SettingsForm
        initialSettings={initialSettings}
        userEmail={user.email ?? undefined}
        customers={customers}
        canExportData={canExportData}
      />

      <div>
        <AppProfileProvider>
          <SeedTestDataButton />
        </AppProfileProvider>
      </div>
    </div>
  )
}
