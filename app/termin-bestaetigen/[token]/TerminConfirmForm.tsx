'use client'

import { useState } from 'react'

export default function TerminConfirmForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/appointments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Bestätigung fehlgeschlagen.')
        setLoading(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Bestätigung fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="mt-8 rounded-xl border border-[#154226]/30 bg-[#edf3ef] p-5">
        <p className="font-medium text-[#154226]">
          Sie haben den Termin bestätigt. Vielen Dank.
        </p>
        <p className="mt-2 text-[14px] text-[#0f301b]">
          Sie erhalten in Kürze eine Bestätigungs-E-Mail.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8">
      <button
        type="submit"
        disabled={loading}
        className="huf-btn-dark w-full rounded-lg bg-[#154226] px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0f301b] disabled:opacity-60"
      >
        {loading ? 'Wird bestätigt…' : 'Termin bestätigen'}
      </button>
      {error && (
        <p className="mt-3 text-[14px] text-[#DC2626]">{error}</p>
      )}
    </form>
  )
}
