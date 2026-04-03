'use client'

import { useCallback, useState } from 'react'

type DataExportButtonProps = {
  className?: string
  children: React.ReactNode
  /** z. B. für Screenreader */
  'aria-label'?: string
}

/**
 * Startet den Hintergrund-Export. Fertigstellung per E-Mail; Download in den Einstellungen / Abrechnung.
 */
export default function DataExportButton({
  className,
  children,
  'aria-label': ariaLabel,
}: DataExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [headline, setHeadline] = useState('Datenexport')
  const [body, setBody] = useState('')

  const close = useCallback(() => {
    setOpen(false)
    setErr(null)
    setBusy(false)
    setBody('')
    setHeadline('Datenexport')
  }, [])

  const start = useCallback(async () => {
    setOpen(true)
    setBusy(true)
    setErr(null)
    try {
      const startRes = await fetch('/api/export/jobs', { method: 'POST', credentials: 'include' })
      const startJson = (await startRes.json().catch(() => null)) as
        | { jobId?: string; error?: string; resumed?: boolean; reuseComplete?: boolean }
        | null
      if (!startRes.ok || !startJson?.jobId) {
        throw new Error(startJson?.error ?? `Export konnte nicht gestartet werden (${startRes.status}).`)
      }

      if (startJson.reuseComplete) {
        setHeadline('Export bereit')
        setBody(
          'Ihr letzter Export ist noch verfügbar. Laden Sie die ZIP unten in den Einstellungen bzw. unter Abrechnung herunter — oder nutzen Sie „Herunterladen“ im Bereich „Ihre Exporte“ auf dieser Seite.'
        )
        setBusy(false)
        return
      }

      if (startJson.resumed) {
        setHeadline('Export läuft bereits')
        setBody(
          'Für Ihr Konto ist bereits ein Export aktiv. Sie können den Browser schließen — wenn die ZIP fertig ist, erhalten Sie eine E-Mail. Den Download finden Sie in den Einstellungen oder unter Abrechnung unter „Ihre Exporte“.'
        )
        setBusy(false)
        return
      }

      setHeadline('Export gestartet')
      setBody(
        'Die ZIP-Datei wird auf dem Server erstellt. Sie können dieses Fenster und den Browser schließen. Sobald der Export fertig ist, erhalten Sie eine E-Mail. Den Download starten Sie nach dem Anmelden unter Einstellungen oder Abrechnung im Bereich „Ihre Exporte“.'
      )
      setBusy(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export fehlgeschlagen.')
      setBusy(false)
    }
  }, [])

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={start}
        disabled={open}
        aria-label={ariaLabel}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
          aria-busy={busy}
        >
          <div className="huf-card w-full max-w-md border border-[#E5E2DC] bg-white p-6 shadow-lg">
            <h2 id="export-dialog-title" className="font-serif text-lg font-medium text-[#1B1F23]">
              {headline}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">{body}</p>

            {err && (
              <p className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">
                {err}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#52b788] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0f301b] disabled:opacity-60"
                onClick={close}
                disabled={busy}
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
