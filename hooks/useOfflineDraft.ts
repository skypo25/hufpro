'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteDraft,
  getDraft,
  listDrafts,
  saveDraft,
  type DraftKey,
  type RecordDraft,
} from '@/lib/offline-drafts'

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
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

const PERSIST_DEBOUNCE_MS = 1500

export function useOfflineDraft(horseId: string, recordId?: string) {
  const key: DraftKey = recordId ? `record:${horseId}:${recordId}` : `record:${horseId}`
  const [draft, setDraft] = useState<RecordDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const d = await getDraft(key)
    setDraft(d)
    setLoading(false)
  }, [key])

  useEffect(() => {
    load()
  }, [load])

  const persist = useCallback(
    (formData: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null
        try {
          await saveDraft(key, {
            horseId,
            recordId,
            formData,
            updatedAt: new Date().toISOString(),
          })
          setDraft({ horseId, recordId, formData, updatedAt: new Date().toISOString() })
        } catch (e) {
          console.warn('Offline-Draft speichern fehlgeschlagen:', e)
        }
      }, PERSIST_DEBOUNCE_MS)
    },
    [key, horseId, recordId]
  )

  const persistImmediate = useCallback(
    async (formData: Record<string, unknown>) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
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
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    await deleteDraft(key)
    setDraft(null)
  }, [key])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  return { draft, loading, persist, persistImmediate, clear, reload: load }
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
