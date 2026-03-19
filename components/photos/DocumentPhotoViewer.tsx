'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PhotoAnnotator from './PhotoAnnotator'
import type { AnnotationsData } from '@/lib/photos/annotations'

export type DocumentPhotoItem = {
  id: string
  imageUrl: string
  annotations: AnnotationsData
  label: string
  isWholeBody: boolean
  width: number
  height: number
}

type DocumentPhotoViewerProps = {
  item: DocumentPhotoItem
}

export default function DocumentPhotoViewer({ item }: DocumentPhotoViewerProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, closeModal])

  const { imageUrl, annotations, label, isWholeBody, width, height } = item
  const aspectClass = isWholeBody ? 'aspect-video' : 'aspect-[9/16]'

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`group relative w-full overflow-hidden rounded-[10px] border border-[#E5E2DC] text-left transition hover:border-[#52b788] hover:shadow-md ${aspectClass}`}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-[#E5E2DC]">
          <PhotoAnnotator
            imageUrl={imageUrl}
            width={width || 400}
            height={height || 711}
            annotations={annotations}
            onChange={() => {}}
            readOnly
            showToolbar={false}
            className="h-full w-full"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2">
          <span className="text-[11px] font-medium text-white">{label}</span>
        </div>
        <div className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-[10px] font-medium text-white">
          Vergrößern
        </div>
      </button>

      {modalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Foto vergrößern: ${label}`}
          >
            <button
              type="button"
              className="absolute inset-0 z-0"
              aria-hidden
              onClick={closeModal}
            />
            <div className="relative z-10 flex shrink-0 items-center justify-between py-2">
              <span className="text-sm font-medium text-white">{label}</span>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
                title="Schließen"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              className="relative z-10 flex min-h-[300px] flex-1 items-center justify-center overflow-auto p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative shrink-0 cursor-default overflow-hidden rounded-lg bg-[#1a1a1a]"
                style={
                  isWholeBody
                    ? {
                        width: 'min(90vw, (100vh - 120px) * 16/9)',
                        height: 'min(calc(100vh - 120px), 90vw * 9/16)',
                        minWidth: 280,
                        minHeight: 158,
                      }
                    : {
                        width: 'min(90vw, (100vh - 120px) * 9/16)',
                        height: 'min(calc(100vh - 120px), 90vw * 16/9)',
                        minWidth: 200,
                        minHeight: 356,
                      }
                }
              >
                <PhotoAnnotator
                  imageUrl={imageUrl}
                  width={width || 400}
                  height={height || 711}
                  annotations={annotations}
                  onChange={() => {}}
                  readOnly
                  showToolbar={false}
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
