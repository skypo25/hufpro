'use client'

import { useState } from 'react'
import { downloadRecordPdf } from '@/lib/pdf/downloadRecordPdf'

type Props = {
  horseId: string
  recordId: string
  className?: string
}

export default function RecordPdfDownloadButton({
  horseId,
  recordId,
  className,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await downloadRecordPdf(horseId, recordId)
    } catch {
      setError('PDF konnte nicht erstellt werden. Bitte erneut versuchen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className={className}
        aria-busy={loading}
      >
        <i className="bi bi-file-earmark-pdf text-[15px]" aria-hidden />
        {loading ? 'PDF wird erstellt…' : 'PDF herunterladen'}
      </button>
      {error ? (
        <p className="px-1 text-[12px] text-[#B42318]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
