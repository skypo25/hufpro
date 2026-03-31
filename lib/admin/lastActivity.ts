/** Letzte Aktivität für Admin-Liste (kein Echtzeit-„Online“, nur Login-Zeit). */
export type ActivityDot = 'online' | 'recent' | 'inactive'

export function formatAdminLastActivity(
  lastSignInIso: string | null,
  now: Date = new Date()
): { dot: ActivityDot; text: string } {
  if (!lastSignInIso) return { dot: 'inactive', text: '—' }
  const t = new Date(lastSignInIso).getTime()
  if (Number.isNaN(t)) return { dot: 'inactive', text: '—' }

  const diffMs = now.getTime() - t
  const diffMin = diffMs / 60_000
  if (diffMin < 20) return { dot: 'online', text: 'Jetzt online' }

  const last = new Date(lastSignInIso)
  const sameDay =
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate()
  if (sameDay) {
    const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(last)
    return { dot: 'recent', text: `heute, ${time}` }
  }

  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  const yest =
    last.getFullYear() === y.getFullYear() &&
    last.getMonth() === y.getMonth() &&
    last.getDate() === y.getDate()
  if (yest) return { dot: 'recent', text: 'gestern' }

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days < 7) return { dot: 'inactive', text: `vor ${days} Tagen` }
  if (days < 30) return { dot: 'inactive', text: `vor ${Math.floor(days / 7)} Wochen` }
  return { dot: 'inactive', text: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(last) }
}
