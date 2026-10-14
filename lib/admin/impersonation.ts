import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { isAdminUserId } from '@/lib/admin/config'
import { logAdminAuditEvent } from '@/lib/admin/audit'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export const IMPERSONATION_COOKIE = 'anidocs_impersonation'
/** Einmaliger Handshake: token_hash nie in der URL. */
export const IMPERSONATION_EXCHANGE_COOKIE = 'anidocs_impersonate_x'

export type ImpersonationCookiePayload = {
  adminId: string
  adminEmail?: string | null
  targetId: string
  targetEmail?: string | null
  startedAt: string
}

type ExchangePayload = {
  tokenHash: string
  next: string
  exp: number
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

function getImpersonationSecret(): string {
  const dedicated = process.env.IMPERSONATION_COOKIE_SECRET?.trim()
  if (dedicated && dedicated.length >= 16) return dedicated
  const exportSecret = process.env.DATA_EXPORT_DOWNLOAD_SECRET?.trim()
  if (exportSecret && exportSecret.length >= 16) return exportSecret
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (service && service.length >= 16) return service
  throw new Error('IMPERSONATION_COOKIE_SECRET (oder DATA_EXPORT_DOWNLOAD_SECRET) fehlt.')
}

function signValue(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function sealJson(payload: unknown): string {
  const secret = getImpersonationSecret()
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = signValue(body, secret)
  return `${body}.${sig}`
}

function openSealedJson<T>(raw: string): T | null {
  try {
    const secret = getImpersonationSecret()
    const [body, sig] = raw.split('.')
    if (!body || !sig) return null
    const expected = signValue(body, secret)
    const a = Buffer.from(sig, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}

async function setImpersonationCookie(payload: ImpersonationCookiePayload) {
  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, sealJson(payload), {
    ...cookieBase,
    maxAge: 60 * 60 * 4,
  })
}

async function clearImpersonationCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATION_COOKIE)
}

export async function setImpersonationExchangeCookie(args: {
  tokenHash: string
  next: string
}) {
  const cookieStore = await cookies()
  const payload: ExchangePayload = {
    tokenHash: args.tokenHash,
    next: args.next,
    exp: Math.floor(Date.now() / 1000) + 120,
  }
  cookieStore.set(IMPERSONATION_EXCHANGE_COOKIE, sealJson(payload), {
    ...cookieBase,
    maxAge: 120,
  })
}

/** Liest und löscht den einmaligen Exchange-Cookie (token_hash). */
export async function consumeImpersonationExchange(): Promise<ExchangePayload | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_EXCHANGE_COOKIE)?.value
  cookieStore.delete(IMPERSONATION_EXCHANGE_COOKIE)
  if (!raw) return null
  const parsed = openSealedJson<ExchangePayload>(raw)
  if (!parsed?.tokenHash || !parsed.next || !parsed.exp) return null
  if (Math.floor(Date.now() / 1000) > parsed.exp) return null
  if (!parsed.next.startsWith('/') || parsed.next.startsWith('//')) return null
  return parsed
}

async function readSignedImpersonationCookie(): Promise<ImpersonationCookiePayload | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!raw) return null
  const parsed = openSealedJson<ImpersonationCookiePayload>(raw)
  if (!parsed?.adminId || !parsed?.targetId) return null
  if (!isAdminUserId(parsed.adminId)) return null
  return parsed
}

/**
 * Bereitet Impersonation vor und liefert den token_hash (nur serverseitig weiterreichen).
 */
export async function prepareImpersonation(userId: string): Promise<
  { ok: true; tokenHash: string; next: string } | { ok: false; redirectTo: string }
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

  await setImpersonationCookie({
    adminId: admin.userId,
    adminEmail: admin.email,
    targetId: userId,
    targetEmail: userRes.user.email,
    startedAt: new Date().toISOString(),
  })

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'impersonation.start',
    metadata: { targetEmail: userRes.user.email },
  })

  return { ok: true, tokenHash, next: '/dashboard' }
}

export async function getActiveImpersonation(): Promise<ImpersonationCookiePayload | null> {
  const parsed = await readSignedImpersonationCookie()
  if (!parsed) return null
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== parsed.targetId) return null
  return parsed
}

/**
 * Beendet Impersonation nur, wenn die aktuelle Session der Target-User ist.
 * Liefert token_hash zum Wiedereinloggen als Admin.
 */
export async function prepareEndImpersonation(): Promise<
  { ok: true; tokenHash: string; next: string } | { ok: false; redirectTo: string }
> {
  const parsed = await readSignedImpersonationCookie()
  if (!parsed) {
    return { ok: false, redirectTo: '/login?hint=impersonation_ended' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== parsed.targetId) {
    await clearImpersonationCookie()
    return { ok: false, redirectTo: '/login?hint=impersonation_ended' }
  }

  const adminId = parsed.adminId
  const targetId = parsed.targetId
  let adminEmail = parsed.adminEmail?.trim() || null

  await clearImpersonationCookie()

  await logAdminAuditEvent({
    actorUserId: adminId,
    targetUserId: targetId,
    action: 'impersonation.end',
  })

  if (!isAdminUserId(adminId)) {
    return { ok: false, redirectTo: '/login?hint=impersonation_ended' }
  }

  const db = createSupabaseServiceRoleClient()
  if (!adminEmail) {
    const { data } = await db.auth.admin.getUserById(adminId)
    adminEmail = data.user?.email ?? null
  }
  if (!adminEmail) {
    return { ok: false, redirectTo: '/login?hint=impersonation_ended' }
  }

  const { data: linkRes, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  })
  const tokenHash = linkRes?.properties?.hashed_token
  if (linkErr || !tokenHash) {
    return { ok: false, redirectTo: '/login?hint=impersonation_ended' }
  }

  return { ok: true, tokenHash, next: `/admin/users/${targetId}` }
}
