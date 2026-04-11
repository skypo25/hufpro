/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'

/** OSM-Rasterkacheln nicht über die globale *.png-Regel cachen (StaleWhileRevalidate). */
function isOpenstreetmapRasterTile(o: { url: URL; request: Request }): boolean {
  if (o.request.method !== 'GET') return false
  const host = o.url.hostname.toLowerCase()
  if (host === 'tile.openstreetmap.org') return true
  return /^[abc]\.tile\.openstreetmap\.fr$/i.test(host) && o.url.pathname.includes('/hot/')
}

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [{ matcher: isOpenstreetmapRasterTile, handler: new NetworkOnly() }, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()
