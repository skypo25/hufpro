import AdminNextLink from '@/components/admin/AdminNextLink'
import { adminCardClass } from '@/components/admin/adminStyles'
import AppPage from '@/components/layout/AppPage'
import PageHeader from '@/components/ui/PageHeader'
import {
  adminAuditActionLabel,
  fetchAdminAuditEvents,
} from '@/lib/admin/auditData'
import { formatGermanDateTime } from '@/lib/format'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    page?: string
    action?: string
    target?: string
  }>
}

async function resolveEmails(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return {}
  const db = createSupabaseServiceRoleClient()
  const out: Record<string, string> = {}
  // Admin API hat kein bulk-get by ids in allen Versionen — einzeln, begrenzt.
  await Promise.all(
    unique.slice(0, 40).map(async (id) => {
      try {
        const { data, error } = await db.auth.admin.getUserById(id)
        if (!error && data.user?.email) out[id] = data.user.email
      } catch {
        // ignore
      }
    })
  )
  return out
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const pageRaw = Number(sp.page || '1')
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const perPage = 40
  const action = (sp.action || '').trim()
  const target = (sp.target || '').trim()

  let rows: Awaited<ReturnType<typeof fetchAdminAuditEvents>>['rows'] = []
  let total = 0
  let loadError: string | null = null
  try {
    const res = await fetchAdminAuditEvents({
      limit: perPage,
      offset: (page - 1) * perPage,
      action: action || undefined,
      targetUserId: target || undefined,
    })
    rows = res.rows
    total = res.total
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Audit-Log konnte nicht geladen werden.'
  }

  const emailMap = await resolveEmails(
    rows.flatMap((r) => [r.actor_user_id, r.target_user_id].filter(Boolean) as string[])
  )

  const totalPages = Math.max(1, Math.ceil(total / perPage) || 1)
  const safePage = Math.min(page, totalPages)

  function hrefFor(p: number) {
    const params = new URLSearchParams()
    if (p > 1) params.set('page', String(p))
    if (action) params.set('action', action)
    if (target) params.set('target', target)
    const q = params.toString()
    return `/admin/audit${q ? `?${q}` : ''}`
  }

  return (
    <AppPage>
      <PageHeader
        title="Audit-Log"
        description="Protokoll der Admin-Aktionen (Trials, Flags, Ban, Claims, Impersonation …)."
        actions={<span className="text-[13px] text-text-secondary">{total} Einträge</span>}
      />

      <form method="get" className={`${adminCardClass} flex flex-wrap items-end gap-3 p-4`}>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Aktion
          </label>
          <input
            name="action"
            defaultValue={action}
            placeholder="z. B. feature_flag.toggle"
            className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] text-[#1B1F23] outline-none focus:border-primary"
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Ziel-Nutzer-ID
          </label>
          <input
            name="target"
            defaultValue={target}
            placeholder="UUID"
            className="w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 font-mono text-[12px] text-[#1B1F23] outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-[#E5E2DC] bg-white px-4 py-2 text-[13px] font-medium text-[#1B1F23] hover:border-primary"
        >
          Filtern
        </button>
        {(action || target) && (
          <AdminNextLink
            href="/admin/audit"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#6B7280] hover:text-primary"
          >
            Zurücksetzen
          </AdminNextLink>
        )}
      </form>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
          {loadError}
        </div>
      ) : null}

      <div className={`${adminCardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="px-4 py-3">Zeit</th>
                <th className="px-4 py-3">Aktion</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Ziel</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EEEA]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#6B7280]">
                    Keine Einträge.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const meta =
                    row.metadata && typeof row.metadata === 'object'
                      ? JSON.stringify(row.metadata)
                      : null
                  return (
                    <tr key={row.id} className="align-top hover:bg-[rgba(1,85,85,0.03)]">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[12px] text-[#6B7280]">
                        {formatGermanDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1B1F23]">
                          {adminAuditActionLabel(row.action)}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-[#9CA3AF]">{row.action}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {row.actor_user_id ? (
                          <>
                            <div className="text-[#1B1F23]">
                              {emailMap[row.actor_user_id] ?? '—'}
                            </div>
                            <div className="font-mono text-[11px] text-[#9CA3AF]">
                              {row.actor_user_id.slice(0, 8)}…
                            </div>
                          </>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {row.target_user_id ? (
                          <>
                            <AdminNextLink
                              href={`/admin/users/${row.target_user_id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {emailMap[row.target_user_id] ?? 'Nutzer'}
                            </AdminNextLink>
                            <div className="font-mono text-[11px] text-[#9CA3AF]">
                              {row.target_user_id.slice(0, 8)}…
                            </div>
                          </>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-[12px] text-[#6B7280]">
                        {row.message ? <div className="mb-1">{row.message}</div> : null}
                        {meta ? (
                          <code className="block overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[#F3F4F6] px-1.5 py-0.5 font-mono text-[11px] text-[#374151]">
                            {meta}
                          </code>
                        ) : null}
                        {!row.message && !meta ? '—' : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[#E5E2DC] px-4 py-3 text-[13px] text-[#6B7280]">
            <span>
              Seite {safePage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <AdminNextLink
                href={hrefFor(Math.max(1, safePage - 1))}
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-1.5 font-medium text-[#1B1F23] hover:border-primary"
              >
                Zurück
              </AdminNextLink>
              <AdminNextLink
                href={hrefFor(Math.min(totalPages, safePage + 1))}
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-1.5 font-medium text-[#1B1F23] hover:border-primary"
              >
                Weiter
              </AdminNextLink>
            </div>
          </div>
        ) : null}
      </div>
    </AppPage>
  )
}
