'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { ProfileTaxonomyLabels } from '@/lib/directory/public/data'
import type { DirectoryPublicProfileRow } from '@/lib/directory/public/types'
import { directoryPremiumInitialsFromName } from '@/components/directory/public/listing/directoryListingPremiumHelpers'

import './directory-listing-premium.css'

export function DirectoryFeaturedSlider({
  profiles,
  taxonomyByProfileId,
}: {
  profiles: DirectoryPublicProfileRow[]
  taxonomyByProfileId: Map<string, ProfileTaxonomyLabels>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  const slide = useCallback((dir: number) => {
    const el = ref.current
    if (!el) return
    const card = el.querySelector('.dlp-card')
    const w = card ? (card as HTMLElement).offsetWidth + 20 : 360
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }, [])

  if (profiles.length === 0) return null

  useEffect(() => {
    if (paused) return
    const t = window.setInterval(() => {
      const el = ref.current
      if (!el) return
      const maxLeft = el.scrollWidth - el.clientWidth
      if (maxLeft <= 0) return
      const nearEnd = el.scrollLeft >= maxLeft - 5
      if (nearEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        slide(1)
      }
    }, 4500)
    return () => window.clearInterval(t)
  }, [paused, slide])

  return (
    <div
      className="featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="featured-inner dlp-vars">
        <div className="hero-tag" style={{ marginBottom: 12 }}>
          <i className="bi bi-stars" aria-hidden />
          Top Profile
        </div>
        <div className="section-title">Top Profile im Verzeichnis</div>
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
              const fachList = (tax?.specialties ?? []).filter(Boolean)
              const fachText = fachList.length > 0 ? fachList.join(' · ') : 'Tierbehandler:in'
              const animals = (tax?.animals ?? []).slice(0, 3)
              const location = [p.postal_code, p.city].filter(Boolean).join(' ')
              const locLabel = [location, p.state].filter(Boolean).join(' · ') || 'Ort folgt'
              const href = `/behandler/${p.slug}`
              const ini = directoryPremiumInitialsFromName(p.display_name)

              return (
                <Link key={p.id} href={href} className="dlp-card">
                  <div className="dlp-card-body">
                    <div className="dlp-cb-top">
                      <div className="dlp-cb-avatar" aria-hidden="true">
                        {ini}
                      </div>
                      <div className="dlp-cb-info">
                        <div className="dlp-cb-name">
                          {p.display_name}
                          {p.verification_state === 'verified' ? (
                            <span className="dlp-verified" title="Verifiziert" aria-label="Verifiziert">
                              <i className="bi bi-patch-check-fill" aria-hidden />
                            </span>
                          ) : null}
                        </div>
                        <div className="dlp-cb-fach">{fachText}</div>
                      </div>
                    </div>
                    <div className="dlp-cb-tags">
                      {animals.map((a) => (
                        <span key={a} className="dlp-tag dlp-tag-a">
                          {a}
                        </span>
                      ))}
                      {p.service_type === 'mobile' || p.service_type === 'both' ? (
                        <span className="dlp-tag dlp-tag-m">Mobil</span>
                      ) : null}
                      {p.service_type === 'stationary' ? (
                        <span className="dlp-tag dlp-tag-m">Praxis</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="dlp-card-foot">
                    <div className="dlp-cf-loc">
                      <i className="bi bi-geo-alt-fill" aria-hidden />
                      {locLabel}
                    </div>
                    <div className="dlp-cf-actions">
                      <span className="dlp-cf-btn dlp-cf-primary">Profil ansehen</span>
                    </div>
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
