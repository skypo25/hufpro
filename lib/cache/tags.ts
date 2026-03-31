/**
 * Cache-Tags für next/cache (revalidateTag).
 * Namen sind bewusst user- bzw. ressourcenspezifisch — keine globalen „alles“-Tags.
 */

import { revalidateTag } from 'next/cache'

/** Kurze TTLs (Sekunden) — siehe jeweilige Route */
export const CACHE_REVALIDATE_SECONDS = {
  /** OSRM-Routen (kein User-PII im Key) */
  routeDistance: 30 * 60,
  dashboardMobile: 45,
  hoofCompare: 90,
} as const

/** Mobile-Dashboard JSON (/api/dashboard/mobile) */
export function dashboardMobileTag(userId: string) {
  return `dashboard-mobile:${userId}`
}

/** Fotovergleich-Daten pro Nutzer und Pferd (GET /api/horses/[id]/hoof-compare) */
export function hoofCompareTag(userId: string, horseId: string) {
  return `hoof-compare:${userId}:${horseId}`
}

export function revalidateDashboardMobileForUser(userId: string) {
  revalidateTag(dashboardMobileTag(userId))
}

export function revalidateHoofCompareForHorse(userId: string, horseId: string) {
  revalidateTag(hoofCompareTag(userId, horseId))
}

/** Relevante Query-Parameter für den Vergleich (Cache-Key, nicht Security) */
export function stableHoofCompareParamKey(
  sp: Record<string, string | string[] | undefined>
): string {
  const left = typeof sp.left === 'string' ? sp.left : ''
  const right = typeof sp.right === 'string' ? sp.right : ''
  const hoof = typeof sp.hoof === 'string' ? sp.hoof : ''
  const view = typeof sp.view === 'string' ? sp.view : ''
  return `${left}|${right}|${hoof}|${view}`
}
