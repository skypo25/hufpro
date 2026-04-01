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

  const { data: existing, error: readErr } = await supabaseAdmin
    .from('billing_accounts')
    .select('user_id')
    .eq('user_id', args.userId)
    .maybeSingle()

  if (readErr) {
    throw new Error(`Billing-Konto konnte nicht geladen werden: ${readErr.message}`)
  }

  if (existing) {
    // Wichtig: kein Upsert mit trial_ends_at — das würde den Testzeitraum bei jedem Aufruf neu setzen.
    if (args.email) {
      const { error: upErr } = await supabaseAdmin
        .from('billing_accounts')
        .update({
          billing_email: args.email,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', args.userId)
      if (upErr) {
        throw new Error(`Billing-Konto konnte nicht aktualisiert werden: ${upErr.message}`)
      }
    }
    return
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseAdmin.from('billing_accounts').insert({
    user_id: args.userId,
    trial_ends_at: trialEndsAt,
    billing_email: args.email ?? null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return
    }
    const details = [
      error.message,
      typeof (error as any).details === 'string' ? (error as any).details : null,
      typeof (error as any).hint === 'string' ? (error as any).hint : null,
      typeof (error as any).code === 'string' ? `code=${(error as any).code}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    throw new Error(`Billing-Konto konnte nicht initialisiert werden: ${details}`)
  }
}

