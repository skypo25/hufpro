'use client'

import { useCallback, useEffect, useState } from 'react'

type ExportJobRow = {
  id: string
  status: string
  progress_percent: number
  progress_label: string
  error_message: string | null
  completed_at: string | null
  created_at: string
  email_notified_at: string | null
}

function formatDeDate(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

type DataExportDownloadsPanelProps = {
  /** Zusätzliche Klassen am äußeren Listen-Container */
  className?: string
}

/**
 * Liste der Export-Jobs mit direktem Download für fertige ZIPs.
 */
export default function DataExportDownloadsPanel({ className }: DataExportDownloadsPanelProps) {
  const [jobs, setJobs] = useState<ExportJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadErr, setDownloadErr] = useState<string | null>(null)
  const [retentionDays, setRetentionDays] = useState(14)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/export/jobs', { credentials: 'include' })
      const j = (await res.json().catch(() => null)) as {
        jobs?: ExportJobRow[]
        error?: string
        retentionDays?: number
      } | null
      if (!res.ok) {
        setLoadErr(j?.error ?? `Laden fehlgeschlagen (${res.status})`)
        return
      }
      setLoadErr(null)
      setJobs(j?.jobs ?? [])
      if (typeof j?.retentionDays === 'number' && j.retentionDays >= 1) {
        setRetentionDays(j.retentionDays)
      }
    } catch {
      setLoadErr('Liste konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const hasActive = jobs.some((x) => x.status === 'pending' || x.status === 'processing')
    if (!hasActive) return
    const t = setInterval(() => void load(), 6000)
    return () => clearInterval(t)
  }, [jobs, load])

  const downloadJob = async (id: string) => {
    setDownloadingId(id)
    setDownloadErr(null)
    try {
      const res = await fetch(`/api/export/jobs/${id}`, { credentials: 'include' })
      const data = (await res.json().catch(() => null)) as {
        downloadUrl?: string | null
        filename?: string | null
        error?: string
        error_message?: string | null
      } | null
      if (!res.ok || !data?.downloadUrl || !data.filename) {
        throw new Error(data?.error_message || data?.error || 'Download nicht verfügbar.')
      }
      const fileRes = await fetch(data.downloadUrl)
      if (!fileRes.ok) throw new Error('Download fehlgeschlagen.')
      const blob = await fileRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setDownloadErr(e instanceof Error ? e.message : 'Download fehlgeschlagen.')
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) {
    return <p className="text-[12px] text-[#6B7280]">Export-Liste wird geladen …</p>
  }

  if (loadErr) {
    return <p className="text-[12px] text-[#B91C1C]">{loadErr}</p>
  }

  if (jobs.length === 0) {
    return (
      <div>
        <p className="text-[12px] text-[#6B7280]">
          Noch keine Exporte. Starten Sie einen Export mit dem Button oben — Sie erhalten eine E-Mail, sobald die ZIP
          bereitsteht.
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
          Fertige ZIP-Dateien werden nach {retentionDays} Tagen automatisch vom Server gelöscht (Speicherplatz).
        </p>
      </div>
    )
  }

  return (
    <>
      {downloadErr && (
        <p className="mb-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">
          {downloadErr}
        </p>
      )}
      <ul className={['space-y-3', className].filter(Boolean).join(' ')}>
      {jobs.map((job) => (
        <li
          key={job.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[#E5E2DC] bg-[#FAFAF9] px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#1B1F23]">
              {job.status === 'complete' && 'ZIP bereit'}
              {job.status === 'failed' && 'Export fehlgeschlagen'}
              {(job.status === 'pending' || job.status === 'processing') && 'Export läuft …'}
              {!['complete', 'failed', 'pending', 'processing'].includes(job.status) && job.status}
            </div>
            <div className="mt-0.5 text-[11px] text-[#6B7280]">
              {job.status === 'complete' || job.status === 'failed' ? (
                <>Fertig: {formatDeDate(job.completed_at)}</>
              ) : (
                <>
                  Gestartet: {formatDeDate(job.created_at)} · {job.progress_percent}% — {job.progress_label}
                </>
              )}
            </div>
            {job.status === 'failed' && job.error_message && (
              <p className="mt-1 text-[11px] text-[#B91C1C]">{job.error_message}</p>
            )}
            {job.status === 'complete' && job.email_notified_at && (
              <p className="mt-1 text-[10px] text-[#9CA3AF]">Benachrichtigung per E-Mail gesendet</p>
            )}
          </div>
          {job.status === 'complete' && (
            <button
              type="button"
              onClick={() => void downloadJob(job.id)}
              disabled={downloadingId === job.id}
              className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--accent-dark)] disabled:opacity-60"
            >
              {downloadingId === job.id ? 'Lädt …' : 'Herunterladen'}
            </button>
          )}
        </li>
      ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
        Fertige ZIP-Dateien werden nach {retentionDays} Tagen automatisch vom Server gelöscht (Speicherplatz).
      </p>
    </>
  )
}
