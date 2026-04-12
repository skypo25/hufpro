/**
 * Laufzeit-Overrides für Foto-Grid-Debug: zuerst In-Memory (gleicher JS-Kontext wie installierte PWA),
 * dann localStorage (persistiert innerhalb derselben PWA-Partition).
 * Änderungen triggern `subscribePhotoDebug` → `useSyncExternalStore` in Komponenten.
 */

const overrides = new Map<string, string>()

function rawLsGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function rawLsRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function rawLsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

let version = 0
const listeners = new Set<() => void>()

function bump() {
  version += 1
  for (const fn of listeners) fn()
}

export function getPhotoDebugVersion(): number {
  return version
}

export function subscribePhotoDebug(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

/** Aktueller Wert: In-App-Override schlägt localStorage (Safari-Partition unabhängig für dieselbe Session). */
export function getPhotoDebug(key: string): string | null {
  if (overrides.has(key)) return overrides.get(key) ?? null
  return rawLsGet(key)
}

export function setPhotoDebug(key: string, value: string | null): void {
  if (value == null || value === '') {
    overrides.delete(key)
    rawLsRemove(key)
  } else {
    overrides.set(key, value)
    rawLsSet(key, value)
  }
  bump()
}

/** Alle UI-/Grid-Debug-Keys leeren (Memory + localStorage dieser App-Instanz). */
export const PHOTO_GRID_DEBUG_RESET_KEYS = [
  'hufpflege_debug_photos',
  'hufpflege_photo_tile_log',
  'hufpflege_photo_tile_overlay',
  'hufpflege_photo_disable_stagger',
  'hufpflege_photo_disable_grid_remount',
  'hufpflege_photo_disable_intersection',
  'hufpflege_photo_decoding_sync',
  'hufpflege_photo_disable_layer_promote',
  'hufpflege_photo_object_fit_contain',
  'hufpflege_photo_use_bg_image',
  'hufpflege_photo_remount_delay_ms',
  'hufpflege_photo_strip_warn',
] as const

export function resetAllPhotoGridDebugKeys(): void {
  for (const k of PHOTO_GRID_DEBUG_RESET_KEYS) {
    overrides.delete(k)
    rawLsRemove(k)
  }
  bump()
}
