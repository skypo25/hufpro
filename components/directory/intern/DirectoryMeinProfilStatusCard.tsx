import type { ReactNode } from 'react'

type ListingKey = 'draft' | 'published' | 'hidden' | 'blocked' | 'unknown'
type VerificationKey = 'none' | 'pending' | 'verified' | 'rejected' | 'unknown'

function listingKey(raw: string | null | undefined): ListingKey {
  const v = (raw ?? '').toString()
  if (v === 'draft' || v === 'published' || v === 'hidden' || v === 'blocked') return v
  return 'unknown'
}

function verificationKey(raw: string | null | undefined): VerificationKey {
  const v = (raw ?? '').toString()
  if (v === 'none' || v === 'pending' || v === 'verified' || v === 'rejected') return v
  return 'unknown'
}

const LISTING_BADGE: Record<
  ListingKey,
  { label: string; badge: string; dot: string; info: () => ReactNode }
> = {
  draft: {
    label: 'Entwurf',
    badge: 'bg-amber-50 text-amber-900',
    dot: 'bg-yellow-500',
    info: () => (
      <>
        Dein Profil ist noch nicht veröffentlicht. Sobald der Listing-Status auf „Veröffentlicht“ gesetzt ist (und Land
        DE/AT/CH), kannst du im Verzeichnis erscheinen.
      </>
    ),
  },
  published: {
    label: 'Veröffentlicht',
    badge: 'bg-[rgba(82,183,136,0.06)] text-[#3d9e6e]',
    dot: 'bg-emerald-500',
    info: () => <>Dein Profil ist im Verzeichnis sichtbar, sobald es in der öffentlichen Datenbank gelistet ist (Land DE/AT/CH).</>,
  },
  hidden: {
    label: 'Versteckt',
    badge: 'bg-[#F3F4F6] text-[#6B7280]',
    dot: 'bg-[#E5E7EB]',
    info: () => <>Dein Eintrag ist aktuell nicht in der öffentlichen Suche gelistet.</>,
  },
  blocked: {
    label: 'Gesperrt',
    badge: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
    info: () => <>Dein Eintrag wurde gesperrt. Bei Fragen wende dich bitte an den Support.</>,
  },
  unknown: {
    label: '—',
    badge: 'bg-[#F3F4F6] text-[#6B7280]',
    dot: 'bg-[#E5E7EB]',
    info: () => <>Status konnte nicht geladen werden.</>,
  },
}

const VERIFICATION_BADGE: Record<
  VerificationKey,
  { label: string; badge: string; dot: string; info: () => ReactNode }
> = {
  none: {
    label: 'Nicht verifiziert',
    badge: 'bg-[#F3F4F6] text-[#6B7280]',
    dot: 'bg-[#E5E7EB]',
    info: () => <>Eine Verifizierung kann Vertrauen stärken, sobald der Prozess für dein Profil freigeschaltet ist.</>,
  },
  pending: {
    label: 'Prüfung ausstehend',
    badge: 'bg-blue-50 text-blue-800',
    dot: 'bg-blue-500',
    info: () => <>Wir prüfen deine Angaben — in der Regel innerhalb von 1–2 Werktagen.</>,
  },
  verified: {
    label: 'Verifiziert',
    badge: 'bg-[rgba(82,183,136,0.06)] text-[#3d9e6e]',
    dot: 'bg-emerald-500',
    info: () => <>Dein Profil wurde erfolgreich geprüft.</>,
  },
  rejected: {
    label: 'Abgelehnt',
    badge: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
    info: () => <>Die Verifizierung wurde abgelehnt. Bitte prüfe deine Angaben oder kontaktiere uns.</>,
  },
  unknown: {
    label: '—',
    badge: 'bg-[#F3F4F6] text-[#6B7280]',
    dot: 'bg-[#E5E7EB]',
    info: () => <>—</>,
  },
}

export function DirectoryMeinProfilStatusCard({
  hasProfile,
  displayName,
  slug,
  listingStatus,
  verificationState,
  topActive,
  topSourcesLabel,
}: {
  hasProfile: boolean
  displayName: string | null | undefined
  slug: string | null | undefined
  listingStatus: string | null | undefined
  verificationState: string | null | undefined
  topActive: boolean
  topSourcesLabel: string
}) {
  if (!hasProfile) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#F3F4F6] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] px-5 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-[#1B1F23]">
            <i className="bi bi-shield-fill-check shrink-0 text-[16px] text-[#9CA3AF]" aria-hidden />
            <span>Profil-Status</span>
          </div>
          <a
            href="#dir-profile-wizard"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#6B7280] transition-colors hover:border-[#52b788] hover:text-[#52b788]"
          >
            <i className="bi bi-pencil-fill text-[11px]" aria-hidden />
            Profil anlegen
          </a>
        </div>
        <div className="px-5 py-5 text-[13px] leading-relaxed text-[#6B7280] md:px-6">
          Noch kein Verzeichnisprofil. Nutze den Assistenten unten, um Stammdaten und Darstellung zu speichern.
        </div>
      </div>
    )
  }

  const lk = listingKey(listingStatus)
  const vk = verificationKey(verificationState)
  const L = LISTING_BADGE[lk]
  const V = VERIFICATION_BADGE[vk]

  const topBadge = topActive
    ? 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-900'
    : 'bg-[#F3F4F6] text-[#9CA3AF]'
  const topDot = topActive ? 'bg-amber-500' : 'bg-[#E5E7EB]'
  const topLabel = topActive ? 'Aktiv' : 'Nicht aktiv'

  const topInfo = topActive ? (
    <>
      Dein Profil wird im Verzeichnis hervorgehoben (Galerie & Kontaktformular, sofern E-Mail hinterlegt).
      {topSourcesLabel ? (
        <>
          {' '}
          <span className="text-[#6B7280]">Quelle{topSourcesLabel.includes(',') ? 'n' : ''}:</span>{' '}
          <span className="font-medium text-[#1B1F23]">{topSourcesLabel}</span>
        </>
      ) : null}
    </>
  ) : (
    <>Galerie und Kontaktformular sind nur mit aktivem Top-Profil sichtbar (z. B. Verzeichnis-Premium oder App-Abo).</>
  )

  const subtitle =
    displayName || slug ? (
      <div className="border-b border-[#F3F4F6] px-5 py-2.5 text-[12px] text-[#6B7280] md:px-6">
        {displayName ? <span className="font-medium text-[#1B1F23]">{displayName}</span> : null}
        {displayName && slug ? <span className="text-[#9CA3AF]"> · </span> : null}
        {slug ? (
          <span className="font-mono text-[11px] text-[#6B7280]">
            /behandler/{slug}
          </span>
        ) : null}
        {!displayName && !slug ? <span>Noch kein Profil angelegt</span> : null}
      </div>
    ) : (
      <div className="border-b border-[#F3F4F6] px-5 py-2.5 text-[12px] text-[#6B7280] md:px-6">
        Noch kein Profil angelegt
      </div>
    )

  return (
    <div className="overflow-hidden rounded-2xl border border-[#F3F4F6] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-[#1B1F23]">
          <i className="bi bi-shield-fill-check shrink-0 text-[16px] text-[#9CA3AF]" aria-hidden />
          <span>Profil-Status</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {listingStatus === 'published' && slug ? (
            <a
              href={`/behandler/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B1F23] px-3.5 py-2 text-[12px] font-semibold !text-white transition-colors hover:bg-slate-800 hover:!text-white"
            >
              Öffentliche Ansicht
              <i className="bi bi-box-arrow-up-right text-[11px] !text-white opacity-100" aria-hidden />
            </a>
          ) : null}
          <a
            href="#dir-profile-wizard"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#6B7280] transition-colors hover:border-[#52b788] hover:text-[#52b788]"
          >
            <i className="bi bi-pencil-fill text-[11px]" aria-hidden />
            Profil bearbeiten
          </a>
        </div>
      </div>

      {subtitle}

      <div className="grid grid-cols-1 divide-y divide-[#F3F4F6] md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="px-5 py-5 md:px-6">
          <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#9CA3AF]">
            <i className="bi bi-globe2 text-[12px]" aria-hidden />
            Listing
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold ${L.badge}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${L.dot}`} aria-hidden />
            {L.label}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-[#9CA3AF]">{L.info()}</p>
        </div>

        <div className="px-5 py-5 md:px-6">
          <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#9CA3AF]">
            <i className="bi bi-patch-check-fill text-[12px]" aria-hidden />
            Verifizierung
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold ${V.badge}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${V.dot}`} aria-hidden />
            {V.label}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-[#9CA3AF]">{V.info()}</p>
        </div>

        <div className="px-5 py-5 md:px-6">
          <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#9CA3AF]">
            <i className="bi bi-star-fill text-[12px]" aria-hidden />
            Top-Profil
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold ${topBadge}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${topDot}`} aria-hidden />
            {topLabel}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-[#9CA3AF]">{topInfo}</p>
        </div>
      </div>
    </div>
  )
}
