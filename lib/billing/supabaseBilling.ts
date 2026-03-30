import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import type { BillingAccountRow } from '@/lib/billing/types'

export async function getBillingAccountForCurrentUser(): Promise<{
  userId: string
  account: BillingAccountRow | null
}> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Nicht eingeloggt.')
  }

  const { data, error } = await supabase
    .from('billing_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error('Billing-Daten konnten nicht geladen werden.')
  }

  return { userId: user.id, account: (data as BillingAccountRow | null) ?? null }
}

export async function ensureBillingAccountRow(args: {
  userId: string
  email?: string | null
}): Promise<void> {
  const supabaseAdmin = createSupabaseServiceRoleClient()

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const payload: Partial<BillingAccountRow> & { user_id: string } = {
    user_id: args.userId,
    trial_ends_at: trialEndsAt,
    billing_email: args.email ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('billing_accounts')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    const details = [
      error.message,
      // supabase-js has these optional fields depending on PostgREST response
      typeof (error as any).details === 'string' ? (error as any).details : null,
      typeof (error as any).hint === 'string' ? (error as any).hint : null,
      typeof (error as any).code === 'string' ? `code=${(error as any).code}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    throw new Error(`Billing-Konto konnte nicht initialisiert werden: ${details}`)
  }
}

