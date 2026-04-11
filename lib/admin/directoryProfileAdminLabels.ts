import 'server-only'

export function deListingStatus(raw: string): string {
  switch (raw) {
    case 'draft':
      return 'Entwurf'
    case 'published':
      return 'Veröffentlicht'
    case 'hidden':
      return 'Versteckt'
    case 'blocked':
      return 'Gesperrt'
    default:
      return raw
  }
}

export function deClaimState(raw: string): string {
  switch (raw) {
    case 'unclaimed':
      return 'Nicht beansprucht'
    case 'claim_pending':
      return 'Beantragung offen'
    case 'claimed':
      return 'Beansprucht'
    default:
      return raw
  }
}

/** Admin-Liste: Import-Stammdaten bleiben absichtlich ohne Owner bis zur Beanspruchung. */
export function deClaimStateWithOrigin(claimState: string, dataOrigin: string): string {
  if (claimState === 'unclaimed' && dataOrigin === 'import') {
    return 'Import · zur Beanspruchung offen'
  }
  return deClaimState(claimState)
}

export function deDataOrigin(raw: string): string {
  switch (raw) {
    case 'import':
      return 'Import (Stammdaten)'
    case 'manual':
      return 'Manuell / Selbstregistrierung'
    case 'merged':
      return 'Zusammengeführt'
    default:
      return raw || '—'
  }
}

export function deVerificationState(raw: string): string {
  switch (raw) {
    case 'none':
      return 'Keine'
    case 'pending':
      return 'Ausstehend'
    case 'verified':
      return 'Verifiziert'
    case 'rejected':
      return 'Abgelehnt'
    default:
      return raw
  }
}

export function deTopSource(source: string): string {
  switch (source) {
    case 'app_subscription':
      return 'App-Abo'
    case 'directory_subscription':
      return 'Verzeichnis-Kauf'
    case 'manual':
      return 'Manuell (Admin)'
    default:
      return source
  }
}

export function labelOwnerAccessScope(args: {
  scope: 'app' | 'directory_only' | 'implicit_app'
}): string {
  if (args.scope === 'directory_only') return 'Verzeichnis-only'
  if (args.scope === 'implicit_app') return 'App (Standard, nicht erfasst)'
  return 'App'
}
