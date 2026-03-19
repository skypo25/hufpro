'use client'

import { useRef, useState } from 'react'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'
import type { StagedPhoto } from './usePhotoUpload'
import type { AnnotationsData } from '@/lib/photos/annotations'
import PhotoAnnotator from './PhotoAnnotator'
import { processHoofImage, processWholeBodyImage } from './imageProcessing'

export type ExistingPhoto = {
  id: string
  file_path: string
  photo_type: string
  width?: number | null
  height?: number | null
  annotations_json?: unknown
}

type PhotoSlotProps = {
  slot: PhotoSlotKey
  slotLabel: string
  recordId: string | null
  horseId: string
  existingPhoto?: ExistingPhoto | null
  imageUrl?: string | null
  stagedPhoto?: StagedPhoto | null
  isWholeBody?: boolean
  allowAnnotation?: boolean
  onFileSelect: (file: File) => void
  onStagedRemove?: () => void
  onReplace?: () => void
  onRemoveExisting?: () => void
  onAnnotationsChange?: (annotations: AnnotationsData) => void
  /** Wenn gesetzt (z. B. bei neuem Record): Annotationen kommen vom Parent; beim Bildwechsel werden sie dort zurückgesetzt */
  annotationsFromParent?: AnnotationsData
  uploading?: boolean
}

export default function PhotoSlot({
  slot,
  slotLabel,
  recordId,
  horseId,
  existingPhoto,
  imageUrl,
  stagedPhoto,
  isWholeBody = false,
  allowAnnotation = true,
  onFileSelect,
  onStagedRemove,
  onReplace,
  onRemoveExisting,
  onAnnotationsChange,
  annotationsFromParent,
  uploading = false,
}: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showAnnotateModal, setShowAnnotateModal] = useState(false)
  const [localAnnotations, setLocalAnnotations] = useState<AnnotationsData>({ version: 1, items: [] })

  const hasPhoto = !!(existingPhoto?.file_path && imageUrl) || !!stagedPhoto
  const displayUrl = stagedPhoto?.previewUrl ?? imageUrl ?? null
  const isControlled = !!stagedPhoto && annotationsFromParent !== undefined
  const annotations = existingPhoto?.annotations_json
    ? (typeof existingPhoto.annotations_json === 'object' && existingPhoto.annotations_json && 'items' in existingPhoto.annotations_json
        ? (existingPhoto.annotations_json as AnnotationsData)
        : { version: 1, items: [] })
    : (isControlled ? annotationsFromParent! : localAnnotations)
  const width = existingPhoto?.width ?? stagedPhoto?.width ?? 0
  const height = existingPhoto?.height ?? stagedPhoto?.height ?? 0

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onFileSelect(file)
    e.target.value = ''
  }

  const handleAnnotationsChange = (next: AnnotationsData) => {
    if (!isControlled) setLocalAnnotations(next)
    onAnnotationsChange?.(next)
  }

  const aspectClass = isWholeBody ? 'aspect-video' : 'aspect-[9/16]'

  if (!hasPhoto) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-[#E5E2DC] bg-[rgba(0,0,0,0.01)] px-3 py-4 transition hover:border-[#52b788] hover:bg-[rgba(21,66,38,0.03)] ${aspectClass}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading ? (
          <span className="text-[13px] text-[#6B7280]">Wird verarbeitet …</span>
        ) : (
          <>
            <div className="mb-1 text-[24px] opacity-50">{isWholeBody ? '🐴' : '📸'}</div>
            <div className="text-[11px] font-semibold text-[#6B7280]">{slotLabel}</div>
            <div className="mt-0.5 text-[10px] text-[#9CA3AF]">Antippen zum Hochladen</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col rounded-[12px] border-2 border-[#E5E2DC] overflow-hidden bg-[#E5E2DC] ${aspectClass}`}>
      <div className="relative flex-1 min-h-0 overflow-hidden bg-[#E5E2DC]">
        {displayUrl && (
          allowAnnotation ? (
            <>
              <div
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={() => setShowAnnotateModal(true)}
                title="Zum Markieren vergrößern"
              />
              <PhotoAnnotator
                imageUrl={displayUrl}
                width={width || 400}
                height={height || 711}
                annotations={annotations}
                onChange={handleAnnotationsChange}
                readOnly={false}
                showToolbar={false}
                className="h-full w-full"
              />
              <div className="absolute left-2 top-2 z-20 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-medium text-white pointer-events-none">
                {slotLabel}
              </div>
            </>
          ) : (
            <img
              src={displayUrl}
              alt={slotLabel}
              className="h-full w-full object-cover"
            />
          )
        )}
        <div className="absolute right-2 top-2 z-20 flex gap-1">
          {allowAnnotation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowAnnotateModal(true)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70"
              title="Markieren / Bearbeiten"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {existingPhoto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70"
              title="Ersetzen"
            >
              ↻
            </button>
          )}
          {existingPhoto && onRemoveExisting && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveExisting()
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-red-300 hover:bg-red-500/80 hover:text-white"
              title="Foto entfernen"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {stagedPhoto && onStagedRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onStagedRemove()
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70"
              title="Hochladen abbrechen"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {showAnnotateModal && displayUrl && allowAnnotation && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Bild markieren"
          onKeyDown={(e) => e.key === 'Escape' && setShowAnnotateModal(false)}
        >
          <div className="flex shrink-0 items-center justify-end py-2">
            <button
              type="button"
              onClick={() => setShowAnnotateModal(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
              title="Schließen"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 flex items-center justify-center">
            <div className="aspect-[9/16] h-full max-h-[calc(100vh-100px)] w-auto max-w-full">
              <div className="relative h-full w-full">
                <PhotoAnnotator
                  imageUrl={displayUrl}
                  width={width || 400}
                  height={height || 711}
                  annotations={annotations}
                  onChange={handleAnnotationsChange}
                  readOnly={false}
                  showToolbar={true}
                  className="h-full w-full"
                />
                <div className="absolute left-2 top-2 z-20 rounded-lg bg-black/50 px-2 py-1 text-[13px] font-medium text-white">
                  {slotLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
