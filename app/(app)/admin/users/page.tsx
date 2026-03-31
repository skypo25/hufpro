import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  fetchAdminUserDirectoryStats,
  fetchAdminUserList,
  parseAdminUserListSort,
  type AdminUserListSort,
} from '@/lib/admin/data'
import { formatGermanDate, formatStorageBytesShort, daysBetweenFloor } from '@/lib/format'
import { formatAdminLastActivity } from '@/lib/admin/lastActivity'
import {
  adminBillingPrimarySecondary,
  avatarColorForUserId,
  professionBadgeClass,
  statusBadgeForBucket,
} from '@/lib/admin/userListDisplay'
import AdminUsersSortSelect from '@/components/admin/AdminUsersSortSelect'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string; billing?: string; sort?: string; page?: string }>
}

const PER_PAGE = 20

const FILTERS: { id: string; label: string; dot?: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'active', label: 'Aktiv', dot: 'accent' },
  { id: 'trial', label: 'Trial', dot: 'blue' },
  { id: 'trial_expired', label: 'Expired', dot: 'orange' },
  { id: 'past_due', label: 'Past Due', dot: 'danger' },
  { id: 'canceled', label: 'Gekündigt', dot: 'muted' },
]

function usersHref(args: {
  q: string
  billing: string
  sort: AdminUserListSort
  page?: number
}) {
  const p = new URLSearchParams()
  if (args.q.trim()) p.set('q', args.q.trim())
  if (args.billing !== 'all') p.set('billing', args.billing)
  if (args.sort !== 'last_login_desc') p.set('sort', args.sort)
  if (args.page && args.page > 1) p.set('page', String(args.page))
  const s = p.toString()
  return `/admin/users${s ? `?${s}` : ''}`
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const billing = sp.billing ?? 'all'
  const sort = parseAdminUserListSort(sp.sort)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  let rows: Awaited<ReturnType<typeof fetchAdminUserList>> = []
  let stats: Awaited<ReturnType<typeof fetchAdminUserDirectoryStats>> | null = null
  let err: string | null = null
  try {
    ;[rows, stats] = await Promise.all([
      fetchAdminUserList({ q, billing, sort }),
      fetchAdminUserDirectoryStats(),
    ])
  } catch (e) {
    err = e instanceof Error ? e.message : 'Liste konnte nicht geladen werden.'
  }

  if (err) {
    return (
      <main className="mx-auto w-full max-w-[1280px] space-y-7 pb-10">
        <PageHeader title="Nutzer" description="Admin · interne Übersicht" />
        <EmptyState
          title="Fehler"
          description={err}
          className="border-red-200 bg-red-50"
        />
      </main>
    )
  }

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PER_PAGE
  const pageRows = rows.slice(start, start + PER_PAGE)
  const now = new Date()

  const kpis = stats
    ? [
        { key: 'total', label: 'Gesamt', value: stats.total, color: '' as const },
        { key: 'active', label: 'Abo aktiv', value: stats.active, color: 'green' as const },
        { key: 'trial', label: 'Trial', value: stats.trial + stats.trialing, color: 'blue' as const },
        { key: 'expired', label: 'Trial expired', value: stats.trial_expired, color: 'orange' as const },
        { key: 'past', label: 'Past Due', value: stats.past_due, color: 'red' as const },
        { key: 'canceled', label: 'Gekündigt', value: stats.canceled, color: 'muted' as const },
      ]
    : []

  return (
    <main className="mx-auto w-full max-w-[1280px] space-y-7 pb-10">
      <PageHeader
        title="Nutzer"
        description={
          stats
            ? `${stats.total} Nutzer · ${stats.active} aktiv · ${stats.trial + stats.trialing} Trial · ${stats.past_due} Past Due`
            : 'Alle registrierten Nutzer und deren Abo-Status verwalten'
        }
      />

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => {
            const valColor =
              k.color === 'green'
                ? 'text-[#52b788]'
                : k.color === 'blue'
                  ? 'text-[#3B82F6]'
                  : k.color === 'orange'
                    ? 'text-[#F97316]'
                    : k.color === 'red'
                      ? 'text-[#DC2626]'
                      : k.color === 'muted'
                        ? 'text-[#9CA3AF]'
                        : 'text-[#1B1F23]'
            return (
              <section key={k.key} className="huf-card p-[18px]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                  {k.label}
                </div>
                <div className={`mt-1 text-[28px] font-semibold leading-none ${valColor}`}>{k.value}</div>
              </section>
            )
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <form method="get" className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <input type="hidden" name="billing" value={billing} />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="page" value={String(safePage)} />

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5">
              <i className="bi bi-search text-[15px] text-[#9CA3AF]" aria-hidden />
              <input
                name="q"
                defaultValue={q}
                placeholder="Name, E-Mail oder UUID…"
                className="w-full border-0 bg-transparent text-[14px] text-[#1B1F23] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-[#52b788]"
            >
              Suchen
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = billing === f.id
              const href = usersHref({ q, billing: f.id, sort, page: 1 })
              const count =
                f.id === 'all'
                  ? stats?.total ?? 0
                  : f.id === 'active'
                    ? stats?.active ?? 0
                    : f.id === 'trial'
                      ? (stats?.trial ?? 0) + (stats?.trialing ?? 0)
                      : f.id === 'trial_expired'
                        ? stats?.trial_expired ?? 0
                        : f.id === 'past_due'
                          ? stats?.past_due ?? 0
                          : f.id === 'canceled'
                            ? stats?.canceled ?? 0
                            : 0
              const dotClass =
                f.dot === 'accent'
                  ? 'text-[#52b788]'
                  : f.dot === 'blue'
                    ? 'text-[#3B82F6]'
                    : f.dot === 'orange'
                      ? 'text-[#F97316]'
                      : f.dot === 'danger'
                        ? 'text-[#DC2626]'
                        : f.dot === 'muted'
                          ? 'text-[#9CA3AF]'
                          : ''
              return (
                <Link
                  key={f.id}
                  href={href}
                  className={[
                    'inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition',
                    active
                      ? 'border-[#52b788] bg-[rgba(82,183,136,.08)] text-[#1B1F23]'
                      : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#52b788]',
                  ].join(' ')}
                >
                  {f.dot ? <i className={`bi bi-circle-fill text-[6px] ${dotClass}`} aria-hidden /> : null}
                  {f.label} <span className="text-[#9CA3AF]">({count})</span>
                </Link>
              )
            })}
          </div>
          <AdminUsersSortSelect value={sort} q={q} billing={billing} />
        </div>
      </div>

      <div className="text-[14px] text-[#6B7280]">
        <span>
          Zeige{' '}
          <strong className="font-medium text-[#1B1F23]">
            {total === 0 ? '0' : `${start + 1}–${Math.min(start + PER_PAGE, total)}`}
          </strong>{' '}
          von <strong className="font-medium text-[#1B1F23]">{total}</strong> Nutzern
        </span>
      </div>

      <div className="huf-card">
        <div className="grid grid-cols-[minmax(0,1.35fr)_150px_120px_220px_140px_140px_200px_68px] items-center gap-3 border-b-2 border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-[22px] py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] max-[1100px]:grid-cols-[minmax(0,1.35fr)_150px_220px_140px_200px_68px] max-[1100px]:[&>*:nth-child(3)]:hidden max-[1100px]:[&>*:nth-child(6)]:hidden max-[900px]:grid-cols-[minmax(0,1fr)_220px_200px_68px] max-[900px]:[&>*:nth-child(2)]:hidden max-[900px]:[&>*:nth-child(5)]:hidden max-[900px]:[&>*:nth-child(6)]:hidden">
          <div>Nutzer</div>
          <div>Beruf</div>
          <div>Status</div>
          <div>Billing</div>
          <div>Registriert</div>
          <div>Aktivität</div>
          <div>Nutzung</div>
          <div></div>
        </div>

        {pageRows.map((r, i) => {
              const ordinal = start + i + 1
              const initials = r.name
                .split(/\s+/)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
              const av = avatarColorForUserId(r.id)
              const created = r.created_at ? new Date(r.created_at) : null
              const regDays =
                created && !Number.isNaN(created.getTime()) ? daysBetweenFloor(created, now) : null
              const activity = formatAdminLastActivity(r.last_sign_in_at, now)
              const billLines = adminBillingPrimarySecondary(r, now)
              const st = statusBadgeForBucket(r.billingBucket)
              const stripeUrl = r.billing?.stripe_customer_id
                ? `https://dashboard.stripe.com/customers/${r.billing.stripe_customer_id}`
                : null
              const rowTint =
                r.billingBucket === 'past_due' || r.billingBucket === 'unpaid'
                  ? 'bg-[rgba(220,38,38,.012)]'
                  : r.billingBucket === 'trial_expired'
                    ? 'bg-[rgba(249,115,22,.01)]'
                    : ''

              const dotClass =
                activity.dot === 'online'
                  ? 'bg-[#52b788]'
                  : activity.dot === 'recent'
                    ? 'bg-[#3B82F6]'
                    : 'bg-[#E5E2DC]'

              return (
                <div
                  key={r.id}
                  className={`relative grid grid-cols-[minmax(0,1.35fr)_150px_120px_220px_140px_140px_200px_68px] items-center gap-3 border-b border-[#E5E2DC] px-[22px] py-[14px] transition hover:bg-[rgba(21,66,38,0.03)] last:border-b-0 max-[1100px]:grid-cols-[minmax(0,1.35fr)_150px_220px_140px_200px_68px] max-[1100px]:[&>*:nth-child(3)]:hidden max-[1100px]:[&>*:nth-child(6)]:hidden max-[900px]:grid-cols-[minmax(0,1fr)_220px_200px_68px] max-[900px]:[&>*:nth-child(2)]:hidden max-[900px]:[&>*:nth-child(5)]:hidden max-[900px]:[&>*:nth-child(6)]:hidden ${rowTint}`}
                >
                  <Link
                    href={`/admin/users/${r.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Nutzer ${r.name} öffnen`}
                  />

                  <div className="pointer-events-none flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                      style={{ background: av }}
                    >
                      {initials || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-[#1B1F23]">{r.name}</div>
                      <div className="truncate text-[12px] text-[#6B7280]">{r.email}</div>
                      <div className="font-[tabular-nums] text-[11px] text-[#9CA3AF]">USR-{String(ordinal).padStart(5, '0')}</div>
                    </div>
                  </div>

                  <div className="pointer-events-none">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium ${professionBadgeClass(r.profession)}`}>
                      {r.profession}
                    </span>
                  </div>

                  <div className="pointer-events-none">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${st.className}`}>
                      <i className={`bi ${st.icon} text-[11px]`} aria-hidden />
                      {st.label}
                    </span>
                  </div>

                  <div className="pointer-events-none min-w-0">
                    <div
                      className={`truncate text-[13px] font-medium ${
                        billLines.accent === 'blue'
                          ? 'text-[#3B82F6]'
                          : billLines.accent === 'orange'
                            ? 'text-[#F97316]'
                            : billLines.accent === 'danger'
                              ? 'text-[#DC2626]'
                              : billLines.accent === 'muted'
                                ? 'text-[#9CA3AF]'
                                : 'text-[#1B1F23]'
                      }`}
                    >
                      {billLines.primary}
                    </div>
                    <div className="truncate text-[12px] text-[#6B7280]">{billLines.secondary}</div>
                  </div>

                  <div className="pointer-events-none">
                    <div className="text-[13px] font-medium text-[#1B1F23]">
                      {r.created_at ? formatGermanDate(r.created_at) : '—'}
                    </div>
                    <div className="text-[12px] text-[#6B7280]">{regDays !== null ? `${regDays} Tage` : '—'}</div>
                  </div>

                  <div className="pointer-events-none flex items-center gap-2">
                    <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${dotClass}`} />
                    <span className="truncate text-[13px] text-[#6B7280]">{activity.text}</span>
                  </div>

                  <div className="pointer-events-none">
                    <div className="flex gap-4">
                      <div className="text-center">
                        <div className="text-[14px] font-semibold text-[#1B1F23]">{r.horseCount}</div>
                        <div className="text-[11px] text-[#6B7280]">Tiere</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-[14px] font-semibold ${r.docCount >= 40 ? 'text-[#52b788]' : 'text-[#1B1F23]'}`}>{r.docCount}</div>
                        <div className="text-[11px] text-[#6B7280]">Dokus</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[14px] font-semibold text-[#1B1F23]">{formatStorageBytesShort(r.storageBytes)}</div>
                        <div className="text-[11px] text-[#6B7280]">Speicher</div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-20 flex justify-end gap-1">
                    <Link
                      href={`/admin/users/${r.id}`}
                      className="pointer-events-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] hover:border-[#52b788] hover:text-[#52b788]"
                      title="Details"
                    >
                      <i className="bi bi-eye-fill text-[14px]" aria-hidden />
                    </Link>
                    {stripeUrl ? (
                      <a
                        href={stripeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={[
                          'pointer-events-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] hover:border-[#52b788] hover:text-[#52b788]',
                          r.billingBucket === 'past_due' || r.billingBucket === 'unpaid'
                            ? 'border-[rgba(220,38,38,.2)] text-[#DC2626] hover:border-[#DC2626] hover:text-[#DC2626]'
                            : '',
                        ].join(' ')}
                        title="Stripe"
                      >
                        <i className="bi bi-credit-card-fill text-[14px]" aria-hidden />
                      </a>
                    ) : null}
                    <a
                      href={`mailto:${encodeURIComponent(r.email)}`}
                      className="pointer-events-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] hover:border-[#52b788] hover:text-[#52b788]"
                      title="E-Mail"
                    >
                      <i className="bi bi-envelope-fill text-[14px]" aria-hidden />
                    </a>
                  </div>
                </div>
              )
            })}

        {pageRows.length === 0 ? (
          <EmptyState
            description="Keine Nutzer gefunden."
            className="rounded-none border-0 shadow-none"
          />
        ) : null}

        <div className="flex flex-col gap-3 border-t border-[#E5E2DC] px-[22px] py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-[14px] text-[#6B7280]">
            Zeige {total === 0 ? '0' : `${start + 1}–${Math.min(start + PER_PAGE, total)}`} von {total} Nutzern
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center gap-1">
              <PaginationLink
                disabled={safePage <= 1}
                href={usersHref({ q, billing, sort, page: safePage - 1 })}
                aria-label="Vorherige"
              >
                <i className="bi bi-chevron-left" aria-hidden />
              </PaginationLink>
              {paginationRange(safePage, totalPages).map((item, idx) =>
                item === '…' ? (
                  <span key={`e-${idx}`} className="inline-flex h-9 min-w-9 items-center justify-center px-3 text-[14px] text-[#9CA3AF]">
                    …
                  </span>
                ) : (
                  <PaginationLink
                    key={item}
                    href={usersHref({ q, billing, sort, page: item })}
                    active={item === safePage}
                  >
                    {item}
                  </PaginationLink>
                )
              )}
              <PaginationLink
                disabled={safePage >= totalPages}
                href={usersHref({ q, billing, sort, page: safePage + 1 })}
                aria-label="Nächste"
              >
                <i className="bi bi-chevron-right" aria-hidden />
              </PaginationLink>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function paginationRange(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set<number>()
  set.add(1)
  set.add(total)
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) set.add(p)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out: Array<number | '…'> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}

function PaginationLink(props: {
  href: string
  disabled?: boolean
  active?: boolean
  children: ReactNode
  'aria-label'?: string
}) {
  if (props.disabled) {
    return (
      <span className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md border border-[#E5E2DC] bg-white text-[12px] font-semibold text-[#9CA3AF] opacity-30">
        {props.children}
      </span>
    )
  }
  return (
    <Link
      href={props.href}
      aria-label={props['aria-label']}
      className={[
        'flex h-8 min-w-[32px] items-center justify-center rounded-md border border-[#E5E2DC] bg-white px-2 text-[12px] font-semibold transition',
        props.active ? 'border-[#52b788] bg-[#52b788] text-white' : 'text-[#6B7280] hover:border-[#9CA3AF]',
      ].join(' ')}
    >
      {props.children}
    </Link>
  )
}
