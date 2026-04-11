import AdminNextLink from '@/components/admin/AdminNextLink'
import { adminCardClass, adminMutedClass, adminPageTitleClass } from '@/components/admin/adminStyles'
import { parseAdminDirectoryProfileFlash } from '@/lib/admin/directoryProfileAdminFlash'
import {
  deClaimStateWithOrigin,
  deListingStatus,
  deTopSource,
  deVerificationState,
} from '@/lib/admin/directoryProfileAdminLabels'
import { fetchAdminDirectoryProfilesList } from '@/lib/admin/directoryProfilesData'
import { formatGermanDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function badge(text: string, tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'purple' = 'slate') {
  const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide'
  const cls =
    tone === 'green'
      ? 'bg-emerald-100 text-emerald-900'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-900'
        : tone === 'red'
          ? 'bg-red-100 text-red-800'
          : tone === 'blue'
            ? 'bg-sky-100 text-sky-900'
            : tone === 'purple'
              ? 'bg-purple-100 text-purple-900'
              : 'bg-[#F3F4F6] text-[#6B7280]'
  return <span className={`${base} ${cls}`}>{text}</span>
}

function listingTone(s: string): 'slate' | 'green' | 'amber' | 'red' {
  if (s === 'published') return 'green'
  if (s === 'hidden' || s === 'draft') return 'amber'
  if (s === 'blocked') return 'red'
  return 'slate'
}

function claimTone(s: string, dataOrigin: string): 'slate' | 'green' | 'amber' | 'blue' {
  if (s === 'claimed') return 'green'
  if (s === 'claim_pending') return 'amber'
  if (s === 'unclaimed' && dataOrigin === 'import') return 'blue'
  return 'slate'
}

function verificationTone(s: string): 'slate' | 'green' | 'amber' | 'red' {
  if (s === 'verified') return 'green'
  if (s === 'pending') return 'amber'
  if (s === 'rejected') return 'red'
  return 'slate'
}

function labelScope(s: string, implicit: boolean) {
  if (s === 'none') return <span className="text-[12px] text-[#9CA3AF]">—</span>
  if (s === 'directory_only') return badge('Verzeichnis-only', 'purple')
  const el = badge('App-Nutzer', 'green')
  if (implicit) {
    return (
      <span title="Kein Eintrag in directory_user_access — wird wie App-Zugang behandelt.">
        {el}
      </span>
    )
  }
  return el
}

function labelTop(active: boolean, sources: string[]) {
  if (!active) return badge('Nein', 'slate')
  const hasApp = sources.includes('app_subscription')
  const hasDir = sources.includes('directory_subscription')
  const hasMan = sources.includes('manual')
  if (hasApp && hasDir) return badge('Ja · App + Verzeichnis', 'amber')
  if (hasApp) return badge('Ja · App-Abo', 'amber')
  if (hasDir) return badge('Ja · Verzeichnis', 'amber')
  if (hasMan) return badge('Ja · Manuell', 'amber')
  return badge('Ja', 'amber')
}

function topSourcesLine(sources: string[]) {
  if (sources.length === 0) return '—'
  return sources.map(deTopSource).join(' · ')
}

export default async function AdminDirectoryProfilesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const flash = parseAdminDirectoryProfileFlash(sp)

  let rows: Awaited<ReturnType<typeof fetchAdminDirectoryProfilesList>> = []
  let loadError: string | null = null
  try {
    rows = await fetchAdminDirectoryProfilesList()
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Profile konnten nicht geladen werden.'
  }

  const claimedCount = rows.filter((r) => r.claimed_by_user_id).length
  const topCount = rows.filter((r) => r.top_active).length
  const dirOnlyOwners = rows.filter((r) => r.owner_access_scope === 'directory_only').length

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-8 md:px-6">
      <p className={adminMutedClass}>
        <AdminNextLink href="/admin" className="text-[#3B82F6] hover:underline">
          Admin
        </AdminNextLink>
        {' / '}
        Verzeichnis / Profile
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={adminPageTitleClass}>Verzeichnis — Profile</h1>
          <p className={`${adminMutedClass} mt-1 max-w-[720px]`}>
            Übersicht mit Verifizierung, Top-Quellen und Vollständigkeit. Detailansicht für Steuerung und Aktionen.
          </p>
          {flash ? (
            <div
              className={`mt-3 max-w-[720px] rounded-xl border px-4 py-3 text-[13px] ${
                flash.kind === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
            >
              <span className="font-medium">{flash.msg}</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <AdminNextLink
            href="/admin/directory/claims"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold text-[#1B1F23] shadow-sm transition hover:border-[#9CA3AF]"
          >
            Claims
          </AdminNextLink>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className={`${adminCardClass} p-4`}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Profile</div>
          <div className="mt-1 text-[26px] font-bold leading-none text-[#1B1F23]">{rows.length}</div>
        </div>
        <div className={`${adminCardClass} p-4`}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Beansprucht</div>
          <div className="mt-1 text-[26px] font-bold leading-none text-[#1B1F23]">{claimedCount}</div>
        </div>
        <div className={`${adminCardClass} p-4`}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Top aktiv</div>
          <div className="mt-1 text-[26px] font-bold leading-none text-[#b7791f]">{topCount}</div>
        </div>
        <div className={`${adminCardClass} p-4`}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Owner: Verzeichnis-only</div>
          <div className="mt-1 text-[26px] font-bold leading-none text-[#8B5CF6]">{dirOnlyOwners}</div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <strong className="font-semibold">Hinweis:</strong> {loadError}
        </div>
      ) : null}

      <div className={`${adminCardClass} overflow-x-auto`}>
        <table className="w-full min-w-[1320px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              <th className="px-4 py-3">Profil</th>
              <th className="px-4 py-3">Listing / Claim</th>
              <th className="px-4 py-3">Verifizierung</th>
              <th className="px-4 py-3">Top</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Owner-Typ</th>
              <th className="px-4 py-3">Vollständigkeit</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Geändert</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[#6B7280]">
                  Keine Profile gefunden.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const ownerShort = r.claimed_by_user_id ? `${r.claimed_by_user_id.slice(0, 8)}…` : '—'
                const billingLabel = r.billing_subscription_status
                  ? r.billing_subscription_status
                  : r.billing_trial_ends_at
                    ? 'trial'
                    : '—'

                return (
                  <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 align-top">
                      <AdminNextLink
                        href={`/admin/directory/profiles/${r.id}`}
                        className="font-medium text-[#2563EB] hover:underline"
                      >
                        {r.display_name}
                      </AdminNextLink>
                      <div className="font-mono text-[11px] text-[#9CA3AF]">/behandler/{r.slug}</div>
                      <div className="mt-1 text-[11px] text-[#6B7280]">id: {r.id}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {badge(deListingStatus(r.listing_status), listingTone(r.listing_status))}
                        {badge(deClaimStateWithOrigin(r.claim_state, r.data_origin), claimTone(r.claim_state, r.data_origin))}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {badge(deVerificationState(r.verification_state), verificationTone(r.verification_state))}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div>{labelTop(r.top_active, r.top_sources)}</div>
                        {r.top_active ? (
                          <div
                            className="max-w-[220px] text-[11px] leading-snug text-[#6B7280]"
                            title={r.top_sources.join(', ')}
                          >
                            {topSourcesLine(r.top_sources)}
                            {r.top_until ? (
                              <span className="mt-0.5 block text-[#9CA3AF]">
                                bis {formatGermanDateTime(r.top_until)}
                              </span>
                            ) : (
                              <span className="mt-0.5 block text-[#9CA3AF]">ohne Enddatum (mindestens eine Quelle)</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-[12px] text-[#1B1F23]">{ownerShort}</td>
                    <td className="px-4 py-3 align-top">{labelScope(r.owner_access_scope, r.owner_access_implicit)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[#1B1F23]">
                          {r.completeness_passed}/{r.completeness_total}
                        </span>
                        <span className="text-[11px] text-[#9CA3AF]">{r.completeness_score}%</span>
                      </div>
                      <AdminNextLink
                        href={`/admin/directory/profiles/${r.id}`}
                        className="mt-1 inline-block text-[11px] text-[#2563EB] hover:underline"
                      >
                        Details
                      </AdminNextLink>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[12px] text-[#1B1F23]">{billingLabel}</div>
                      {r.billing_trial_ends_at ? (
                        <div className="text-[11px] text-[#9CA3AF]">Trial bis {formatGermanDateTime(r.billing_trial_ends_at)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap text-[#6B7280]">
                      {r.updated_at ? formatGermanDateTime(r.updated_at) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
