'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_GALLERY_DISPLAY = 6

export type DirectoryProfileGalleryPhoto = {
  id: string
  url: string
  alt_text: string | null
}

export function DirectoryProfileGalleryGrid({
  photos,
  displayName,
}: {
  photos: DirectoryProfileGalleryPhoto[]
  displayName: string
}) {
  const list = photos.slice(0, MAX_GALLERY_DISPLAY)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()

  const close = useCallback(() => setOpenIndex(null), [])

  const goPrev = useCallback(() => {
    setOpenIndex((i) => {
      if (i === null || list.length < 2) return i
      return (i - 1 + list.length) % list.length
    })
  }, [list.length])

  const goNext = useCallback(() => {
    setOpenIndex((i) => {
      if (i === null || list.length < 2) return i
      return (i + 1) % list.length
    })
  }, [list.length])

  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => closeBtnRef.current?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [openIndex, close, goPrev, goNext])

  if (list.length === 0) return null

  const active = openIndex !== null ? list[openIndex] : null

  const modalEl =
    active && openIndex !== null ? (
      <div
        id={dialogId}
        className="dir-prof-v2-gal-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Vergrößerte Galerie"
      >
        <button
          type="button"
          className="dir-prof-v2-gal-modal-backdrop"
          onClick={close}
          aria-label="Schließen"
        />
        <div className="dir-prof-v2-gal-modal-panel">
          <button
            ref={closeBtnRef}
            type="button"
            className="dir-prof-v2-gal-modal-close"
            onClick={close}
            aria-label="Schließen"
          >
            <i className="bi bi-x-lg" aria-hidden />
          </button>
          {list.length > 1 ? (
            <>
              <button
                type="button"
                className="dir-prof-v2-gal-modal-nav dir-prof-v2-gal-modal-nav--prev"
                onClick={goPrev}
                aria-label="Vorheriges Bild"
              >
                <i className="bi bi-chevron-left" aria-hidden />
              </button>
              <button
                type="button"
                className="dir-prof-v2-gal-modal-nav dir-prof-v2-gal-modal-nav--next"
                onClick={goNext}
                aria-label="Nächstes Bild"
              >
                <i className="bi bi-chevron-right" aria-hidden />
              </button>
            </>
          ) : null}
          <div className="dir-prof-v2-gal-modal-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.alt_text?.trim() || `${displayName} — Galerie`}
              className="dir-prof-v2-gal-modal-img"
            />
          </div>
          {list.length > 1 ? (
            <div className="dir-prof-v2-gal-modal-count" aria-live="polite">
              {openIndex + 1} / {list.length}
            </div>
          ) : null}
        </div>
      </div>
    ) : null

  return (
    <>
      <div className="dir-prof-v2-gal-grid">
        {list.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className="dir-prof-v2-gal-tile"
            onClick={() => setOpenIndex(i)}
            aria-haspopup="dialog"
            aria-expanded={openIndex === i}
            aria-controls={dialogId}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- öffentliche Storage-URL */}
            <img
              src={m.url}
              alt={m.alt_text?.trim() || `${displayName} — Galeriebild ${i + 1}`}
              loading="lazy"
            />
            <span className="dir-prof-v2-gal-tile-ov" aria-hidden>
              <i className="bi bi-zoom-in" />
            </span>
          </button>
        ))}
      </div>

      {typeof document !== 'undefined' && modalEl ? createPortal(modalEl, document.body) : null}
    </>
  )
}
