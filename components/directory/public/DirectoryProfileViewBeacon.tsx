'use client'

import { useEffect } from 'react'

/**
 * Zählt einen Profilaufruf (einmal pro Browser-Tab-Sitzung), wenn die öffentliche Profilseite geöffnet wird.
 */
export function DirectoryProfileViewBeacon({ profileId, slug }: { profileId: string; slug: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const k = `directory_pv_v1_${profileId}`
    try {
      if (sessionStorage.getItem(k)) return
      sessionStorage.setItem(k, '1')
    } catch {
      return
    }

    void fetch('/api/directory/profile-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      }),
      keepalive: true,
    }).catch(() => {})
  }, [profileId, slug])

  return null
}
