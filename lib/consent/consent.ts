/**
 * Cookie-/Einwilligungslogik (DSGVO-orientiert, Opt-in).
 * Keine Drittanbieter-Skripte vor Zustimmung — Nutzung nur über hasConsent() + gezieltes Laden.
 */

export const CONSENT_STORAGE_KEY = 'anidocs_consent'
export const CONSENT_COOKIE_NAME = 'anidocs_consent'
export const CONSENT_VERSION = 1

export const CONSENT_CHANGED_EVENT = 'anidocs:consent-changed'

export type ConsentCategory = 'essential' | 'analytics' | 'maps' | 'marketing'

export type ConsentRecord = {
  essential: true
  analytics: boolean
  maps: boolean
  marketing: boolean
  timestamp: number
  consent_version: number
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getDefaultConsent(): ConsentRecord {
  return {
    essential: true,
    analytics: false,
    maps: false,
    marketing: false,
    timestamp: Date.now(),
    consent_version: CONSENT_VERSION,
  }
}

function isConsentRecord(v: unknown): v is ConsentRecord {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.essential !== true) return false
  if (typeof o.analytics !== 'boolean') return false
  if (typeof o.maps !== 'boolean') return false
  if (typeof o.marketing !== 'boolean') return false
  if (typeof o.timestamp !== 'number') return false
  if (typeof o.consent_version !== 'number') return false
  return true
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function readFromLocalStorage(): ConsentRecord | null {
  if (!isBrowser()) return null
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
  if (!raw) return null
  const parsed = parseJson(raw)
  return isConsentRecord(parsed) ? parsed : null
}

function readFromCookie(): ConsentRecord | null {
  if (!isBrowser()) return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`))
  if (!match?.[1]) return null
  let decoded = match[1]
  try {
    decoded = decodeURIComponent(match[1])
  } catch {
    /* use raw */
  }
  const parsed = parseJson(decoded)
  return isConsentRecord(parsed) ? parsed : null
}

/** Liest gespeicherte Einwilligung (localStorage bevorzugt, sonst Cookie). Server: immer null. */
export function getConsent(): ConsentRecord | null {
  if (!isBrowser()) return null
  const fromLs = readFromLocalStorage()
  const fromCk = readFromCookie()
  if (fromLs && fromCk) {
    return fromLs.timestamp >= fromCk.timestamp ? fromLs : fromCk
  }
  return fromLs ?? fromCk
}

function writeCookie(record: ConsentRecord): void {
  if (!isBrowser()) return
  const maxAge = 60 * 60 * 24 * 400
  const payload = encodeURIComponent(JSON.stringify(record))
  document.cookie = `${CONSENT_COOKIE_NAME}=${payload}; Max-Age=${maxAge}; Path=/; SameSite=Lax`
}

function clearCookie(): void {
  if (!isBrowser()) return
  document.cookie = `${CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`
}

export function dispatchConsentChanged(record: ConsentRecord | null): void {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: record }))
}

/** Speichert vollständigen Datensatz und benachrichtigt Listener. */
export function setConsent(record: ConsentRecord): void {
  if (!isBrowser()) return
  const normalized: ConsentRecord = {
    essential: true,
    analytics: Boolean(record.analytics),
    maps: Boolean(record.maps),
    marketing: Boolean(record.marketing),
    timestamp: record.timestamp || Date.now(),
    consent_version: CONSENT_VERSION,
  }
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(normalized))
  writeCookie(normalized)
  dispatchConsentChanged(normalized)
}

export function resetConsent(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  clearCookie()
  dispatchConsentChanged(null)
}

export function hasConsent(record: ConsentRecord | null, category: ConsentCategory): boolean {
  if (category === 'essential') return true
  if (!record) return false
  if (record.consent_version !== CONSENT_VERSION) return false
  switch (category) {
    case 'analytics':
      return record.analytics
    case 'maps':
      return record.maps
    case 'marketing':
      return record.marketing
    default:
      return false
  }
}

/** true, wenn gültige Einwilligung mit aktueller Version vorliegt (Banner unterdrücken). */
export function hasStoredConsentDecision(record: ConsentRecord | null): boolean {
  if (!record) return false
  return record.consent_version === CONSENT_VERSION && Number.isFinite(record.timestamp)
}

export function subscribeConsent(cb: (record: ConsentRecord | null) => void): () => void {
  if (!isBrowser()) return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CONSENT_STORAGE_KEY) return
    cb(getConsent())
  }
  const onCustom = (e: Event) => {
    const ce = e as CustomEvent<ConsentRecord | null | undefined>
    cb(ce.detail === undefined ? getConsent() : ce.detail)
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CONSENT_CHANGED_EVENT, onCustom as EventListener)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CONSENT_CHANGED_EVENT, onCustom as EventListener)
  }
}
