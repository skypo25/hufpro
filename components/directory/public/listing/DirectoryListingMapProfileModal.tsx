'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'

import {
  directoryPremiumInitialsFromName,
} from '@/components/directory/public/listing/directoryListingPremiumHelpers'
import type { ProfileTaxonomyLabels } from '@/lib/directory/public/data'
import type { DirectoryPublicProfileRow } from '@/lib/directory/public/types'

type Props = {
  profile: DirectoryPublicProfileRow
  taxonomy: ProfileTaxonomyLabels | undefined
  distanceKm: number | undefined
  onClose: () => void
}

export function DirectoryListingMapProfileModal({
  profile,
  taxonomy,
  distanceKm,
  onClose,
}: Props) {
  const titleId = useId()
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    closeBtnRef.current?.focus()
  }, [])

  const href = `/behandler/${profile.slug}`
  const primaryFach = taxonomy?.specialties?.[0] ?? 'Tierbehandler:in'
  const loc = [profile.postal_code, profile.city].filter(Boolean).join(' ')
  const locLine =
    distanceKm != null && Number.isFinite(distanceKm)
      ? `${loc || 'Region'} · ${distanceKm} km`
      : loc || profile.state || 'Region'
  const ini = directoryPremiumInitialsFromName(profile.display_name)
  const tagA = (taxonomy?.animals ?? []).slice(0, 3)

  return (
    <div className="dlp-mapmod" role="presentation" onClick={onClose}>
      <div className="dlp-mapmod__backdrop" aria-hidden />
      <div
        className="dlp-mapmod__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dlp-mapmod__head">
          <h2 id={titleId} className="dlp-mapmod__title">
            Profil
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="dlp-mapmod__close"
            aria-label="Schließen"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden />
          </button>
        </div>
        <div className="dlp-mapmod__body">
          <div className="dlp-mapmod__top">
            <div className="dlp-cb-avatar">{ini}</div>
            <div className="dlp-mapmod__info">
              <div className="dlp-mapmod__name">
                {profile.display_name}
                {profile.verification_state === 'verified' ? (
                  <span className="dlp-verified" title="Verifiziert" aria-label="Verifiziert">
                    <i className="bi bi-patch-check-fill" aria-hidden />
                  </span>
                ) : null}
              </div>
              <div className="dlp-mapmod__fach">{primaryFach}</div>
              <div className="dlp-mapmod__loc">
                <i className="bi bi-geo-alt-fill" aria-hidden />
                {locLine}
              </div>
            </div>
          </div>
          <div className="dlp-mapmod__tags">
            {tagA.map((t) => (
              <span key={t} className="dlp-tag dlp-tag-a">
                {t}
              </span>
            ))}
            {profile.service_type === 'mobile' || profile.service_type === 'both' ? (
              <span className="dlp-tag dlp-tag-m">Mobil</span>
            ) : null}
            {profile.service_type === 'stationary' ? (
              <span className="dlp-tag dlp-tag-m">Praxis</span>
            ) : null}
          </div>
        </div>
        <div className="dlp-mapmod__foot">
          <div className="dlp-mapmod__foot-in">
            <div className="dlp-cf-loc">
              <i className="bi bi-geo-alt-fill" aria-hidden />
              {locLine}
            </div>
            <Link href={href} className="dlp-cf-btn dlp-cf-primary" onClick={onClose}>
              <i className="bi bi-calendar-plus" aria-hidden />
              Profil ansehen
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
