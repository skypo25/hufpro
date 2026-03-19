'use client'

import { useCallback, useRef, useState } from 'react'

export type VoiceRecordingState = 'idle' | 'recording' | 'processing' | 'error'

type UseVoiceRecordingResult = {
  state: VoiceRecordingState
  errorMessage: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  reset: () => void
}

/**
 * Hook für Sprachaufnahme im Browser (MediaRecorder).
 * Liefert Audio als Blob (z. B. für speechToText / Whisper).
 */
export function useVoiceRecording(): UseVoiceRecordingResult {
  const [state, setState] = useState<VoiceRecordingState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    setErrorMessage(null)
    // Short start-beep via Web Audio API
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.18)
      osc.onended = () => ctx.close()
    } catch { /* ignore if AudioContext not available */ }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Mikrofon wird auf diesem Gerät oder Browser nicht unterstützt')
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Audioaufnahme wird auf diesem Browser nicht unterstützt')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start(200)
      mediaRecorderRef.current = recorder
      setState('recording')
    } catch (e) {
      setState('error')
      setErrorMessage(
        e instanceof Error ? e.message : 'Mikrofon nicht verfügbar'
      )
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || state !== 'recording') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const recorderType = recorder.mimeType || 'audio/webm'
        mediaRecorderRef.current = null
        setState('idle')
        if (chunksRef.current.length === 0) {
          resolve(null)
          return
        }
        const blob = new Blob(chunksRef.current, { type: recorderType })
        chunksRef.current = []
        resolve(blob)
      }
      recorder.stop()
    })
  }, [state])

  const reset = useCallback(() => {
    setState('idle')
    setErrorMessage(null)
  }, [])

  return {
    state,
    errorMessage,
    startRecording,
    stopRecording,
    reset,
  }
}
