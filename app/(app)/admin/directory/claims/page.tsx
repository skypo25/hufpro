import AdminNextLink from '@/components/admin/AdminNextLink'
import {
  adminCardClass,
  adminMutedClass,
  adminPageTitleClass,
} from '@/components/admin/adminStyles'
import { fetchAdminDirectoryClaimsList, type DirectoryClaimStatus } from '@/lib/admin/directoryClaimsData'
import { formatGermanDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

function statusBadge(status: DirectoryClaimStatus) {
  const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide'
  switch (status) {
    case 'pending':
      return <span className={`${base} bg-amber-100 text-amber-900`}>Offen</span>
    case 'approved':
      return <span className={`${base} bg-emerald-100 text-emerald-900`}>Angenommen</span>
    case 'rejected':
      return <span className={`${base} bg-red-100 text-red-800`}>Abgelehnt</span>
    case 'withdrawn':
      return <span className={`${base} bg-[#F3F4F6] text-[#6B7280]`}>Zurückgezogen</span>
    default:
      return <span className={`${base} bg-[#F3F4F6] text-[#6B7280]`}>{status}</span>
  }
}

type PageProps = {
  searchParams: Promise<{ filter?: string }>
}

export default async function AdminDirectoryClaimsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filter = sp.filter === 'pending' ? 'pending' : sp.filter === 'done' ? 'done' : 'all'

  let rows: Awaited<ReturnType<typeof fetchAdminDirectoryClaimsList>> = []
  let loadError: string | null = null
  try {
    rows = await fetchAdminDirectoryClaimsList()
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Claims konnten nicht geladen werden.'
  }

  const filtered =
    filter === 'pending'
      ? rows.filter((r) => r.status === 'pending')
      : filter === 'done'
        ? rows.filter((r) => r.status !== 'pending')
        : rows

  const pendingCount = rows.filter((r) => r.status === 'pending').length

  const filterLinkClass = (active: boolean) =>
    [
      'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition',
      active ? 'border-[#52b788] bg-[rgba(82,183,136,.1)] text-[#1B1F23]' : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#9CA3AF]',
    ].join(' ')

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 md:px-6">
      <p className={adminMutedClass}>
        <AdminNextLink href="/admin" className="text-[#3B82F6] hover:underline">
          Admin
        </AdminNextLink>
        {' / '}
        <AdminNextLink href="/admin/directory/profiles" className="text-[#3B82F6] hover:underline">
          Verzeichnis / Profile
        </AdminNextLink>
        {' / '}
        Claims
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={adminPageTitleClass}>Directory — Profil-Claims</h1>
          <p className={`${adminMutedClass} mt-1 max-w-[640px]`}>
            Review offener Anträge. Aktionen laufen serverseitig mit Service Role; nur Admins (wie bisher).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminNextLink href="/admin/directory/claims" className={filterLinkClass(filter === 'all')}>
            Alle ({rows.length})
          </AdminNextLink>
          <AdminNextLink href="/admin/directory/claims?filter=pending" className={filterLinkClass(filter === 'pending')}>
            Offen ({pendingCount})
          </AdminNextLink>
          <AdminNextLink href="/admin/directory/claims?filter=done" className={filterLinkClass(filter === 'done')}>
            Erledigt
          </AdminNextLink>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <strong className="font-semibold">Hinweis:</strong> {loadError}
          {loadError.includes('SUPABASE_SERVICE_ROLE_KEY') ? (
            <span className="mt-1 block text-[12px] text-amber-900/90">
              Service-Role-Key in .env.local setzen (nur Server).
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={`${adminCardClass} overflow-x-auto`}>
        <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              <th className="px-4 py-3">Profil</th>
              <th className="px-4 py-3">Antragsteller</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Eingang</th>
              <th className="px-4 py-3">Nachricht</th>
              <th className="px-4 py-3 w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#6B7280]">
                  Keine Einträge für diese Filterung.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-[#1B1F23]">{r.profile_display_name}</div>
                    <div className="font-mono text-[11px] text-[#9CA3AF]">/{r.profile_slug}</div>
                    <div className="mt-1 text-[11px] text-[#6B7280]">
                      Listing: {r.profile_listing_status} · Claim-Status Profil: {r.profile_claim_state}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-[#1B1F23]">{r.claimant_display_name}</div>
                    <div className="text-[12px] text-[#6B7280]">{r.claimant_email}</div>
                    <AdminNextLink
                      href={`/admin/users/${r.claimant_user_id}`}
                      className="mt-1 inline-block text-[11px] text-[#3B82F6] hover:underline"
                    >
                      Nutzer im Admin öffnen
                    </AdminNextLink>
                  </td>
                  <td className="px-4 py-3 align-top">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-[#6B7280]">
                    {formatGermanDateTime(r.submitted_at)}
                  </td>
                  <td className="px-4 py-3 align-top max-w-[280px]">
                    <p className="line-clamp-3 text-[12px] text-[#4B5563]">{r.message || '—'}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <AdminNextLink
                      href={`/admin/directory/claims/${r.id}`}
                      className="inline-flex rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1B1F23] hover:border-[#52b788]"
                    >
                      Details
                    </AdminNextLink>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
