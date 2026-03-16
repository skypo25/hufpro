'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Liest die nächste Kundennummer aus den Einstellungen, erhöht sie und gibt die verwendete Nummer zurück.
 * Liegt das Maximum in der DB höher (z. B. nach Import), wird das berücksichtigt, damit keine Duplikate entstehen.
 */
export async function reserveNextCustomerNumber(): Promise<
  { customerNumber: number } | { error: string }
> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet.' }

  const [{ data: row }, { data: maxRow }] = await Promise.all([
    supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle<{ settings: Record<string, unknown> | null }>(),
    supabase
      .from('customers')
      .select('customer_number')
      .eq('user_id', user.id)
      .order('customer_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const s = (row?.settings ?? {}) as Record<string, unknown>
  const fromSettings = Math.max(1, Number(s.nextCustomerNumber) || 1)
  const fromDb = (maxRow?.customer_number ?? 0) + 1
  const next = Math.max(fromSettings, fromDb)

  await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, settings: { ...s, nextCustomerNumber: next + 1 } },
      { onConflict: 'user_id' }
    )

  return { customerNumber: next }
}
