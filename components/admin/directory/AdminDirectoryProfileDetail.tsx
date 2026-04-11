import AdminNextLink from '@/components/admin/AdminNextLink'
import { adminCardClass, adminMutedClass, adminPageTitleClass, adminSectionHeaderClass } from '@/components/admin/adminStyles'
import {
  adminActivateManualTop,
  adminApprovePendingClaimForProfile,
  adminAssignDirectoryProfileOwner,
  adminClearProfileVerification,
  adminDraftDirectoryProfile,
  adminEndManualTop,
  adminExtendManualTop,
  adminHideDirectoryProfile,
  adminMarkProfileVerificationPending,
  adminMarkProfileVerified,
  adminPublishDirectoryProfile,
  adminPurgeAllTopEntitlements,
  adminReleaseDirectoryProfileOwner,
  adminSetDirectoryOwnerAccessScope,
  adminSetDirectoryProfileListingStatus,
  adminSetDirectoryProfileVerification,
} from '@/lib/admin/directoryProfileAdminActions'
import {
  deClaimStateWithOrigin,
  deDataOrigin,
  deListingStatus,
  deTopSource,
  deVerificationState,
  labelOwnerAccessScope,
} from '@/lib/admin/directoryProfileAdminLabels'
import type { AdminProfileFlash } from '@/lib/admin/directoryProfileAdminFlash'
import type { AdminDirectoryProfileDetail } from '@/lib/admin/directoryProfileDetailData'
import { formatGermanDateTime } from '@/lib/format'

const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-[#1B1F23] px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#374151]'
const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold text-[#1B1F23] shadow-sm transition hover:border-[#9CA3AF]'
const btnDanger =
  'inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-900 shadow-sm transition hover:bg-red-100'
const inputCls = 'w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#1B1F23] outline-none focus:border-[#9CA3AF]'

export default function AdminDirectoryProfileDetail({
  profileId,
  d,
  flash,
}: {
  profileId: string
  d: AdminDirectoryProfileDetail
  flash: AdminProfileFlash | null
}) {
  const p = d.profile
  const isPublished = p.listing_status === 'published'
  const dachCountry = ['DE', 'AT', 'CH'].includes(p.country)
  const hasGeo =
    p.latitude != null &&
    p.longitude != null &&
    Number.isFinite(Number(p.latitude)) &&
    Number.isFinite(Number(p.longitude))
  const inPublicDirectoryView = isPublished && dachCountry
  const visibilityHint = isPublished
    ? 'Öffentlich sichtbar (wenn Land DE/AT/CH und Profil vollständig genug für das Listing).'
    : 'Nicht in der öffentlichen Verzeichnis-Suche.'

  const topActiveRows = d.entitlements.filter((e) => e.isActive)

  /** Damit Dropdowns nach Admin-Aktion (z. B. Veröffentlichen) den aktuellen DB-Stand zeigen — nicht nur den ersten Mount. */
  const listingFormKey = `listing-${p.listing_status}-${p.updated_at ?? p.id}`
  const verificationFormKey = `verify-${p.verification_state}-${p.updated_at ?? p.id}`

  const ls = p.listing_status

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-6 px-4 py-8 md:px-6">
      <p className={adminMutedClass}>
        <AdminNextLink href="/admin" className="text-[#3B82F6] hover:underline">
          Admin
        </AdminNextLink>
        {' / '}
        <AdminNextLink href="/admin/directory/profiles" className="text-[#3B82F6] hover:underline">
          Verzeichnis / Profile
        </AdminNextLink>
        {' / '}
        <span className="text-[#6B7280]">{p.display_name}</span>
      </p>

      <div>
        <h1 className={adminPageTitleClass}>Verzeichnisprofil</h1>
        <p className={`${adminMutedClass} mt-1`}>
          {p.display_name} · <span className="font-mono text-[11px]">/behandler/{p.slug}</span>
        </p>
      </div>

      {flash ? (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] ${
            flash.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
        >
          <span className="font-medium">{flash.msg}</span>
        </div>
      ) : null}

      <section className={`${adminCardClass} border-l-4 border-l-[#2563EB]`}>
        <div className={adminSectionHeaderClass}>
          <h2 className="text-[14px] font-semibold text-[#1B1F23]">Öffentliches Verzeichnis (/behandler)</h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-[#374151]">
          <p>
            Eintrag erscheint in der <strong className="font-semibold">öffentlichen Datenbasis</strong> nur wenn das Listing{' '}
            <strong className="font-semibold">veröffentlicht</strong> ist und das Land{' '}
            <strong className="font-semibold">DE, AT oder CH</strong> ist (technisch: View <span className="font-mono text-[12px]">directory_public_profiles</span>
            ).
          </p>
          <ul className="list-inside list-disc space-y-1 text-[13px]">
            <li>
              Status Datenbasis:{' '}
              {inPublicDirectoryView ? (
                <span className="font-semibold text-emerald-800">sichtbar</span>
              ) : (
                <span className="font-semibold text-amber-900">nicht in der öffentlichen Liste</span>
              )}
              {!dachCountry ? (
                <span className="text-[#B45309]"> — Land ist «{p.country}», es zählen nur DE/AT/CH.</span>
              ) : null}
              {!isPublished ? <span className="text-[#B45309]"> — Listing ist nicht «Veröffentlicht».</span> : null}
            </li>
            <li>
              Koordinaten (Karte / Umkreissuche):{' '}
              {hasGeo ? (
                <span className="font-semibold text-emerald-800">gesetzt</span>
              ) : (
                <span className="font-semibold text-amber-900">fehlen</span>
              )}
              {hasGeo ? null : (
                <span>
                  {' '}
                  — Bei Suche mit Ort und km-Umkreis erscheint das Profil ohne Standort nicht in der Karten-/Radiusliste; bei
                  gesetzten Fachfiltern wird es am Ende der Liste ohne km angezeigt. Ort nur als Text: Treffer, wenn Stadt oder PLZ in
                  den Profildaten zur Eingabe passt.
                </span>
              )}
            </li>
          </ul>
        </div>
      </section>

      {/* A) Status & Sichtbarkeit */}
      <section className={adminCardClass}>
        <div className={adminSectionHeaderClass}>
          <h2 className="text-[14px] font-semibold text-[#1B1F23]">Status &amp; Sichtbarkeit</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Stammdatenherkunft</div>
              <div className="mt-1 text-[14px] font-medium text-[#1B1F23]">{deDataOrigin(p.data_origin)}</div>
              {p.data_origin === 'import' ? (
                <p className="mt-1 text-[12px] leading-snug text-[#6B7280]">
                  Veröffentlichen macht den Eintrag sichtbar; ein Nutzer beansprucht ihn später über «Profil übernehmen».
                </p>
              ) : null}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Listing</div>
              <div className="mt-1 text-[14px] font-medium text-[#1B1F23]">{deListingStatus(p.listing_status)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Claim</div>
              <div className="mt-1 text-[14px] font-medium text-[#1B1F23]">
                {deClaimStateWithOrigin(p.claim_state, p.data_origin)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Verifizierung</div>
              <div className="mt-1 text-[14px] font-medium text-[#1B1F23]">{deVerificationState(p.verification_state)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Öffentlichkeit</div>
              <div className="mt-1 text-[13px] text-[#4B5563]">{visibilityHint}</div>
            </div>
          </div>

          <form key={listingFormKey} action={adminSetDirectoryProfileListingStatus} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="profileId" value={profileId} />
            <label className="min-w-[200px] flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-[#6B7280]">Listing-Status setzen</span>
              <select name="listing_status" className={inputCls} defaultValue={p.listing_status}>
                <option value="draft">Entwurf</option>
                <option value="published">Veröffentlicht</option>
                <option value="hidden">Versteckt</option>
                <option value="blocked">Gesperrt</option>
              </select>
            </label>
            <button type="submit" className={btnPrimary}>
              Speichern
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            <form action={adminPublishDirectoryProfile}>
              <input type="hidden" name="profileId" value={profileId} />
              <button
                type="submit"
                className={ls === 'published' ? btnPrimary : btnSecondary}
                disabled={ls === 'published'}
                title={ls === 'published' ? 'Listing ist bereits veröffentlicht' : undefined}
              >
                {ls === 'published' ? 'Veröffentlicht (aktuell)' : 'Profil veröffentlichen'}
              </button>
            </form>
            <form action={adminHideDirectoryProfile}>
              <input type="hidden" name="profileId" value={profileId} />
              <button
                type="submit"
                className={ls === 'hidden' ? btnPrimary : btnSecondary}
                disabled={ls === 'hidden'}
                title={ls === 'hidden' ? 'Listing ist bereits versteckt' : undefined}
              >
                {ls === 'hidden' ? 'Versteckt (aktuell)' : 'Profil verbergen'}
              </button>
            </form>
            <form action={adminDraftDirectoryProfile}>
              <input type="hidden" name="profileId" value={profileId} />
              <button
                type="submit"
                className={ls === 'draft' ? btnPrimary : btnSecondary}
                disabled={ls === 'draft'}
                title={ls === 'draft' ? 'Listing ist bereits ein Entwurf' : undefined}
              >
                {ls === 'draft' ? 'Entwurf (aktuell)' : 'Auf Entwurf setzen'}
              </button>
            </form>
          </div>
          {ls === 'blocked' ? (
            <p className="text-[12px] text-[#6B7280]">
              Status «Gesperrt»: bitte oben im Dropdown wählen oder zuerst auf Entwurf/Veröffentlicht setzen.
            </p>
          ) : null}

          <div className="border-t border-[#F3F4F6] pt-4">
            <div className="mb-2 text-[12px] font-semibold text-[#374151]">Verifizierung steuern</div>
            <div className="flex flex-wrap gap-2">
              <form action={adminMarkProfileVerified}>
                <input type="hidden" name="profileId" value={profileId} />
                <button type="submit" className={btnPrimary}>
                  Verifizieren
                </button>
              </form>
              <form action={adminClearProfileVerification}>
                <input type="hidden" name="profileId" value={profileId} />
                <button type="submit" className={btnSecondary}>
                  Verifizierung entfernen
                </button>
              </form>
              <form action={adminMarkProfileVerificationPending}>
                <input type="hidden" name="profileId" value={profileId} />
                <button type="submit" className={btnSecondary}>
                  Auf ausstehend setzen
                </button>
              </form>
            </div>
            <form
              key={verificationFormKey}
              action={adminSetDirectoryProfileVerification}
              className="mt-3 flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="profileId" value={profileId} />
              <label className="min-w-[180px]">
                <span className="mb-1 block text-[11px] font-semibold text-[#6B7280]">Oder Status wählen</span>
                <select name="verification_state" className={inputCls} defaultValue={p.verification_state}>
                  <option value="none">Keine</option>
                  <option value="pending">Ausstehend</option>
                  <option value="verified">Verifiziert</option>
                  <option value="rejected">Abgelehnt</option>
                </select>
              </label>
              <button type="submit" className={btnSecondary}>
                Übernehmen
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Top */}
      <section className={adminCardClass}>
        <div className={adminSectionHeaderClass}>
          <h2 className="text-[14px] font-semibold text-[#1B1F23]">Top-Profil</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="text-[13px] text-[#4B5563]">
            Top gilt, wenn mindestens eine aktive Berechtigung existiert (App-Abo, Verzeichnis-Kauf oder manuell). Unten siehst du
            <strong className="font-semibold"> warum</strong> es aktiv ist.
          </p>
          {topActiveRows.length === 0 ? (
            <p className="text-[13px] text-[#6B7280]">Aktuell kein aktives Top-Profil (keine gültige Berechtigung).</p>
          ) : (
            <ul className="space-y-2">
              {topActiveRows.map((e) => (
                <li
                  key={e.source}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-[#1B1F23]">{deTopSource(e.source)}</span>
                  <span className="text-[#6B7280]">
                    {e.active_until == null ? (
                      <span className="text-emerald-800">ohne Enddatum</span>
                    ) : (
                      <>bis {formatGermanDateTime(e.active_until)}</>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {d.entitlements.length > 0 ? (
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#374151]">Alle gespeicherten Top-Berechtigungen</div>
              <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
                <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
                  <thead className="bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2">Quelle</th>
                      <th className="px-3 py-2">Ende</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.entitlements.map((e) => (
                      <tr key={e.source} className="border-t border-[#F3F4F6]">
                        <td className="px-3 py-2 font-medium text-[#1B1F23]">{deTopSource(e.source)}</td>
                        <td className="px-3 py-2 text-[#6B7280]">
                          {e.active_until == null ? '—' : formatGermanDateTime(e.active_until)}
                        </td>
                        <td className="px-3 py-2">
                          {e.isActive ? (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                              aktiv
                            </span>
                          ) : (
                            <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
                              abgelaufen
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="text-[12px] font-semibold text-[#374151]">Manuelle Top-Steuerung</div>
          <div className="flex flex-wrap gap-2">
            <form action={adminActivateManualTop} className="flex items-center gap-2">
              <input type="hidden" name="profileId" value={profileId} />
              <input type="hidden" name="days" value="30" />
              <button type="submit" className={btnSecondary}>
                Top aktivieren (30 Tage)
              </button>
            </form>
            <form action={adminExtendManualTop} className="flex items-center gap-2">
              <input type="hidden" name="profileId" value={profileId} />
              <input type="hidden" name="days" value="30" />
              <button type="submit" className={btnSecondary}>
                Manuelles Top verlängern (+30 Tage)
              </button>
            </form>
            <form action={adminEndManualTop}>
              <input type="hidden" name="profileId" value={profileId} />
              <button type="submit" className={btnSecondary}>
                Nur manuelles Top beenden
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-3">
            <div className="mb-2 text-[12px] font-semibold text-red-900">Alle Top-Quellen entfernen</div>
            <p className="mb-2 text-[12px] text-red-800">
              Löscht App-, Verzeichnis- und manuelle Berechtigungen. Nur nutzen, wenn du die Markierung vollständig zurücksetzen musst.
            </p>
            <form action={adminPurgeAllTopEntitlements} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="profileId" value={profileId} />
              <label className="min-w-[220px] flex-1">
                <span className="mb-1 block text-[11px] font-semibold text-red-900">Slug zur Bestätigung</span>
                <input name="confirmSlug" className={inputCls} placeholder={p.slug} autoComplete="off" />
              </label>
              <button type="submit" className={btnDanger}>
                Alle Top-Berechtigungen löschen
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Owner */}
      <section className={adminCardClass}>
        <div className={adminSectionHeaderClass}>
          <h2 className="text-[14px] font-semibold text-[#1B1F23]">Owner &amp; Zugriff</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          {d.owner ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Nutzer-ID</div>
                  <div className="mt-1 font-mono text-[12px] text-[#1B1F23]">{d.owner.userId}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">E-Mail</div>
                  <div className="mt-1 text-[13px] text-[#1B1F23]">{d.owner.email ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Zugriff (Verzeichnis)</div>
                  <div className="mt-1 text-[13px] font-medium text-[#1B1F23]">
                    {labelOwnerAccessScope({ scope: d.owner.accessScope })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Billing (App)</div>
                  <div className="mt-1 text-[13px] text-[#4B5563]">
                    {d.owner.billing?.subscription_status ?? '—'}
                    {d.owner.billing?.trial_ends_at ? (
                      <span className="ml-2 text-[#9CA3AF]">
                        Trial bis {formatGermanDateTime(d.owner.billing.trial_ends_at)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <form action={adminSetDirectoryOwnerAccessScope} className="flex flex-wrap items-end gap-2 border-t border-[#F3F4F6] pt-4">
                <input type="hidden" name="profileId" value={profileId} />
                <input type="hidden" name="userId" value={d.owner.userId} />
                <label className="min-w-[200px]">
                  <span className="mb-1 block text-[11px] font-semibold text-[#6B7280]">Zugriffstyp setzen</span>
                  <select
                    name="access_scope"
                    className={inputCls}
                    defaultValue={d.owner.accessScope === 'directory_only' ? 'directory_only' : 'app'}
                  >
                    <option value="app">App (Dokumentation + Verzeichnis)</option>
                    <option value="directory_only">Nur Verzeichnis</option>
                  </select>
                </label>
                <button type="submit" className={btnSecondary}>
                  Zugriff speichern
                </button>
              </form>
            </>
          ) : (
            <p className="text-[13px] text-[#6B7280]">Kein Owner zugewiesen.</p>
          )}

          {d.pendingClaimIds.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-[13px] text-amber-950">
              <strong className="font-semibold">Offener Claim.</strong> Du kannst ihn hier bestätigen (wie in der Claim-Verwaltung).
              <form action={adminApprovePendingClaimForProfile} className="mt-2">
                <input type="hidden" name="profileId" value={profileId} />
                <button type="submit" className={btnPrimary}>
                  Claim bestätigen
                </button>
              </form>
            </div>
          ) : null}

          <div className="border-t border-[#F3F4F6] pt-4">
            <div className="mb-2 text-[12px] font-semibold text-[#374151]">Owner zuweisen (UUID)</div>
            <form action={adminAssignDirectoryProfileOwner} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="profileId" value={profileId} />
              <label className="min-w-[280px] flex-1">
                <input name="newOwnerUserId" className={inputCls} placeholder="auth.users UUID" autoComplete="off" />
              </label>
              <button type="submit" className={btnSecondary}>
                Owner setzen &amp; als beansprucht markieren
              </button>
            </form>
          </div>

          <form action={adminReleaseDirectoryProfileOwner}>
            <input type="hidden" name="profileId" value={profileId} />
            <button type="submit" className={btnDanger}>
              Owner lösen &amp; offene Claims ablehnen
            </button>
          </form>
        </div>
      </section>

      {/* Profilinhalt */}
      <section className={adminCardClass}>
        <div className={adminSectionHeaderClass}>
          <h2 className="text-[14px] font-semibold text-[#1B1F23]">Profilinhalt &amp; Qualität</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
            <span className="text-[12px] font-semibold text-[#6B7280]">Vollständigkeit</span>
            <span className="text-[18px] font-bold text-[#1B1F23]">{d.completeness.passed}/{d.completeness.total}</span>
            <span className="text-[12px] text-[#6B7280]">({d.completeness.score}%)</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {d.completeness.checks.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-[13px]">
                <span className={c.ok ? 'text-emerald-600' : 'text-[#D1D5DB]'}>{c.ok ? '✓' : '○'}</span>
                <span className={c.ok ? 'text-[#1B1F23]' : 'text-[#9CA3AF]'}>{c.label}</span>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 border-t border-[#F3F4F6] pt-4 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold text-[#9CA3AF]">Anzeigename</div>
              <div className="text-[13px] text-[#1B1F23]">{p.display_name}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#9CA3AF]">Praxisname</div>
              <div className="text-[13px] text-[#1B1F23]">{p.practice_name ?? '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#9CA3AF]">Ort</div>
              <div className="text-[13px] text-[#1B1F23]">
                {p.postal_code ?? '—'} {p.city ?? ''}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#9CA3AF]">Dienstleistung</div>
              <div className="text-[13px] text-[#1B1F23]">{p.service_type}</div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold text-[#9CA3AF]">Fachrichtungen</div>
            <div className="text-[13px] text-[#374151]">{d.specialtyLabels.length ? d.specialtyLabels.join(', ') : '—'}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-[#9CA3AF]">Spezialisierungen</div>
            <div className="text-[13px] text-[#374151]">{d.subcategoryLabels.length ? d.subcategoryLabels.join(', ') : '—'}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-[#9CA3AF]">Methoden</div>
            <div className="text-[13px] text-[#374151]">{d.methodLabels.length ? d.methodLabels.join(', ') : '—'}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-[#9CA3AF]">Tierarten</div>
            <div className="text-[13px] text-[#374151]">{d.animalTypeLabels.length ? d.animalTypeLabels.join(', ') : '—'}</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="text-[13px]">
              <span className="text-[#9CA3AF]">Bild/Logo: </span>
              {d.mediaLogoOrPhotoCount > 0 ? <span className="text-emerald-800">ja</span> : <span className="text-[#9CA3AF]">nein</span>}
            </div>
            <div className="text-[13px]">
              <span className="text-[#9CA3AF]">Social/Web: </span>
              {d.socialCount > 0 ? <span className="text-emerald-800">ja ({d.socialCount})</span> : <span className="text-[#9CA3AF]">nein</span>}
            </div>
            <div className="text-[13px]">
              <span className="text-[#9CA3AF]">Kurzbeschreibung: </span>
              {(p.short_description ?? '').trim() ? (
                <span className="text-emerald-800">ja</span>
              ) : (
                <span className="text-[#9CA3AF]">nein</span>
              )}
            </div>
            <div className="text-[13px]">
              <span className="text-[#9CA3AF]">Beschreibung: </span>
              {(p.description ?? '').trim() ? <span className="text-emerald-800">ja</span> : <span className="text-[#9CA3AF]">nein</span>}
            </div>
          </div>

          {d.socialLinks.length > 0 ? (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-[#9CA3AF]">Links</div>
              <ul className="space-y-1 font-mono text-[12px] text-[#2563EB]">
                {d.socialLinks.map((s) => (
                  <li key={`${s.platform}-${s.url}`}>
                    {s.platform}:{' '}
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className={adminMutedClass}>
            Bearbeitung der Texte und Medien erfolgt über das normale Profil-Formular (Nutzer-Seite), nicht hier.
          </p>
        </div>
      </section>

      <p className={adminMutedClass}>
        <AdminNextLink href="/admin/directory/profiles" className="text-[#3B82F6] hover:underline">
          ← Zurück zur Liste
        </AdminNextLink>
      </p>
    </div>
  )
}
