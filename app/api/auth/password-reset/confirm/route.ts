import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { token?: string; password?: string }
      | null
    const token = String(body?.token ?? '').trim()
    const password = String(body?.password ?? '').trim()

    if (!token || token.length < 20) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ ok: false, error: 'weak_password' }, { status: 400 })
    }

    const db = createSupabaseServiceRoleClient()
    const tokenHash = sha256Hex(token)
    const nowIso = new Date().toISOString()

    const { data: row } = await db
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    const expiresAt = row?.expires_at ? new Date(row.expires_at) : null
    const isExpired = !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()

    if (!row?.id || row.used_at || isExpired) {
      return NextResponse.json({ ok: false, error: 'invalid_or_expired' }, { status: 400 })
    }

    const { error: authErr } = await db.auth.admin.updateUserById(row.user_id, { password })
    if (authErr) {
      return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
    }

    await db
      .from('password_reset_tokens')
      .update({ used_at: nowIso })
      .eq('id', row.id)
      .is('used_at', null)

    // Optional: invalidate other unused tokens for that user.
    await db
      .from('password_reset_tokens')
      .update({ used_at: nowIso })
      .eq('user_id', row.user_id)
      .is('used_at', null)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}

