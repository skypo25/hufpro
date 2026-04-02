'use client'

import { useCallback, useState } from 'react'

type SsePayload =
  | { type: 'progress'; percent: number; label: string }
  | { type: 'complete'; downloadUrl: string; filename: string }
  | { type: 'error'; message: string }

async function consumeExportStream(
  onProgress: (percent: number, label: string) => void
): Promise<{ downloadUrl: string; filename: string }> {
  const res = await fetch('/api/export/stream', {
    credentials: 'include',
    headers: { Accept: 'text/event-stream' },
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(j?.error ?? `Export konnte nicht gestartet werden (${res.status}).`)
  }
  if (!res.body) throw new Error('Keine Antwort vom Server.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: { downloadUrl: string; filename: string } | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const block of parts) {
      const line = block.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      let json: SsePayload
      try {
        json = JSON.parse(line.slice(6)) as SsePayload
      } catch {
        continue
      }
      if (json.type === 'progress') {
        onProgress(json.percent, json.label)
      } else if (json.type === 'complete') {
        result = { downloadUrl: json.downloadUrl, filename: json.filename }
      } else if (json.type === 'error') {
        throw new Error(json.message)
      }
    }
  }

  if (!result) throw new Error('Export endete ohne Download-Link.')
  return result
}

type DataExportButtonProps = {
  className?: string
  children: React.ReactNode
  /** z. B. für Screenreader */
  'aria-label'?: string
}

/**
 * Startet den Datenexport mit Fortschrittsdialog; wenn die ZIP bereitsteht, startet der Download erst auf Knopfdruck.
 */
export default function DataExportButton({
  className,
  children,
  'aria-label': ariaLabel,
}: DataExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [percent, setPercent] = useState(0)
  const [label, setLabel] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [readyDownload, setReadyDownload] = useState<{ downloadUrl: string; filename: string } | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)

  const close = useCallback(() => {
    setOpen(false)
    setRunning(false)
    setReadyDownload(null)
    setErr(null)
    setPercent(0)
    setLabel('')
    setDownloadBusy(false)
  }, [])

  const start = useCallback(async () => {
    setOpen(true)
    setRunning(true)
    setErr(null)
    setReadyDownload(null)
    setPercent(0)
    setLabel('Wird gestartet …')
    try {
      const { downloadUrl, filename } = await consumeExportStream((p, l) => {
        setPercent(Math.min(100, Math.max(0, p)))
        setLabel(l)
      })
      setPercent(100)
      setLabel('Export ist bereit.')
      setReadyDownload({ downloadUrl, filename })
      setRunning(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export fehlgeschlagen.')
      setRunning(false)
    }
  }, [])

  const handleDownloadClick = useCallback(async () => {
    if (!readyDownload) return
    setDownloadBusy(true)
    try {
      try {
        const fileRes = await fetch(readyDownload.downloadUrl)
        if (!fileRes.ok) throw new Error('Download fehlgeschlagen')
        const blob = await fileRes.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = readyDownload.filename
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch {
        window.open(readyDownload.downloadUrl, '_blank', 'noopener,noreferrer')
      }
      close()
    } finally {
      setDownloadBusy(false)
    }
  }, [readyDownload, close])

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
          aria-busy={running}
        >
          <div className="huf-card w-full max-w-md border border-[#E5E2DC] bg-white p-6 shadow-lg">
            <h2 id="export-dialog-title" className="font-serif text-lg font-medium text-[#1B1F23]">
              Datenexport
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
              Ihre Daten werden auf dem Server zusammengestellt. Wenn der Balken bei 100&nbsp;% ist, können Sie den Download
              starten — ideal bei großen Datenmengen, damit der eigentliche Dateitransfer erst beginnt, wenn Sie bereit sind.
            </p>

            <div className="mt-5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F0EEEA]">
                <div
                  className="h-full rounded-full bg-[#52b788] transition-[width] duration-200 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-[#6B7280]">
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="tabular-nums text-[#1B1F23]">{percent}%</span>
              </div>
            </div>

            {err && (
              <p className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">
                {err}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {readyDownload && !err && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0f301b] disabled:opacity-60"
                  onClick={handleDownloadClick}
                  disabled={downloadBusy}
                >
                  {downloadBusy ? (
                    'Wird geladen…'
                  ) : (
                    <>
                      <i className="bi bi-download" aria-hidden />
                      ZIP jetzt herunterladen
                    </>
                  )}
                </button>
              )}
              {!running && (
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#6B7280] hover:bg-[#F9FAFB]"
                  onClick={close}
                >
                  {err ? 'Schließen' : readyDownload ? 'Abbrechen' : 'Schließen'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
