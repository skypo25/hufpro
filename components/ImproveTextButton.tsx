'use client'

import { useState, useCallback } from 'react'
import { improveText } from '@/lib/aiImproveText'

export type ImproveTextButtonProps = {
  /** Aktueller Text aus dem Feld */
  value: string
  /** Wird mit dem verbesserten Text aufgerufen; ersetzt den Feldinhalt */
  onImproved: (text: string) => void
  /** Optional: Tiername (z. B. Pferd) als Kontext */
  animalName?: string
  /** Optional: Button deaktivieren */
  disabled?: boolean
  /** Optional: zusätzliche CSS-Klassen für den Container */
  className?: string
  /** Optional: CSS-Klassen für den Button (ersetzt Standard-Styles) */
  buttonClassName?: string
}

export default function ImproveTextButton({
  value,
  onImproved,
  animalName,
  disabled = false,
  className = '',
  buttonClassName,
}: ImproveTextButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = useCallback(async () => {
    const text = value.trim()
    if (!text || loading || disabled) return
    setError(null)
    setLoading(true)
    try {
      const result = await improveText(text, animalName)
      onImproved(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Textverbesserung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [value, onImproved, animalName, loading, disabled])

  const isDisabled = disabled || loading || !value.trim()

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={
          buttonClassName ??
          'inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-[#F7F6F3] px-4 py-2.5 text-[13px] font-semibold text-[#1B1F23] shadow-sm transition active:scale-[0.98] disabled:opacity-50'
        }
        aria-busy={loading}
      >
        <i className="bi bi-stars text-[18px] text-[#EAB308]" aria-hidden />
        <span>{loading ? 'Wird verbessert…' : 'Text verbessern'}</span>
      </button>
      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
