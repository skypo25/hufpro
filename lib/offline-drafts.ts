/**
 * Offline Draft Storage – IndexedDB-basierte lokale Speicherung von Dokumentations-Entwürfen.
 * Bei erneuter Verbindung können Entwürfe mit syncDraft() an den Server gesendet werden.
 */

const DB_NAME = 'anidocs-offline'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

export type DraftKey = `record:${string}:${string}` | `record:${string}`

export interface RecordDraft {
  horseId: string
  recordId?: string
  formData: Record<string, unknown>
  updatedAt: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
  })
}

export async function saveDraft(key: DraftKey, data: RecordDraft): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ key, ...data, updatedAt: new Date().toISOString() })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getDraft(key: DraftKey): Promise<RecordDraft | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    tx.oncomplete = () => {
      db.close()
      const row = req.result
      if (!row) {
        resolve(null)
        return
      }
      const { key: _k, ...draft } = row
      resolve(draft as RecordDraft)
    }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function listDrafts(): Promise<{ key: DraftKey; draft: RecordDraft }[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    tx.oncomplete = () => {
      db.close()
      const rows = (req.result ?? []) as ({ key: DraftKey } & RecordDraft)[]
      resolve(rows.map(({ key: k, ...draft }) => ({ key: k, draft: draft as RecordDraft })))
    }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function deleteDraft(key: DraftKey): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
