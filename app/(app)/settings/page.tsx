import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'
import SettingsForm from '@/components/settings/SettingsForm'
import SeedTestDataButton from '@/components/settings/SeedTestDataButton'

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
  const showDataExport = billingState.access.mode === 'read_only'

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
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
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

      {showDataExport && (
        <div className="huf-card border border-[#BFDBFE] bg-[#EFF6FF] px-5 py-4 text-[13px] text-[#1E3A5F]">
          <div className="font-semibold">Datenexport (nur Lesen)</div>
          <p className="mt-1 text-[#334155]">
            Während der Exportphase nach Kündigung können Sie hier dieselbe ZIP-Datei wie unter Billing herunterladen.
          </p>
          <a
            href="/api/export/full"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#93C5FD] bg-white px-3 py-2 text-[12px] font-semibold text-[#1D4ED8] hover:bg-[#F8FAFC]"
            download
          >
            ZIP exportieren
          </a>
        </div>
      )}

      <SettingsForm
        initialSettings={initialSettings}
        userEmail={user.email ?? undefined}
        customers={customers}
      />

      <div>
        <SeedTestDataButton />
      </div>
    </div>
  )
}
