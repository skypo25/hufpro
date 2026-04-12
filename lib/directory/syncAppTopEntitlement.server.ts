import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import type { BillingAccountRow } from '@/lib/billing/types'

const LIVE: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due'])

/**
 * Stellt sicher, dass ein aktives App-Monatsabo als `app_subscription`-Entitlement
 * in der DB steht (nachziehen, falls Webhook fehlte oder Zeilen unsichtbar waren).
 */
export async function syncAppTopEntitlementFromBilling(args: {
  directoryProfileId: string
  claimedByUserId: string
  billing: BillingAccountRow | null
}): Promise<void> {
  const appPriceId = process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null

  const admin = createSupabaseServiceRoleClient()
  const { data: prof } = await admin
    .from('directory_profiles')
    .select('id, claimed_by_user_id')
    .eq('id', args.directoryProfileId)
    .maybeSingle()

  const owner = (prof as { claimed_by_user_id?: string | null } | null)?.claimed_by_user_id ?? null
  if (owner !== args.claimedByUserId) return

  const st = (args.billing?.subscription_status ?? 'none').toString()
  const priceId = args.billing?.subscription_price_id ?? null
  const isLive = LIVE.has(st)
  /**
   * Ohne STRIPE_PRICE_ID_MONTHLY können wir die Price-ID nicht prüfen — dann wie Stripe-Webhook:
   * jede „lebendige“ Subscription zählt als App-Abo (Single-Product-Setup).
   * Mit gesetzter Env: exakter Match, oder noch keine price_id in billing_accounts (z. B. Trial/Übergang).
   */
  const priceOk =
    !appPriceId || !priceId || String(priceId).trim() === '' || String(priceId).trim() === appPriceId

  if (isLive && priceOk) {
    const until = args.billing?.subscription_current_period_end ?? null
    await admin.from('directory_profile_top_entitlements').upsert(
      {
        directory_profile_id: args.directoryProfileId,
        source: 'app_subscription',
        active_until: until,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'directory_profile_id,source' }
    )
  } else {
    await admin
      .from('directory_profile_top_entitlements')
      .delete()
      .eq('directory_profile_id', args.directoryProfileId)
      .eq('source', 'app_subscription')
  }
}
