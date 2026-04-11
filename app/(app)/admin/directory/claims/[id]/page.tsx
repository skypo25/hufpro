import { notFound } from 'next/navigation'

import AdminNextLink from '@/components/admin/AdminNextLink'
import { AdminClaimApproveForm, AdminClaimRejectForm } from '@/components/admin/directory/AdminClaimActionForms'
import {
  adminCardClass,
  adminMutedClass,
  adminPageTitleClass,
} from '@/components/admin/adminStyles'
import { fetchAdminDirectoryClaimById, type DirectoryClaimStatus } from '@/lib/admin/directoryClaimsData'
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
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; err?: string; msg?: string }>
}

export default async function AdminDirectoryClaimDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams

  let row: Awaited<ReturnType<typeof fetchAdminDirectoryClaimById>> = null
  let loadError: string | null = null
  try {
    row = await fetchAdminDirectoryClaimById(id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Daten konnten nicht geladen werden.'
  }

  if (!loadError && !row) {
    notFound()
  }

  const ownerConflict =
    row &&
    row.status === 'pending' &&
    row.profile_claimed_by_user_id != null &&
    row.profile_claimed_by_user_id !== row.claimant_user_id

  return (
    <div className="mx-auto w-full max-w-[880px] space-y-6 px-4 py-8 md:px-6">
      <p className={adminMutedClass}>
        <AdminNextLink href="/admin" className="text-[#3B82F6] hover:underline">
          Admin
        </AdminNextLink>
        {' / '}
        <AdminNextLink href="/admin/directory/claims" className="text-[#3B82F6] hover:underline">
          Verzeichnis / Claims
        </AdminNextLink>
        {' / '}
        Detail
      </p>

      <h1 className={adminPageTitleClass}>Claim prüfen</h1>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">{loadError}</div>
      ) : null}

      {row ? (
        <>
          {sp.ok === 'approved' ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-950">
              Claim wurde <strong>angenommen</strong>. Profil ist dem Nutzer zugeordnet.
            </div>
          ) : null}
          {sp.ok === 'rejected' ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#1B1F23]">
              Claim wurde <strong>abgelehnt</strong>.
            </div>
          ) : null}
          {sp.err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-950">
              <strong className="font-semibold">Aktion fehlgeschlagen.</strong>{' '}
              {sp.msg ?? 'Bitte erneut versuchen oder Support informieren.'}
            </div>
          ) : null}

          {ownerConflict ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-950">
              <strong className="font-semibold">Konflikt:</strong> Dieses Profil ist bereits einem anderen Nutzer zugeordnet
              (<span className="font-mono text-[11px]">{row.profile_claimed_by_user_id}</span>). Annehmen ist blockiert, bis
              die Zuordnung manuell geklärt ist.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className={`${adminCardClass} p-5`}>
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Verzeichnisprofil</h2>
              <p className="mt-2 text-[16px] font-semibold text-[#1B1F23]">{row.profile_display_name}</p>
              <p className="font-mono text-[12px] text-[#9CA3AF]">slug: {row.profile_slug}</p>
              <dl className="mt-3 space-y-1 text-[13px] text-[#4B5563]">
                <div>
                  <dt className="inline text-[#9CA3AF]">Listing: </dt>
                  <dd className="inline">{row.profile_listing_status}</dd>
                </div>
                <div>
                  <dt className="inline text-[#9CA3AF]">claim_state: </dt>
                  <dd className="inline">{row.profile_claim_state}</dd>
                </div>
                <div>
                  <dt className="inline text-[#9CA3AF]">claimed_by_user_id: </dt>
                  <dd className="inline font-mono text-[11px]">
                    {row.profile_claimed_by_user_id ?? '—'}
                  </dd>
                </div>
              </dl>
              <AdminNextLink
                href={`/behandler/${row.profile_slug}`}
                className="mt-4 inline-flex text-[12px] font-semibold text-[#3B82F6] hover:underline"
              >
                Öffentliches Profil (Vorschau)
              </AdminNextLink>
            </div>

            <div className={`${adminCardClass} p-5`}>
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Antrag</h2>
              <div className="mt-2">{statusBadge(row.status)}</div>
              <dl className="mt-3 space-y-2 text-[13px]">
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-[#9CA3AF]">Eingang</dt>
                  <dd className="text-[#1B1F23]">{formatGermanDateTime(row.submitted_at)}</dd>
                </div>
                {row.decided_at ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-[#9CA3AF]">Entschieden</dt>
                    <dd className="text-[#1B1F23]">{formatGermanDateTime(row.decided_at)}</dd>
                  </div>
                ) : null}
                {row.decided_by_user_id ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-[#9CA3AF]">Entschieden von (User-ID)</dt>
                    <dd className="font-mono text-[11px] text-[#4B5563]">{row.decided_by_user_id}</dd>
                  </div>
                ) : null}
                {row.rejection_reason ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-[#9CA3AF]">Ablehnungsgrund</dt>
                    <dd className="whitespace-pre-wrap text-[#4B5563]">{row.rejection_reason}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>

          <div className={`${adminCardClass} p-5`}>
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Antragsteller</h2>
            <p className="mt-2 font-medium text-[#1B1F23]">{row.claimant_display_name}</p>
            <p className="text-[13px] text-[#6B7280]">{row.claimant_email}</p>
            <p className="mt-1 font-mono text-[11px] text-[#9CA3AF]">user_id: {row.claimant_user_id}</p>
            <AdminNextLink
              href={`/admin/users/${row.claimant_user_id}`}
              className="mt-3 inline-flex text-[12px] font-semibold text-[#3B82F6] hover:underline"
            >
              Nutzer im Admin öffnen
            </AdminNextLink>
          </div>

          <div className={`${adminCardClass} p-5`}>
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Nachricht & Nachweis</h2>
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-[#374151]">{row.message || '—'}</p>
            {row.proof_url ? (
              <p className="mt-3 break-all text-[13px]">
                <span className="text-[#6B7280]">Nachweis: </span>
                <a href={row.proof_url} target="_blank" rel="noreferrer" className="text-[#3B82F6] hover:underline">
                  {row.proof_url}
                </a>
              </p>
            ) : null}
          </div>

          {row.status === 'pending' ? (
            <div className={`${adminCardClass} p-5`}>
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Aktionen</h2>
              <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
                <div>
                  <AdminClaimApproveForm claimId={row.id} disabled={!!ownerConflict} />
                  {ownerConflict ? (
                    <p className="mt-2 max-w-[280px] text-[11px] text-[#6B7280]">Annehmen wegen bestehendem Owner deaktiviert.</p>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 border-t border-[#F3F4F6] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                  <AdminClaimRejectForm claimId={row.id} />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
