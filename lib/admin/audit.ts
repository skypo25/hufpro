import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export async function logAdminAuditEvent(args: {
  actorUserId: string | null
  targetUserId: string | null
  action: string
  message?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const db = createSupabaseServiceRoleClient()
  // Best-effort logging; never break the admin flow.
  try {
    await db.from('admin_audit_events').insert({
      actor_user_id: args.actorUserId,
      target_user_id: args.targetUserId,
      action: args.action,
      message: args.message ?? null,
      metadata: args.metadata ?? null,
    })
  } catch {
    // ignore
  }
}

