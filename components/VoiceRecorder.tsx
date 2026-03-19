'use client'

import { useState, useCallback } from 'react'
import { useVoiceRecording } from '@/hooks/useVoiceRecording'
import { speechToText } from '@/lib/speechToText'
import { formatTherapyDocumentation, type TherapyType } from '@/lib/aiFormatter'

export type VoiceRecorderProps = {
  /** Behandlungsart für KI-Formatierung */
  therapyType: TherapyType
  /** Aufruf mit fertig formatiertem Text; wird ins Dokumentationsfeld eingefügt */
  onResult: (text: string) => void
  /** Name des Tieres (z. B. Pferd), damit die KI „der Huf von Maja“ statt „der Huf des Tieres“ schreibt */
  animalName?: string
  /** Optional: deaktiviert den Button */
  disabled?: boolean
  /** Optional: zusätzliche CSS-Klassen für den äußeren Container */
  className?: string
  /** Optional: Button-Beschriftung (Standard: „Befund einsprechen“) */
  buttonLabel?: string
  /** Optional: zusätzliche CSS-Klassen für den Button (überschreibt Standard-Styles) */
  buttonClassName?: string
}

export default function VoiceRecorder({
  therapyType,
  onResult,
  animalName,
  disabled = false,
  className = '',
  buttonLabel = 'Befund einsprechen',
  buttonClassName,
}: VoiceRecorderProps) {
  const { state, errorMessage, startRecording, stopRecording, reset } =
    useVoiceRecording()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)

  const isRecording = state === 'recording'
  const showLoader = isProcessing
  const error = errorMessage ?? processError

  const handleToggle = useCallback(async () => {
    if (showLoader || disabled) return
    setProcessError(null)

    if (isRecording) {
      setIsProcessing(true)
      const blob = await stopRecording()
      if (!blob) {
        setIsProcessing(false)
        return
      }
      try {
        const rawText = await speechToText(blob)
        if (!rawText.trim()) {
          setProcessError('Spracherkennung fehlgeschlagen')
          return
        }
        const formatted = await formatTherapyDocumentation(rawText, therapyType, animalName)
        onResult(formatted)
      } catch (e) {
        setProcessError(
          e instanceof Error ? e.message : 'Spracherkennung fehlgeschlagen'
        )
      } finally {
        setIsProcessing(false)
      }
      return
    }

    await startRecording()
  }, [
    isRecording,
    showLoader,
    disabled,
    therapyType,
    onResult,
    animalName,
    startRecording,
    stopRecording,
  ])

  return (
    <div className={`voice-recorder flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || showLoader}
        className={
          buttonClassName ??
          'voice-recorder-btn inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-[#F7F6F3] px-4 py-3 text-[14px] font-semibold text-[#1B1F23] shadow-sm transition active:scale-[0.98] disabled:opacity-60 md:max-w-[280px]'
        }
        aria-label={isRecording ? 'Aufnahme stoppen' : buttonLabel}
        aria-busy={showLoader}
      >
        <i className="bi bi-mic text-[18px]" aria-hidden />
        <span className="voice-recorder-label">
          {isRecording
            ? 'Aufnahme stoppen'
            : showLoader
              ? 'Wird verarbeitet…'
              : buttonLabel}
        </span>
      </button>
      {error && (
        <p className="voice-recorder-error text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}
      {error && (
        <button
          type="button"
          onClick={() => {
            setProcessError(null)
            reset()
          }}
          className="voice-recorder-reset text-[13px] font-medium text-[#52b788] underline"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  )
}
