/**
 * Schalter für Fotodoku-Grid (PWA / WebKit).
 *
 * **Konsole (Timeline pro Kachel)**  
 * - `hufpflege_photo_tile_log` = `1` → `[photo-grid TILE]` bei onLoadStart / onLoad / afterDecode / rAF×2  
 * - oder `hufpflege_debug_photos` = `1` / `?debugPhotos=1` (inkl. Signed-URL-Logs)
 *
 * **Overlay auf jeder Kachel**  
 * - `hufpflege_photo_tile_overlay` = `1` oder `hufpflege_debug_photos` = `1`
 *
 * **Strip-Verdacht (automatisch)**  
 * - Heuristik nach 2× rAF: schmale `img`-Höhe vs. Slot → `console.warn('[photo-grid STRIP-SUSPECT]', …)`  
 * - Abschalten: `hufpflege_photo_strip_warn` = `0`
 *
 * **Gegentests / Matrix**  
 * - `hufpflege_photo_disable_stagger` = `1`  
 * - `hufpflege_photo_disable_grid_remount` = `1`  
 * - `hufpflege_photo_disable_intersection` = `1` (Standalone wie Browser-Tab, kein IO)  
 * - `hufpflege_photo_decoding_sync` = `0` (in Standalone trotzdem `decoding="async"`)  
 * - `hufpflege_photo_disable_layer_promote` = `1` (kein translateZ/backface auf Grid-Img)  
 * - `hufpflege_photo_object_fit_contain` = `1`  
 * - `hufpflege_photo_use_bg_image` = `1` (nur `background-image`, Gegenprobe)  
 * - `hufpflege_photo_remount_delay_ms` = z. B. `120` (Zahl 0…5000)
 *
 * **In-App-Panel („Mehr“)** setzt dieselben Keys über In-Memory + localStorage der PWA.
 */

import { getPhotoDebug } from '@/lib/mobile/photoGridDebugRuntime'

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      window.matchMedia?.('(display-mode: fullscreen)')?.matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

/** `hufpflege_photo_disable_stagger` === '1' → kein zeitversetztes Mount in Standalone */
export function readPhotoGridStaggerDisabled(): boolean {
  return getPhotoDebug('hufpflege_photo_disable_stagger') === '1'
}

/** `hufpflege_photo_disable_grid_remount` === '1' → kein Remount nach erstem Load */
export function readPhotoGridRemountDisabled(): boolean {
  return getPhotoDebug('hufpflege_photo_disable_grid_remount') === '1'
}

/** `hufpflege_photo_disable_intersection` === '1' → kein IO in Standalone (wie Browser-Tab) */
export function readPhotoGridIntersectionDisabled(): boolean {
  return getPhotoDebug('hufpflege_photo_disable_intersection') === '1'
}

/** `hufpflege_photo_decoding_sync` === '0' → in Standalone trotzdem decoding async */
export function readPhotoGridDecodingSyncPreferred(): boolean {
  if (!isStandaloneDisplayMode()) return false
  return getPhotoDebug('hufpflege_photo_decoding_sync') !== '0'
}

/** `hufpflege_photo_disable_layer_promote` === '1' → kein translateZ/backface auf Grid-Img */
export function readPhotoGridLayerPromoteDisabled(): boolean {
  return getPhotoDebug('hufpflege_photo_disable_layer_promote') === '1'
}

/** `hufpflege_photo_object_fit_contain` === '1' → object-fit: contain (Gegenprobe) */
export function readPhotoGridObjectFitContain(): boolean {
  return getPhotoDebug('hufpflege_photo_object_fit_contain') === '1'
}

/** `hufpflege_photo_use_bg_image` === '1' → Kachel nur als background-image (Gegenprobe) */
export function readPhotoGridUseBgImage(): boolean {
  return getPhotoDebug('hufpflege_photo_use_bg_image') === '1'
}

/** Verzögerung vor Remount (ms), z. B. `localStorage.setItem('hufpflege_photo_remount_delay_ms','120')` */
export function readPhotoGridRemountDelayMs(): number {
  const raw = getPhotoDebug('hufpflege_photo_remount_delay_ms')
  if (!raw) return 0
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 && n <= 5000 ? n : 0
}

/** Signed-URL-Logs + PWA-Kontext */
export function isPhotoDocumentationDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (getPhotoDebug('hufpflege_debug_photos') === '1') return true
    return new URLSearchParams(window.location.search).get('debugPhotos') === '1'
  } catch {
    return false
  }
}

/** Ausführliche Kachel-Timeline (Konsole): debug_photos ODER nur `hufpflege_photo_tile_log` === '1' */
export function isPhotoGridTileDiagEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      isPhotoDocumentationDebugEnabled() ||
      getPhotoDebug('hufpflege_photo_tile_log') === '1'
    )
  } catch {
    return false
  }
}

/** Sichtbares Diagnose-Overlay auf jeder Kachel */
export function isPhotoGridTileOverlayEnabled(): boolean {
  try {
    return (
      isPhotoDocumentationDebugEnabled() ||
      getPhotoDebug('hufpflege_photo_tile_overlay') === '1'
    )
  } catch {
    return false
  }
}

/** `hufpflege_photo_strip_warn` === '0' → kein automatisches console.warn bei Strip-Verdacht */
export function readPhotoGridStripWarnDisabled(): boolean {
  return getPhotoDebug('hufpflege_photo_strip_warn') === '0'
}

export function gridSectionLabelForIndex(gridDecodeIndex: number): string {
  if (gridDecodeIndex < 4) return `solar[${gridDecodeIndex}]`
  return `lateral[${gridDecodeIndex - 4}]`
}
