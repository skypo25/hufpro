'use client'

type Props = {
  isOnline: boolean
  hasLocalDraft: boolean
  isSyncing?: boolean
  syncError?: string | null
  onRetrySync?: () => void
  compact?: boolean
}

export default function OfflineStatusBanner({
  isOnline,
  hasLocalDraft,
  isSyncing = false,
  syncError = null,
  onRetrySync,
  compact = false,
}: Props) {
  if (isOnline && !hasLocalDraft && !syncError) return null

  const baseClass = compact
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]'
    : 'flex items-center gap-3 rounded-xl px-4 py-3 text-[13px]'

  if (syncError) {
    return (
      <div className={`${baseClass} app-info-callout`}>
        <span className="shrink-0 text-base">⚠️</span>
        <span className="flex-1">{syncError}</span>
        {onRetrySync && (
          <button
            type="button"
            onClick={onRetrySync}
            className="shrink-0 font-semibold text-[#7b3306] underline hover:no-underline"
          >
            Erneut versuchen
          </button>
        )}
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className={`${baseClass} border border-[#52b788]/40 bg-[#edf7f2] text-[#166534]`}>
        <span className="shrink-0 animate-pulse">📤</span>
        <span>Entwurf wird synchronisiert…</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className={`${baseClass} app-info-callout`}>
        <span className="shrink-0 text-base">📡</span>
        <span>
          {hasLocalDraft
            ? 'Offline – Entwurf wird lokal gespeichert und beim nächsten Sync hochgeladen.'
            : 'Offline – Änderungen werden lokal gespeichert.'}
        </span>
      </div>
    )
  }

  if (hasLocalDraft) {
    return (
      <div className={`${baseClass} border border-[#52b788]/40 bg-[#edf7f2] text-[#166534]`}>
        <span className="shrink-0 text-base">✓</span>
        <span>Lokaler Entwurf vorhanden – Änderungen werden synchronisiert.</span>
      </div>
    )
  }

  return null
}
