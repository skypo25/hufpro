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
      <div className="mt-8 rounded-xl border border-primary/30 bg-primary-light p-5">
        <p className="font-medium text-primary">
          Ihr Termin ist bestätigt.
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
        className="primary-button primary-button--full primary-button--lg font-semibold disabled:opacity-60"
      >
        {loading ? 'Wird bestätigt…' : 'Termin bestätigen'}
      </button>
      {error && (
        <p className="mt-3 text-[14px] text-[#DC2626]">{error}</p>
      )}
    </form>
  )
}
