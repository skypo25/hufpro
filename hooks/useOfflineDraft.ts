'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  deleteDraft,
  getDraft,
  listDrafts,
  saveDraft,
  type DraftKey,
  type RecordDraft,
} from '@/lib/offline-drafts'

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])
  return online
}

export function useOfflineDraft(horseId: string, recordId?: string) {
  const key: DraftKey = recordId ? `record:${horseId}:${recordId}` : `record:${horseId}`
  const [draft, setDraft] = useState<RecordDraft | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const d = await getDraft(key)
    setDraft(d)
    setLoading(false)
  }, [key])

  useEffect(() => {
    load()
  }, [load])

  const persist = useCallback(
    async (formData: Record<string, unknown>) => {
      await saveDraft(key, {
        horseId,
        recordId,
        formData,
        updatedAt: new Date().toISOString(),
      })
      setDraft({ horseId, recordId, formData, updatedAt: new Date().toISOString() })
    },
    [key, horseId, recordId]
  )

  const clear = useCallback(async () => {
    await deleteDraft(key)
    setDraft(null)
  }, [key])

  return { draft, loading, persist, clear, reload: load }
}

export function usePendingDrafts() {
  const [drafts, setDrafts] = useState<{ key: DraftKey; draft: RecordDraft }[]>([])
  const load = useCallback(async () => {
    const list = await listDrafts()
    setDrafts(list)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return { drafts, reload: load }
}
