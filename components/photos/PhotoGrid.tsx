'use client'

import { useCallback } from 'react'
import { SLOT_SOLAR, SLOT_LATERAL, SLOT_WHOLE_BODY, SLOT_LABELS } from '@/lib/photos/photoTypes'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'
import type { AnnotationsData } from '@/lib/photos/annotations'
import type { StagedPhoto } from './usePhotoUpload'
import type { ExistingPhoto } from './PhotoSlot'
import PhotoSlot from './PhotoSlot'
import { processHoofImage, processWholeBodyImage } from './imageProcessing'

export type PhotoGridProps = {
  recordId: string | null
  horseId: string
  existingPhotos?: ExistingPhoto[]
  imageUrls?: Record<string, string>
  stagedPhotos?: Partial<Record<PhotoSlotKey, StagedPhoto>>
  annotationsBySlot?: Partial<Record<PhotoSlotKey, AnnotationsData>>
  isErsttermin?: boolean
  onStagedAdd?: (slot: PhotoSlotKey, staged: StagedPhoto) => void
  onStagedRemove?: (slot: PhotoSlotKey) => void
  onRemoveExistingPhoto?: (photoId: string) => void
  onFileSelect?: (slot: PhotoSlotKey, file: File) => void
  onAnnotationsChange?: (slot: PhotoSlotKey, annotations: import('@/lib/photos/annotations').AnnotationsData) => void
  uploadingSlot?: PhotoSlotKey | null
}

export default function PhotoGrid({
  recordId,
  horseId,
  existingPhotos = [],
  imageUrls = {},
  stagedPhotos = {},
  annotationsBySlot = {},
  isErsttermin = false,
  onStagedAdd,
  onStagedRemove,
  onRemoveExistingPhoto,
  onFileSelect,
  onAnnotationsChange,
  uploadingSlot = null,
}: PhotoGridProps) {
  const bySlot = useCallback(
    (slot: string) => existingPhotos.find((p) => p.photo_type === slot) ?? null,
    [existingPhotos]
  )

  const handleFileSelect = useCallback(
    async (slot: PhotoSlotKey, file: File) => {
      const isWhole = SLOT_WHOLE_BODY.includes(slot as 'whole_left' | 'whole_right')
      try {
        const result = isWhole ? await processWholeBodyImage(file) : await processHoofImage(file)
        const previewUrl = URL.createObjectURL(result.blob)
        onStagedAdd?.(slot, {
          slot,
          blob: result.blob,
          width: result.width,
          height: result.height,
          previewUrl,
        })
      } catch {
        // Fehler in usePhotoUpload oder Parent anzeigen
      }
      onFileSelect?.(slot, file)
    },
    [onStagedAdd, onFileSelect]
  )

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
          Sohlenansicht (Solar)
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SLOT_SOLAR.map((slot) => {
            const existing = bySlot(slot)
            return (
              <PhotoSlot
                key={slot}
                slot={slot}
                slotLabel={SLOT_LABELS[slot] ?? slot}
                recordId={recordId}
                horseId={horseId}
                existingPhoto={existing}
                imageUrl={imageUrls[slot]}
                stagedPhoto={stagedPhotos[slot]}
                annotationsFromParent={annotationsBySlot[slot]}
                isWholeBody={false}
                allowAnnotation={true}
                onFileSelect={(file) => handleFileSelect(slot, file)}
                onStagedRemove={stagedPhotos[slot] ? () => onStagedRemove?.(slot) : undefined}
                onRemoveExisting={existing && onRemoveExistingPhoto ? () => onRemoveExistingPhoto(existing.id) : undefined}
                onAnnotationsChange={onAnnotationsChange ? (a) => onAnnotationsChange(slot, a) : undefined}
                uploading={uploadingSlot === slot}
              />
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
          Seitenansicht (Lateral)
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SLOT_LATERAL.map((slot) => {
            const existing = bySlot(slot)
            return (
              <PhotoSlot
                key={slot}
                slot={slot}
                slotLabel={SLOT_LABELS[slot] ?? slot}
                recordId={recordId}
                horseId={horseId}
                existingPhoto={existing}
                imageUrl={imageUrls[slot]}
                stagedPhoto={stagedPhotos[slot]}
                annotationsFromParent={annotationsBySlot[slot]}
                isWholeBody={false}
                allowAnnotation={true}
                onFileSelect={(file) => handleFileSelect(slot, file)}
                onStagedRemove={stagedPhotos[slot] ? () => onStagedRemove?.(slot) : undefined}
                onRemoveExisting={existing && onRemoveExistingPhoto ? () => onRemoveExistingPhoto(existing.id) : undefined}
                onAnnotationsChange={onAnnotationsChange ? (a) => onAnnotationsChange(slot, a) : undefined}
                uploading={uploadingSlot === slot}
              />
            )
          })}
        </div>
      </div>

      {isErsttermin && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
            Ganzkörperfotos (optional)
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-[#6B7280]">
            Bitte das gesamte Pferd von der Seite erfassen und das Gerät{' '}
            <strong className="font-medium text-[#4B5563]">im Querformat</strong> halten (Kamera quer, nicht
            hochkant).
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SLOT_WHOLE_BODY.map((slot) => {
              const existing = bySlot(slot)
              return (
                <PhotoSlot
                  key={slot}
                  slot={slot}
                  slotLabel={SLOT_LABELS[slot] ?? slot}
                  recordId={recordId}
                  horseId={horseId}
                  existingPhoto={existing}
                  imageUrl={imageUrls[slot]}
                  stagedPhoto={stagedPhotos[slot]}
                  isWholeBody={true}
                  allowAnnotation={false}
                  onFileSelect={(file) => handleFileSelect(slot, file)}
                  onStagedRemove={stagedPhotos[slot] ? () => onStagedRemove?.(slot) : undefined}
                  onRemoveExisting={existing && onRemoveExistingPhoto ? () => onRemoveExistingPhoto(existing.id) : undefined}
                  uploading={uploadingSlot === slot}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
