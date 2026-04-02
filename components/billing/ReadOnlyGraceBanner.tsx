'use client'

import DataExportButton from '@/components/export/DataExportButton'

function formatDateTimeDe(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return iso
  }
}

/**
 * Hinweis nach Abo-Kündigung: nur Lesen + Export bis zum angegebenen Zeitpunkt.
 */
export default function ReadOnlyGraceBanner({ graceEndsAtIso }: { graceEndsAtIso: string }) {
  return (
    <div
      className="huf-card flex flex-col gap-2 border border-[#BFDBFE] bg-[#EFF6FF] px-[18px] py-3 text-[13px] text-[#1E3A5F] sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex items-start gap-2">
        <i className="bi bi-lock mt-0.5 shrink-0 text-[16px]" aria-hidden />
        <div>
          <span className="font-semibold">Nur Lesen</span>
          <span className="text-[#334155]">
            {' '}
            — Ihr Abo ist gekündigt. Änderungen sind nicht mehr möglich. Datenexport bis{' '}
            <time dateTime={graceEndsAtIso}>{formatDateTimeDe(graceEndsAtIso)}</time>.
          </span>
        </div>
      </div>
      <DataExportButton className="shrink-0 rounded-lg border border-[#93C5FD] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1D4ED8] hover:bg-[#F8FAFC] disabled:opacity-60">
        ZIP exportieren
      </DataExportButton>
    </div>
  )
}
