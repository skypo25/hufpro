import { cookies } from 'next/headers'
import { isAdminUserId } from '@/lib/admin/config'
import { logAdminAuditEvent } from '@/lib/admin/audit'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export const IMPERSONATION_COOKIE = 'anidocs_impersonation'

export type ImpersonationCookiePayload = {
  adminId: string
  adminEmail?: string | null
  targetId: string
  targetEmail?: string | null
  startedAt: string
}

function backToUser(userId: string, q: Record<string, string> = {}) {
  const p = new URLSearchParams(q)
  const qs = p.toString()
  return `/admin/users/${userId}${qs ? `?${qs}` : ''}`
}

function safeErr(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 180)
}

/**
 * Bereitet Impersonation vor und liefert den token_hash für /auth/impersonate.
 * Cookie wird gesetzt; Aufrufer leitet dorthin um (idealerweise in neuem Fenster).
 */
export async function prepareImpersonation(userId: string): Promise<
  { ok: true; tokenHash: string } | { ok: false; redirectTo: string }
> {
  if (!userId) {
    return { ok: false, redirectTo: '/admin/users?err=impersonate' }
  }

  const admin = await requireAdmin()
  if (admin.userId === userId) {
    return {
      ok: false,
      redirectTo: backToUser(userId, { err: 'impersonate', msg: 'Du bist bereits dieser Nutzer.' }),
    }
  }
  if (isAdminUserId(userId)) {
    return {
      ok: false,
      redirectTo: backToUser(userId, {
        err: 'impersonate',
        msg: 'Andere Admins können nicht impersoniert werden.',
      }),
    }
  }

  const db = createSupabaseServiceRoleClient()
  const { data: userRes, error: userErr } = await db.auth.admin.getUserById(userId)
  if (userErr || !userRes.user?.email) {
    return {
      ok: false,
      redirectTo: backToUser(userId, {
        err: 'impersonate',
        msg: safeErr(userErr?.message ?? 'Keine E-Mail'),
      }),
    }
  }

  const { data: linkRes, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: userRes.user.email,
  })
  const tokenHash = linkRes?.properties?.hashed_token
  if (linkErr || !tokenHash) {
    return {
      ok: false,
      redirectTo: backToUser(userId, {
        err: 'impersonate',
        msg: safeErr(linkErr?.message ?? 'Magic-Link fehlgeschlagen'),
      }),
    }
  }

  const cookieStore = await cookies()
  cookieStore.set(
    IMPERSONATION_COOKIE,
    JSON.stringify({
      adminId: admin.userId,
      adminEmail: admin.email,
      targetId: userId,
      targetEmail: userRes.user.email,
      startedAt: new Date().toISOString(),
    } satisfies ImpersonationCookiePayload),
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4,
      secure: process.env.NODE_ENV === 'production',
    }
  )

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'impersonation.start',
    metadata: { targetEmail: userRes.user.email },
  })

  return { ok: true, tokenHash }
}

export async function getActiveImpersonation(): Promise<ImpersonationCookiePayload | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ImpersonationCookiePayload
    if (!parsed?.adminId || !parsed?.targetId) return null
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.id !== parsed.targetId) return null
    return parsed
  } catch {
    return null
  }
}
