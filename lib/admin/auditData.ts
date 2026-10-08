import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export type AdminAuditEventRow = {
  id: string
  created_at: string
  actor_user_id: string | null
  target_user_id: string | null
  action: string
  message: string | null
  metadata: Record<string, unknown> | null
}

export function adminAuditActionLabel(action: string): string {
  const map: Record<string, string> = {
    'feature_flag.toggle': 'Feature-Flag',
    'admin_note.save': 'Notiz',
    'trial.extend': 'Trial verlängert',
    'trial.end_now': 'Trial beendet',
    'account.ban': 'Account gesperrt',
    'account.unban': 'Account entsperrt',
    'account.delete_hard': 'Account gelöscht',
    'password_reset.admin_send': 'Passwort-Reset (Admin)',
    'password_reset.email_failed': 'Passwort-Reset E-Mail fehlgeschlagen',
    'billing.cancel_at_period_end': 'Abo: Kündigung Periodenende',
    'billing.cancel_now': 'Abo: Sofortkündigung',
    'billing.reactivate': 'Abo: Kündigung widerrufen',
    'billing.comp_access': 'Comp-/Grace-Zugang',
    'impersonation.start': 'Impersonation gestartet',
    'impersonation.end': 'Impersonation beendet',
    'system_smtp.save': 'SMTP gespeichert',
    'system_smtp.test': 'SMTP-Test',
    'system_settings.data_export_retention': 'Export-Aufbewahrung',
    'directory_claim.approve': 'Claim angenommen',
    'directory_claim.reject': 'Claim abgelehnt',
    'directory_profile.listing_status': 'Listing-Status',
    'directory_profile.verification_state': 'Verifizierung',
    'directory_profile.top_manual_activate': 'Top aktiviert',
    'directory_profile.top_manual_extend': 'Top verlängert',
    'directory_profile.top_manual_end': 'Top beendet',
    'directory_profile.top_purge_all': 'Top gelöscht',
    'directory_profile.owner_release': 'Owner gelöst',
    'directory_profile.owner_assign': 'Owner zugewiesen',
    'directory_user_access.set': 'Zugriffsumfang',
  }
  return map[action] ?? action
}

export async function fetchAdminAuditEvents(opts: {
  limit?: number
  offset?: number
  action?: string
  targetUserId?: string
  actorUserId?: string
}): Promise<{ rows: AdminAuditEventRow[]; total: number }> {
  const db = createSupabaseServiceRoleClient()
  const limit = Math.min(100, Math.max(1, opts.limit ?? 40))
  const offset = Math.max(0, opts.offset ?? 0)

  let query = db
    .from('admin_audit_events')
    .select('id, created_at, actor_user_id, target_user_id, action, message, metadata', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.action?.trim()) query = query.eq('action', opts.action.trim())
  if (opts.targetUserId?.trim()) query = query.eq('target_user_id', opts.targetUserId.trim())
  if (opts.actorUserId?.trim()) query = query.eq('actor_user_id', opts.actorUserId.trim())

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    rows: (data ?? []) as AdminAuditEventRow[],
    total: count ?? 0,
  }
}
