'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Liest die nächste Kundennummer aus den Einstellungen, erhöht sie und gibt die verwendete Nummer zurück.
 * Der Hufbearbeiter legt Präfix und nächste Nummer in den Einstellungen fest (wie bei der Rechnungsnummer).
 */
export async function reserveNextCustomerNumber(): Promise<
  { customerNumber: number } | { error: string }
> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet.' }

  const { data: row } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle<{ settings: Record<string, unknown> | null }>()

  const s = (row?.settings ?? {}) as Record<string, unknown>
  const next = Math.max(1, Number(s.nextCustomerNumber) || 1)

  await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, settings: { ...s, nextCustomerNumber: next + 1 } },
      { onConflict: 'user_id' }
    )

  return { customerNumber: next }
}
