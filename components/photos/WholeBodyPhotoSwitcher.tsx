'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export type WholeBodyPhotoItem = {
  id: string
  imageUrl: string
  label: string
}

type WholeBodyPhotoSwitcherProps = {
  items: WholeBodyPhotoItem[]
  /** Optional: date shown below label (e.g. documentation date) */
  dateLabel?: string
}

function SwitcherContent({
  items,
  activeIndex,
  setActiveIndex,
  compact = false,
  dateLabel,
}: {
  items: WholeBodyPhotoItem[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  compact?: boolean
  dateLabel?: string
}) {
  const current = items[activeIndex] ?? items[0]
  /** Unter dem Bild statt Verlauf über dem Foto; im Vollbild-Modal steht die Info im Header */
  const showCaptionBelow = compact
  return (
    <div className={showCaptionBelow ? 'flex w-full flex-col overflow-hidden' : 'contents'}>
      <div
        className={`relative w-full overflow-hidden bg-[#E5E2DC] ${
          showCaptionBelow ? 'aspect-[4/3]' : 'h-full min-h-0'
        }`}
      >
        <img
          src={current.imageUrl}
          alt={current.label}
          className="h-full w-full object-cover"
          sizes={compact ? '(max-width: 1024px) 100vw, 380px' : '100vw'}
        />
        {items.length > 1 && (
          <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1.5 drop-shadow-md">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveIndex(i)
                }}
                className={`relative shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  compact ? 'h-12 w-16' : 'h-14 w-[72px]'
                } ${
                  i === activeIndex
                    ? 'border-white shadow-md ring-2 ring-white/50'
                    : 'border-white/80 opacity-90 hover:opacity-100'
                }`}
                aria-label={`${item.label} anzeigen`}
                aria-current={i === activeIndex ? 'true' : undefined}
              >
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      {showCaptionBelow && (
        <div className="flex shrink-0 flex-col gap-0.5 rounded-b-xl border-t border-[#E5E2DC] bg-[#FAFAF8] px-3 py-2">
          <span className="text-[11px] font-medium leading-tight text-[#1B1F23]">{current.label}</span>
          {dateLabel && <span className="text-[10px] text-[#6B7280]">{dateLabel}</span>}
        </div>
      )}
    </div>
  )
}

export default function WholeBodyPhotoSwitcher({ items, dateLabel }: WholeBodyPhotoSwitcherProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  const closeModal = useCallback(() => setModalOpen(false), [])
  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, closeModal])

  if (items.length === 0) return null

  const current = items[activeIndex] ?? items[0]

  const openModal = useCallback(() => setModalOpen(true), [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openModal()
      }
    },
    [openModal]
  )

  return (
    <>
      <div className="relative w-full overflow-hidden rounded-xl border border-[#E5E2DC] bg-[#E5E2DC]">
        <div
          role="button"
          tabIndex={0}
          onClick={openModal}
          onKeyDown={handleKeyDown}
          className="relative block w-full cursor-zoom-in text-left outline-none focus-visible:ring-2 focus-visible:ring-[#52b788] focus-visible:ring-offset-2"
          aria-label={`${current.label} vergrößern`}
        >
          <SwitcherContent
            items={items}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            compact
            dateLabel={dateLabel}
          />
        </div>
      </div>

      {modalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/90"
            role="dialog"
            aria-modal="true"
            aria-label="Ganzkörperfoto vergrößert"
          >
            <button
              type="button"
              className="absolute inset-0 z-0"
              aria-hidden
              onClick={closeModal}
            />
            <div className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-white">{current.label}</span>
                {dateLabel && <span className="text-[10px] text-white/90">{dateLabel}</span>}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
                aria-label="Schließen"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-xl">
                <div className="relative aspect-[4/3] max-h-[calc(100vh-120px)] w-full max-w-4xl">
                  <SwitcherContent
                    items={items}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    dateLabel={dateLabel}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
