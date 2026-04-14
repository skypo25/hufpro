import { directoryAppBaseUrl, directoryPublicSiteOrigin } from '@/lib/directory/public/appBaseUrl'

export type ProfileViewSourceBucket = 'directory_search' | 'search_engine' | 'direct' | 'social' | 'other'

function normHost(h: string): string {
  return h.replace(/^www\./i, '').toLowerCase()
}

function appHostsForAnalytics(): Set<string> {
  const s = new Set<string>()
  for (const base of [directoryPublicSiteOrigin(), directoryAppBaseUrl()]) {
    try {
      s.add(normHost(new URL(base).hostname))
    } catch {
      /* ignore */
    }
  }
  return s
}

/**
 * Ordnet document.referrer / Referer einer groben Quelle zu (Profilaufruf-Statistik).
 */
export function classifyProfileViewReferrer(referrer: string | null | undefined): ProfileViewSourceBucket {
  const raw = (referrer ?? '').trim()
  if (!raw) return 'direct'

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'other'
  }

  const host = normHost(url.hostname)

  const searchEngines = [
    'google.',
    'bing.',
    'yahoo.',
    'duckduckgo.',
    'ecosia.',
    'startpage.',
    'brave.',
    'qwant.',
    'yandex.',
    'baidu.',
  ]
  if (searchEngines.some((p) => host.includes(p))) return 'search_engine'

  const social = [
    'facebook.',
    'fb.com',
    'instagram.',
    'twitter.',
    'x.com',
    'linkedin.',
    'pinterest.',
    'tiktok.',
    'threads.net',
  ]
  if (social.some((p) => host.includes(p))) return 'social'
  if (host === 't.co') return 'social'

  const ours = appHostsForAnalytics()
  const isOurs = [...ours].some((h) => host === h || host.endsWith(`.${h}`))
  if (isOurs) {
    const p = url.pathname || ''
    if (p === '/behandler' || p.startsWith('/behandler/')) return 'directory_search'
  }

  return 'other'
}
