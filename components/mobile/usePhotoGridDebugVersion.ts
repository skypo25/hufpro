'use client'

import { useSyncExternalStore } from 'react'
import { getPhotoDebugVersion, subscribePhotoDebug } from '@/lib/mobile/photoGridDebugRuntime'

/** Abonniert Änderungen an Foto-Grid-Debug-Flags (In-App-Panel / Runtime). */
export function usePhotoGridDebugVersion(): number {
  return useSyncExternalStore(subscribePhotoDebug, getPhotoDebugVersion, getPhotoDebugVersion)
}
