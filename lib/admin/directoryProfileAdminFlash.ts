import 'server-only'

/** Deutsche Standardtexte für Admin-Profilaktionen (?ok= / ?err=). */
const OK_LABELS: Record<string, string> = {
  listing: 'Listing-Status wurde gespeichert.',
  verify: 'Verifizierung wurde gespeichert.',
  top_activate: 'Manuelles Top-Profil wurde aktiviert.',
  top_extend: 'Manuelles Top-Profil wurde verlängert.',
  top_end_manual: 'Manuelles Top-Profil wurde beendet.',
  top_purge: 'Alle Top-Berechtigungen wurden entfernt.',
  owner_release: 'Owner wurde gelöst; offene Claims wurden abgeschlossen.',
  owner_assign: 'Owner wurde zugewiesen.',
  scope: 'Zugriffstyp wurde gespeichert.',
  claim_approved: 'Claim wurde bestätigt.',
}

/** Wenn ?err= gesetzt ist, aber keine ?msg=: */
const ERR_FALLBACK: Record<string, string> = {
  listing: 'Listing-Status konnte nicht gespeichert werden.',
  verify: 'Verifizierung konnte nicht gespeichert werden.',
  top: 'Top-Profil-Aktion ist fehlgeschlagen.',
  owner: 'Owner-Aktion ist fehlgeschlagen.',
  scope: 'Zugriffstyp konnte nicht gespeichert werden.',
  claim: 'Claim konnte nicht bestätigt werden.',
}

export type AdminProfileFlash = { kind: 'ok' | 'err'; msg: string }

function sanitizeMsg(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const t = raw.trim()
  if (t.length === 0) return undefined
  return t.slice(0, 500)
}

export function parseAdminDirectoryProfileFlash(sp: Record<string, string | string[] | undefined>): AdminProfileFlash | null {
  const err = typeof sp.err === 'string' ? sp.err : undefined
  const ok = typeof sp.ok === 'string' ? sp.ok : undefined
  const msgRaw = typeof sp.msg === 'string' ? sp.msg : undefined
  const msg = sanitizeMsg(msgRaw)

  if (err) {
    const fallback = ERR_FALLBACK[err] ?? 'Die Aktion ist fehlgeschlagen.'
    return { kind: 'err', msg: msg ?? fallback }
  }
  if (ok) {
    return { kind: 'ok', msg: msg ?? OK_LABELS[ok] ?? 'Gespeichert.' }
  }
  return null
}
