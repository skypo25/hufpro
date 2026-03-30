'use client'

import { useState, useEffect } from 'react'

export type ErstterminBodyPhoto = {
  url: string
  label: string
}

export type ErstterminBodyPhotosCardProps = {
  photos: ErstterminBodyPhoto[]
  recordDate?: string | null
}

function formatGermanDate(dateString: string | null | undefined) {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export default function ErstterminBodyPhotosCard(props: ErstterminBodyPhotosCardProps) {
  const { photos, recordDate } = props
  const [enlargeUrl, setEnlargeUrl] = useState<string | null>(null)
  const formattedDate = formatGermanDate(recordDate)

  useEffect(() => {
    if (!enlargeUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlargeUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enlargeUrl])

  if (photos.length === 0) return null

  return (
    <>
      <section className="huf-card huf-card--lg">
        <div className="border-b border-[#E5E2DC] px-5 py-4">
          <h4 className="dashboard-serif text-[15px] font-medium text-[#1B1F23]">
            Ganzkörperbilder (Ersttermin)
          </h4>
        </div>
        <div className="px-5 py-[18px]">
          <p className="mb-3 text-[12px] text-[#6B7280]">
            Referenzfotos vom ersten Termin – zum Vergrößern antippen.
          </p>
          <div className="space-y-3">
            {photos.map((photo) => (
              <button
                key={photo.url}
                type="button"
                onClick={() => setEnlargeUrl(photo.url)}
                className="relative block w-full overflow-hidden rounded-xl border border-[#E5E2DC] bg-[#E5E2DC] text-left transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#52b788] focus:ring-offset-2"
              >
                <img
                  src={photo.url}
                  alt={photo.label}
                  className="aspect-video w-full object-cover"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E2DC] bg-[#FAFAF8] px-3 py-2">
                  <span className="text-[13px] font-medium text-[#1B1F23]">{photo.label}</span>
                  {formattedDate && (
                    <span className="text-[12px] text-[#6B7280]">Aufnahme: {formattedDate}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {enlargeUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Bild vergrößert"
          onClick={() => setEnlargeUrl(null)}
          onKeyDown={(e) => e.key === 'Escape' && setEnlargeUrl(null)}
        >
          <button
            type="button"
            onClick={() => setEnlargeUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            title="Schließen"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={enlargeUrl}
            alt="Vergrößert"
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
