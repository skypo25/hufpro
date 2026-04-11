'use client'

import Link from 'next/link'
import { useCallback, useRef } from 'react'

import type { ProfileTaxonomyLabels } from '@/lib/directory/public/data'
import type { DirectoryPublicProfileRow } from '@/lib/directory/public/types'

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function demoMetaForSlug(slug: string): { showVerified: boolean; rating: string; reviewCount: number } {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  const showVerified = h % 7 !== 0
  const rating = (4.5 + (h % 6) / 10).toFixed(1)
  const reviewCount = 3 + (h % 22)
  return { showVerified, rating, reviewCount }
}

export function DirectoryFeaturedSlider({
  profiles,
  taxonomyByProfileId,
}: {
  profiles: DirectoryPublicProfileRow[]
  taxonomyByProfileId: Map<string, ProfileTaxonomyLabels>
}) {
  const ref = useRef<HTMLDivElement>(null)

  const slide = useCallback((dir: number) => {
    const el = ref.current
    if (!el) return
    const card = el.querySelector('.profile-card')
    const w = card ? (card as HTMLElement).offsetWidth + 20 : 360
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }, [])

  if (profiles.length === 0) return null

  return (
    <div className="featured">
      <div className="featured-inner">
        <div className="hero-tag" style={{ marginBottom: 12 }}>
          <i className="bi bi-stars" aria-hidden />
          Neu bei anidocs
        </div>
        <div className="section-title">Neueste Behandler im Verzeichnis</div>
        <div className="slider-wrap">
          <button type="button" className="slider-nav prev" aria-label="Zurück" onClick={() => slide(-1)}>
            <i className="bi bi-chevron-left" aria-hidden />
          </button>
          <button type="button" className="slider-nav next" aria-label="Weiter" onClick={() => slide(1)}>
            <i className="bi bi-chevron-right" aria-hidden />
          </button>
          <div ref={ref} className="featured-grid" id="slider">
            {profiles.map((p) => {
              const tax = taxonomyByProfileId.get(p.id)
              const primaryFach = tax?.specialties?.length ? tax.specialties[0] : 'Tierbehandler:in'
              const animals = tax?.animals ?? []
              const specs = tax?.specialties ?? []
              const extraSpecs = specs.length > 1 ? specs.slice(1, 3) : []
              const location = [p.postal_code, p.city].filter(Boolean).join(' ')
              const locLabel = [location, p.state].filter(Boolean).join(' · ') || 'Ort folgt'
              const href = `/behandler/${p.slug}`
              const { showVerified, rating, reviewCount } = demoMetaForSlug(p.slug)

              return (
                <Link key={p.id} href={href} className="profile-card">
                  <div className="pc-top">
                    <div className="pc-avatar" aria-hidden>
                      {initialsFromName(p.display_name)}
                    </div>
                    <div>
                      <div className="pc-name">
                        {p.display_name}
                        {showVerified ? (
                          <span className="pc-verified" title="Eintrag im Verzeichnis" aria-hidden>
                            <i className="bi bi-check-lg" />
                          </span>
                        ) : null}
                      </div>
                      <div className="pc-fach">{primaryFach}</div>
                      <div className="pc-loc">
                        <i className="bi bi-geo-alt-fill" aria-hidden />
                        {locLabel}
                      </div>
                    </div>
                  </div>
                  <div className="pc-body">
                    <div className="pc-tags">
                      {animals.map((a) => (
                        <span key={a} className="pc-tag tier">
                          {a}
                        </span>
                      ))}
                      {extraSpecs.map((s) => (
                        <span key={s} className="pc-tag art">
                          {s}
                        </span>
                      ))}
                      {p.service_type === 'mobile' || p.service_type === 'both' ? (
                        <span className="pc-tag mobil">Mobil</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="pc-footer">
                    <div>
                      <div className="pc-rating">
                        <i className="bi bi-star-fill" aria-hidden />
                        {rating}
                      </div>
                      <div className="pc-reviews">
                        {reviewCount} {reviewCount === 1 ? 'Bewertung' : 'Bewertungen'}
                      </div>
                    </div>
                    <i className="bi bi-arrow-right pc-arrow" aria-hidden />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
