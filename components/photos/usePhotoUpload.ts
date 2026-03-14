'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
import { processHoofImage, processWholeBodyImage } from './imageProcessing'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'

export type HoofPhotoRow = {
  id: string
  hoof_record_id: string | null
  file_path: string | null
  photo_type: string | null
  annotations_json?: unknown
  width?: number | null
  height?: number | null
  file_size?: number | null
  mime_type?: string | null
}

export type StagedPhoto = {
  slot: PhotoSlotKey
  blob: Blob
  width: number
  height: number
  previewUrl: string
}

/**
 * Upload eines bereits verarbeiteten Bildes zu Storage + DB.
 * Pfad: horse_id/record_id/slot.jpg
 */
export async function uploadProcessedPhoto(
  params: {
    recordId: string
    horseId: string
    slot: PhotoSlotKey
    blob: Blob
    width: number
    height: number
    annotationsJson?: unknown
  }
): Promise<HoofPhotoRow> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht eingeloggt')

  const ext = 'jpg'
  const fileName = `${params.slot}.${ext}`
  const filePath = `${params.horseId}/${params.recordId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('hoof-photos')
    .upload(filePath, params.blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (uploadError) throw new Error(`Upload: ${uploadError.message}`)

  const fileSize = params.blob.size

  await supabase
    .from('hoof_photos')
    .delete()
    .eq('hoof_record_id', params.recordId)
    .eq('photo_type', params.slot)
    .eq('user_id', user.id)

  const basePayload = {
    user_id: user.id,
    hoof_record_id: params.recordId,
    file_path: filePath,
    photo_type: params.slot,
  }
  const fullPayload = {
    ...basePayload,
    width: params.width,
    height: params.height,
    file_size: fileSize,
    mime_type: 'image/jpeg',
    annotations_json: params.annotationsJson ?? null,
  }

  let inserted: HoofPhotoRow
  const { data: dataFull, error: errFull } = await supabase
    .from('hoof_photos')
    .insert(fullPayload)
    .select()
    .single<HoofPhotoRow>()

  if (!errFull && dataFull) {
    return dataFull
  }

  const isSchemaError =
    errFull?.message?.includes('annotations_json') ||
    errFull?.message?.includes('schema cache') ||
    errFull?.message?.includes('column')

  if (isSchemaError) {
    const { data: dataMin, error: errMin } = await supabase
      .from('hoof_photos')
      .insert(basePayload)
      .select()
      .single<HoofPhotoRow>()
    if (errMin) throw new Error(`DB: ${errMin.message}`)
    if (!dataMin) throw new Error('DB: Insert fehlgeschlagen')
    return dataMin
  }

  throw new Error(`DB: ${errFull?.message ?? 'Unbekannter Fehler'}`)
}

/**
 * Hook: Datei wählen → verarbeiten (Huf oder Ganzkörper) → optional sofort hochladen
 * oder nur als Staged zurückgeben.
 */
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processAndStage = useCallback(
    async (file: File, isWholeBody: boolean): Promise<StagedPhoto | null> => {
      setError(null)
      try {
        const result = isWholeBody
          ? await processWholeBodyImage(file)
          : await processHoofImage(file)
        const previewUrl = URL.createObjectURL(result.blob)
        return {
          slot: '' as PhotoSlotKey,
          blob: result.blob,
          width: result.width,
          height: result.height,
          previewUrl,
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Verarbeitung fehlgeschlagen')
        return null
      }
    },
    []
  )

  const uploadStaged = useCallback(
    async (
      recordId: string,
      horseId: string,
      staged: StagedPhoto,
      annotationsJson?: unknown
    ): Promise<HoofPhotoRow> => {
      setUploading(true)
      setError(null)
      try {
        const row = await uploadProcessedPhoto({
          recordId,
          horseId,
          slot: staged.slot,
          blob: staged.blob,
          width: staged.width,
          height: staged.height,
          annotationsJson,
        })
        if (staged.previewUrl) URL.revokeObjectURL(staged.previewUrl)
        return row
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
        throw e
      } finally {
        setUploading(false)
      }
    },
    []
  )

  return { processAndStage, uploadStaged, uploading, error }
}
