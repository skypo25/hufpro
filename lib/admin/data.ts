import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import type { BillingAccountRow } from '@/lib/billing/types'
import { displayNameFromAuth, professionLabelFromSettings } from '@/lib/admin/labels'

export type AdminBillingBucket =
  | 'active'
  | 'trialing'
  | 'trial'
  | 'trial_expired'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'none'

export function billingBucketFromAccount(
  row: Pick<
    BillingAccountRow,
    'subscription_status' | 'trial_ends_at'
  > | null
): AdminBillingBucket {
  if (!row) return 'none'
  const s = String(row.subscription_status ?? '').toLowerCase()
  if (s === 'past_due') return 'past_due'
  if (s === 'unpaid') return 'unpaid'
  if (s === 'canceled') return 'canceled'
  if (s === 'active') return 'active'
  if (s === 'trialing') return 'trialing'

  const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null
  const now = new Date()
  if (trialEnd && !Number.isNaN(trialEnd.getTime()) && trialEnd > now) return 'trial'
  if (trialEnd && trialEnd <= now) return 'trial_expired'
  return 'none'
}

export function billingBucketLabel(bucket: AdminBillingBucket): string {
  switch (bucket) {
    case 'active':
      return 'Abo aktiv'
    case 'trialing':
      return 'Stripe · trialing'
    case 'trial':
      return 'Trial'
    case 'trial_expired':
      return 'Trial abgelaufen'
    case 'past_due':
      return 'Past Due'
    case 'unpaid':
      return 'Zahlung fehlgeschlagen'
    case 'canceled':
      return 'Gekündigt'
    default:
      return 'Kein Abo'
  }
}

async function listAllAuthUsers(): Promise<User[]> {
  const admin = createSupabaseServiceRoleClient()
  const out: User[] = []
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`)
    const batch = data?.users ?? []
    out.push(...batch)
    if (batch.length < perPage) break
    page += 1
  }
  return out
}

export async function fetchAdminGlobalCounts() {
  const db = createSupabaseServiceRoleClient()
  const [
    docRes,
    hoofRes,
    photoRes,
    horseRes,
    billingRows,
  ] = await Promise.all([
    db.from('documentation_records').select('*', { count: 'exact', head: true }),
    db.from('hoof_records').select('*', { count: 'exact', head: true }),
    db.from('hoof_photos').select('*', { count: 'exact', head: true }),
    db.from('horses').select('*', { count: 'exact', head: true }),
    db.from('billing_accounts').select('subscription_status, trial_ends_at'),
  ])

  if (docRes.error) throw new Error(docRes.error.message)
  if (hoofRes.error) throw new Error(hoofRes.error.message)
  if (photoRes.error) throw new Error(photoRes.error.message)
  if (horseRes.error) throw new Error(horseRes.error.message)
  if (billingRows.error) throw new Error(billingRows.error.message)

  const users = await listAllAuthUsers()
  const billingList = (billingRows.data ?? []) as Pick<
    BillingAccountRow,
    'subscription_status' | 'trial_ends_at'
  >[]

  let activeSubs = 0
  let trialLike = 0
  let problems = 0
  for (const b of billingList) {
    const bucket = billingBucketFromAccount(b)
    if (bucket === 'active') activeSubs += 1
    if (bucket === 'trialing' || bucket === 'trial') trialLike += 1
    if (bucket === 'past_due' || bucket === 'unpaid') problems += 1
  }

  const professionCounts: Record<string, number> = {}
  const { data: settingsRows } = await db.from('user_settings').select('user_id, settings')
  if (settingsRows) {
    for (const row of settingsRows) {
      const label = professionLabelFromSettings(row.settings as Record<string, unknown>)
      if (label === '—') continue
      professionCounts[label] = (professionCounts[label] ?? 0) + 1
    }
  }

  const sortedProfessions = Object.entries(professionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const recentUsers = [...users]
    .sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime()
      const tb = new Date(b.created_at ?? 0).getTime()
      return tb - ta
    })
    .slice(0, 5)

  const recentEnriched = await Promise.all(
    recentUsers.map(async (u) => {
      const { data: s } = await db
        .from('user_settings')
        .select('settings')
        .eq('user_id', u.id)
        .maybeSingle()
      const settings = (s?.settings ?? null) as Record<string, unknown> | null
      const name = displayNameFromAuth(u.email, u.user_metadata as { first_name?: string; last_name?: string }, settings)
      const prof = professionLabelFromSettings(settings)
      const { data: bill } = await db
        .from('billing_accounts')
        .select('subscription_status, trial_ends_at')
        .eq('user_id', u.id)
        .maybeSingle()
      const bucket = billingBucketFromAccount(bill as BillingAccountRow | null)
      return {
        id: u.id,
        name,
        profession: prof,
        bucket,
        created_at: u.created_at,
      }
    })
  )

  const webhookRecent = await db
    .from('stripe_webhook_events')
    .select('event_id, event_type, received_at')
    .order('received_at', { ascending: false })
    .limit(12)

  return {
    totalUsers: users.length,
    activeSubscriptions: activeSubs,
    trialUsers: trialLike,
    billingProblems: problems,
    documentationRecords: docRes.count ?? 0,
    hoofRecords: hoofRes.count ?? 0,
    hoofPhotos: photoRes.count ?? 0,
    horses: horseRes.count ?? 0,
    professionBars: sortedProfessions,
    recentRegistrations: recentEnriched,
    webhookRows: webhookRecent.data ?? [],
    webhookError: webhookRecent.error?.message ?? null,
  }
}

export type AdminUserListSort =
  | 'last_login_desc'
  | 'name_asc'
  | 'created_desc'
  | 'created_asc'
  | 'docs_desc'
  | 'horses_desc'
  | 'storage_desc'

const ADMIN_USER_SORTS: AdminUserListSort[] = [
  'last_login_desc',
  'name_asc',
  'created_desc',
  'created_asc',
  'docs_desc',
  'horses_desc',
  'storage_desc',
]

export function parseAdminUserListSort(raw: string | undefined | null): AdminUserListSort {
  const s = (raw ?? '').trim()
  return ADMIN_USER_SORTS.includes(s as AdminUserListSort) ? (s as AdminUserListSort) : 'last_login_desc'
}

export type AdminUserListRow = {
  id: string
  name: string
  email: string
  created_at: string | null
  last_sign_in_at: string | null
  profession: string
  billingBucket: AdminBillingBucket
  horseCount: number
  docCount: number
  storageBytes: number
  billing: BillingAccountRow | null
}

export type AdminUserDirectoryStats = {
  total: number
  active: number
  trialing: number
  trial: number
  trial_expired: number
  past_due: number
  canceled: number
}

async function fetchAdminUserDirectoryStatsInner(): Promise<AdminUserDirectoryStats> {
  const db = createSupabaseServiceRoleClient()
  const users = await listAllAuthUsers()
  const ids = users.map((u) => u.id)
  const billingMap = new Map<string, BillingAccountRow>()
  if (ids.length) {
    const { data: bills, error } = await db.from('billing_accounts').select('*').in('user_id', ids)
    if (error) throw new Error(error.message)
    for (const b of (bills ?? []) as BillingAccountRow[]) {
      billingMap.set(b.user_id, b)
    }
  }

  const out: AdminUserDirectoryStats = {
    total: users.length,
    active: 0,
    trialing: 0,
    trial: 0,
    trial_expired: 0,
    past_due: 0,
    canceled: 0,
  }

  for (const u of users) {
    const bucket = billingBucketFromAccount(billingMap.get(u.id) ?? null)
    switch (bucket) {
      case 'active':
        out.active += 1
        break
      case 'trialing':
        out.trialing += 1
        break
      case 'trial':
        out.trial += 1
        break
      case 'trial_expired':
        out.trial_expired += 1
        break
      case 'past_due':
      case 'unpaid':
        out.past_due += 1
        break
      case 'canceled':
        out.canceled += 1
        break
      default:
        break
    }
  }

  return out
}

/** Kennzahlen für Admin-Nutzerliste (ein Request pro Seitenaufruf, gecacht). */
export const fetchAdminUserDirectoryStats = cache(fetchAdminUserDirectoryStatsInner)

async function countForUser(
  table: 'hoof_records' | 'hoof_photos' | 'horses' | 'customers' | 'invoices',
  userId: string
): Promise<number> {
  const db = createSupabaseServiceRoleClient()
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

function sortAdminUserRows(rows: AdminUserListRow[], sort: AdminUserListSort): AdminUserListRow[] {
  const copy = [...rows]
  copy.sort((a, b) => {
    switch (sort) {
      case 'name_asc':
        return a.name.localeCompare(b.name, 'de')
      case 'created_asc': {
        const ta = new Date(a.created_at ?? 0).getTime()
        const tb = new Date(b.created_at ?? 0).getTime()
        return ta - tb
      }
      case 'created_desc': {
        const ta = new Date(a.created_at ?? 0).getTime()
        const tb = new Date(b.created_at ?? 0).getTime()
        return tb - ta
      }
      case 'docs_desc':
        return b.docCount - a.docCount
      case 'horses_desc':
        return b.horseCount - a.horseCount
      case 'storage_desc':
        return b.storageBytes - a.storageBytes
      case 'last_login_desc':
      default: {
        const ta = new Date(a.last_sign_in_at ?? 0).getTime()
        const tb = new Date(b.last_sign_in_at ?? 0).getTime()
        return tb - ta
      }
    }
  })
  return copy
}

export async function fetchAdminUserList(args: {
  q?: string
  billing?: string
  sort?: AdminUserListSort
}): Promise<AdminUserListRow[]> {
  const db = createSupabaseServiceRoleClient()
  const users = await listAllAuthUsers()
  const ids = users.map((u) => u.id)

  const billingMap = new Map<string, BillingAccountRow>()
  if (ids.length) {
    const { data: bills, error } = await db.from('billing_accounts').select('*').in('user_id', ids)
    if (error) throw new Error(error.message)
    for (const b of (bills ?? []) as BillingAccountRow[]) {
      billingMap.set(b.user_id, b)
    }
  }

  const settingsMap = new Map<string, Record<string, unknown>>()
  if (ids.length) {
    const { data: sets } = await db.from('user_settings').select('user_id, settings').in('user_id', ids)
    for (const row of sets ?? []) {
      settingsMap.set(row.user_id, (row.settings ?? {}) as Record<string, unknown>)
    }
  }

  const horseCounts = new Map<string, number>()
  const docCounts = new Map<string, number>()
  const storageBytes = new Map<string, number>()
  const chunk = 80
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk)
    const [rRes, dRes, hpRes, dpRes] = await Promise.all([
      db.from('horses').select('user_id').in('user_id', slice),
      db.from('documentation_records').select('user_id').in('user_id', slice),
      db.from('hoof_photos').select('user_id, file_size').in('user_id', slice),
      db.from('documentation_photos').select('user_id, file_size').in('user_id', slice),
    ])
    if (rRes.error) throw new Error(rRes.error.message)
    if (dRes.error) throw new Error(dRes.error.message)
    if (hpRes.error) throw new Error(hpRes.error.message)
    // Optional: some environments may not have documentation_photos yet.
    // Treat missing table as "0 bytes" rather than breaking the admin list.
    if (dpRes.error) {
      const code = (dpRes.error as any)?.code as string | undefined
      const msg = (dpRes.error as any)?.message as string | undefined
      const missing = code === '42P01' || (msg ?? '').toLowerCase().includes('does not exist')
      if (!missing) throw new Error(dpRes.error.message)
    }
    for (const row of rRes.data ?? []) {
      const uid = row.user_id as string
      horseCounts.set(uid, (horseCounts.get(uid) ?? 0) + 1)
    }
    for (const row of dRes.data ?? []) {
      const uid = row.user_id as string
      docCounts.set(uid, (docCounts.get(uid) ?? 0) + 1)
    }
    const addBytes = (uid: string, sz: number | null) => {
      const n = typeof sz === 'number' && !Number.isNaN(sz) ? sz : 0
      storageBytes.set(uid, (storageBytes.get(uid) ?? 0) + n)
    }
    for (const row of hpRes.data ?? []) {
      addBytes(row.user_id as string, row.file_size as number | null)
    }
    for (const row of dpRes.data ?? []) {
      addBytes(row.user_id as string, row.file_size as number | null)
    }
  }

  const q = (args.q ?? '').trim().toLowerCase()
  const billingFilter = (args.billing ?? 'all').trim().toLowerCase()
  const sort: AdminUserListSort = args.sort ?? 'last_login_desc'

  const rows: AdminUserListRow[] = []
  for (const u of users) {
    const settings = settingsMap.get(u.id) ?? null
    const name = displayNameFromAuth(u.email, u.user_metadata as { first_name?: string; last_name?: string }, settings)
    const bill = billingMap.get(u.id) ?? null
    const bucket = billingBucketFromAccount(bill)
    const email = u.email ?? ''

    if (q) {
      const hay = `${name} ${email} ${u.id}`.toLowerCase()
      if (!hay.includes(q)) continue
    }

    if (billingFilter !== 'all') {
      if (billingFilter === 'active' && bucket !== 'active') continue
      if (billingFilter === 'trial' && bucket !== 'trial' && bucket !== 'trialing') continue
      if (billingFilter === 'trial_expired' && bucket !== 'trial_expired') continue
      if (billingFilter === 'past_due' && bucket !== 'past_due' && bucket !== 'unpaid') continue
      if (billingFilter === 'canceled' && bucket !== 'canceled') continue
    }

    rows.push({
      id: u.id,
      name,
      email,
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      profession: professionLabelFromSettings(settings),
      billingBucket: bucket,
      horseCount: horseCounts.get(u.id) ?? 0,
      docCount: docCounts.get(u.id) ?? 0,
      storageBytes: storageBytes.get(u.id) ?? 0,
      billing: bill,
    })
  }

  return sortAdminUserRows(rows, sort)
}

export async function fetchAdminUserDetail(userId: string) {
  const db = createSupabaseServiceRoleClient()
  const { data: userData, error: userErr } = await db.auth.admin.getUserById(userId)
  if (userErr) throw new Error(userErr.message)
  const u = userData.user
  if (!u) return null

  const { data: settingsRow } = await db
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle()
  const settings = (settingsRow?.settings ?? null) as Record<string, unknown> | null

  const { data: bill } = await db.from('billing_accounts').select('*').eq('user_id', userId).maybeSingle()
  const billing = bill as BillingAccountRow | null

  const [hoofCount, photoCount, horseCount, customerCount, invoiceCount, docCount, bytes] = await Promise.all([
    countForUser('hoof_records', userId),
    countForUser('hoof_photos', userId),
    countForUser('horses', userId),
    countForUser('customers', userId),
    countForUser('invoices', userId),
    db
      .from('documentation_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then((r) => {
        if (r.error) throw new Error(r.error.message)
        return r.count ?? 0
      }),
    (async () => {
      const [hp, dp] = await Promise.all([
        db.from('hoof_photos').select('file_size').eq('user_id', userId),
        db.from('documentation_photos').select('file_size').eq('user_id', userId),
      ])
      if (hp.error) throw new Error(hp.error.message)
      // Optional table: documentation_photos might not exist everywhere yet.
      if (dp.error) {
        const code = (dp.error as any)?.code as string | undefined
        const msg = (dp.error as any)?.message as string | undefined
        const missing = code === '42P01' || (msg ?? '').toLowerCase().includes('does not exist')
        if (!missing) throw new Error(dp.error.message)
      }
      const sum = (rows: any[] | null | undefined) =>
        (rows ?? []).reduce((s, r) => s + (typeof r.file_size === 'number' ? r.file_size : 0), 0)
      return sum(hp.data as any[]) + sum(dp.data as any[])
    })(),
  ])

  const name = displayNameFromAuth(u.email, u.user_metadata as { first_name?: string; last_name?: string }, settings)
  const profession = professionLabelFromSettings(settings)
  const bucket = billingBucketFromAccount(billing)

  const metaRes = await db
    .from('admin_user_meta')
    .select('admin_note, feature_flags, updated_at, updated_by')
    .eq('user_id', userId)
    .maybeSingle()

  // Optional table (new): if migration isn't applied yet, don't break user detail.
  if (metaRes.error) {
    const code = (metaRes.error as any)?.code as string | undefined
    const msg = (metaRes.error as any)?.message as string | undefined
    const missing = code === '42P01' || (msg ?? '').toLowerCase().includes('does not exist')
    if (!missing) throw new Error(metaRes.error.message)
  }
  const metaRow = metaRes.data ?? null

  return {
    user: u,
    name,
    profession,
    settings,
    billing,
    billingBucket: bucket,
    adminMeta: (metaRow ?? null) as
      | {
          admin_note: string | null
          feature_flags: Record<string, unknown> | null
          updated_at: string | null
          updated_by: string | null
        }
      | null,
    storageBytes: bytes,
    counts: {
      documentationRecords: docCount,
      hoofRecords: hoofCount,
      hoofPhotos: photoCount,
      horses: horseCount,
      customers: customerCount,
      invoices: invoiceCount,
    },
  }
}
