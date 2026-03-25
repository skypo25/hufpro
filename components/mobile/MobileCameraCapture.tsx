'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type Props = {
  onCapture: (file: File) => void
  onClose: () => void
  onFallback?: () => void
  label?: string
}

export default function MobileCameraCapture({ onCapture, onClose, onFallback, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Start camera
  useEffect(() => {
    let cancelled = false
    async function start() {
      // If getUserMedia is unavailable (HTTP / old browser), go straight to native
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled && onFallback) { onFallback(); return }
        if (!cancelled) setError('Kamera nicht verfügbar')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', aspectRatio: 9 / 16 },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().then(() => { if (!cancelled) setReady(true) }).catch(() => {})
        }
      } catch {
        if (cancelled) return
        // Permission denied or not available → fall back to native
        if (onFallback) { onFallback() } else { setError('Kamera-Zugriff verweigert') }
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const vw = video.videoWidth
    const vh = video.videoHeight

    // Crop to 9:16 from center
    const targetRatio = 9 / 16
    let cropW = vw
    let cropH = Math.round(vw / targetRatio)
    if (cropH > vh) { cropH = vh; cropW = Math.round(vh * targetRatio) }
    const offsetX = Math.round((vw - cropW) / 2)
    const offsetY = Math.round((vh - cropH) / 2)

    canvas.width = cropW
    canvas.height = cropH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `huf_${Date.now()}.jpg`, { type: 'image/jpeg' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(file)
    }, 'image/jpeg', 0.92)
  }, [onCapture])

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onClose()
  }, [onClose])

  return (
    <div className="mcc-overlay" onClick={handleClose}>
      <div className="mcc-container" onClick={e => e.stopPropagation()}>

        {/* Live video feed */}
        <video
          ref={videoRef}
          className="mcc-video"
          playsInline
          muted
          autoPlay
        />

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* 9/16 crop frame + crosshair overlay */}
        {ready && (
          <div className="mcc-frame-overlay">
            {/* dimmed letterbox: Seiten + oben/unten außerhalb des 9:16-Rahmens */}
            <div className="mcc-dim mcc-dim-left" />
            <div className="mcc-dim mcc-dim-right" />
            <div className="mcc-dim mcc-dim-top" />
            <div className="mcc-dim mcc-dim-bottom" />

            {/* 9/16 window */}
            <div className="mcc-frame">
              {/* Corner marks */}
              <div className="mcc-corner tl" />
              <div className="mcc-corner tr" />
              <div className="mcc-corner bl" />
              <div className="mcc-corner br" />

              {/* Glowing crosshair */}
              <svg className="mcc-crosshair" viewBox="0 0 60 60" fill="none">
                <line x1="30" y1="8" x2="30" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="30" y1="38" x2="30" y2="52" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="8" y1="30" x2="22" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="38" y1="30" x2="52" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="30" cy="30" r="4" stroke="white" strokeWidth="2" />
              </svg>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mcc-error">
            <p>{error}</p>
            <button type="button" onClick={handleClose}>Schließen</button>
          </div>
        )}

        {/* Label */}
        {label && ready && (
          <div className="mcc-label">{label}</div>
        )}

        {/* Capture button */}
        {ready && (
          <button type="button" className="mcc-shutter" onClick={handleCapture} aria-label="Foto aufnehmen">
            <span className="mcc-shutter-inner" />
          </button>
        )}

        {/* Close button */}
        <button type="button" className="mcc-close" onClick={handleClose} aria-label="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={20} height={20}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
