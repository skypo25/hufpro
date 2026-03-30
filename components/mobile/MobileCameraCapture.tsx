'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type MobileCameraSubject = 'hoof' | 'wholeBody'

type Props = {
  onCapture: (file: File) => void
  onClose: () => void
  onFallback?: () => void
  label?: string
  /**
   * Huf: 9:16-Rahmen + Fadenkreuz + abgedunkelter Rand (Huf im Sucher zentrieren).
   * Ganzkörper: voller Kamerablick ohne Overlay; Aufnahme wird auf 4:3 zugeschnitten.
   */
  subject?: MobileCameraSubject
}

/** width / height */
const ASPECT_HOOF = 9 / 16
const ASPECT_WHOLE_BODY = 4 / 3

export default function MobileCameraCapture({
  onCapture,
  onClose,
  onFallback,
  label,
  subject = 'hoof',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nativeInputRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nativeFallbackMode, setNativeFallbackMode] = useState(false)

  // Start camera
  useEffect(() => {
    let cancelled = false
    async function start() {
      // If getUserMedia is unavailable (HTTP / old browser), go straight to native
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setNativeFallbackMode(true)
          setReady(false)
          setError(null)
        }
        return
      }
      try {
        // iOS/iPadOS ist manchmal empfindlich bei Constraints (z. B. aspectRatio).
        // Wir versuchen mehrere Varianten, bevor wir den nativen Fallback öffnen.
        const tryGetStream = async (constraints: MediaStreamConstraints) => {
          return navigator.mediaDevices.getUserMedia(constraints)
        }

        // iOS ist oft empfindlich bei MediaStreamConstraints.
        // Daher: aspectRatio als "ideal" und mehrere Stufen ohne zu strikte Vorgaben.
        const constraintsList: MediaStreamConstraints[] =
          subject === 'wholeBody'
            ? [
                {
                  video: {
                    facingMode: { ideal: 'environment' },
                    aspectRatio: { ideal: ASPECT_WHOLE_BODY },
                    width: { ideal: 1280 },
                    height: { ideal: 960 },
                  },
                  audio: false,
                },
                {
                  video: {
                    facingMode: { ideal: 'environment' },
                    aspectRatio: { ideal: ASPECT_WHOLE_BODY },
                  },
                  audio: false,
                },
                { video: { facingMode: { ideal: 'environment' } }, audio: false },
                { video: { aspectRatio: { ideal: ASPECT_WHOLE_BODY } }, audio: false },
                { video: true, audio: false },
              ]
            : [
                {
                  video: {
                    facingMode: { ideal: 'environment' },
                    aspectRatio: { ideal: ASPECT_HOOF },
                    width: { ideal: 720 },
                    height: { ideal: 1280 },
                  },
                  audio: false,
                },
                {
                  video: {
                    facingMode: { ideal: 'environment' },
                    aspectRatio: { ideal: ASPECT_HOOF },
                  },
                  audio: false,
                },
                { video: { facingMode: { ideal: 'environment' } }, audio: false },
                { video: { aspectRatio: { ideal: ASPECT_HOOF } }, audio: false },
                { video: true, audio: false },
              ]

        let stream: MediaStream | null = null
        let lastErr: unknown = null
        for (const c of constraintsList) {
          try {
            stream = await tryGetStream(c)
            break
          } catch (err) {
            lastErr = err
          }
        }

        if (!stream) {
          throw lastErr ?? new Error('Kamera konnte nicht initialisiert werden')
        }
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          const vid = videoRef.current
          const onMeta = () => {
            // iOS kann `play()`-Promises schlucken; Metadata ist oft trotzdem da.
            if (!cancelled) setReady(true)
          }
          vid.addEventListener('loadedmetadata', onMeta)
          vid.addEventListener('canplay', onMeta)

          vid.srcObject = stream
          // play versuchen (kann rejecten) – ready wird über Events gesetzt
          vid.play().catch(() => {})

          // Cleanup Listener via cancelled-Flag im useEffect return.
          // (Event Listener werden beim unmount/close ohnehin mitgestoppt; das Flag sorgt nur für kein setState.)
        }
      } catch {
        if (cancelled) return
        // Video-Kamera geht hier oft nicht (iOS / unsichere Context). Wir bleiben im Overlay
        // und nutzen intern den nativen File-Input (capture="environment").
        setNativeFallbackMode(true)
        setReady(false)
        setError('Overlay-Kamera konnte nicht gestartet werden. Wir nutzen die native Kamera.')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [subject])

  const cropNativeFileToAspect = useCallback(async (file: File, targetRatio: number): Promise<File> => {
    const objectUrl = URL.createObjectURL(file)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
        img.src = objectUrl
      })

      const iw = img.naturalWidth
      const ih = img.naturalHeight

      // Center crop to targetRatio
      let sx = 0
      let sy = 0
      let sw = iw
      let sh = ih

      const cropH = Math.round(iw / targetRatio)
      if (cropH <= ih) {
        // crop by height
        sh = cropH
        sy = Math.round((ih - sh) / 2)
      } else {
        // crop by width
        const cropW = Math.round(ih * targetRatio)
        sw = cropW
        sx = Math.round((iw - sw) / 2)
      }

      const canvas = canvasRef.current ?? document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas nicht verfügbar')

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      })
      if (!blob) throw new Error('Bild konnte nicht verarbeitet werden')

      return new File([blob], `huf_${Date.now()}.jpg`, { type: 'image/jpeg' })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }, [])

  const handleNativePick = useCallback(
    async (file: File | null) => {
      if (!file) return
      try {
        const cropped = await cropNativeFileToAspect(file, subject === 'wholeBody' ? ASPECT_WHOLE_BODY : ASPECT_HOOF)
        streamRef.current?.getTracks().forEach((t) => t.stop())
        onCapture(cropped)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Capture fehlgeschlagen'
        setError(msg)
      } finally {
        if (nativeInputRef.current) nativeInputRef.current.value = ''
      }
    },
    [cropNativeFileToAspect, onCapture, subject]
  )

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) {
      setError('Kamera ist noch nicht bereit. Bitte kurz warten.')
      return
    }

    const targetRatio = subject === 'wholeBody' ? ASPECT_WHOLE_BODY : ASPECT_HOOF
    let cropW = vw
    let cropH = Math.round(vw / targetRatio)
    if (cropH > vh) {
      cropH = vh
      cropW = Math.round(vh * targetRatio)
    }
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
  }, [onCapture, subject])

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onClose()
  }, [onClose])

  return (
    <div className="mcc-overlay" onClick={handleClose}>
      <div className="mcc-container" onClick={e => e.stopPropagation()}>
        {nativeFallbackMode && (
          <input
            ref={nativeInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleNativePick(e.target.files?.[0] ?? null)}
          />
        )}

        {/* Live video feed */}
        {!nativeFallbackMode && (
          <video
            ref={videoRef}
            className="mcc-video"
            playsInline
            muted
            autoPlay
          />
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {subject === 'hoof' && (ready || nativeFallbackMode) && (
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
        {label && (ready || nativeFallbackMode) && (
          <div className="mcc-label">{label}</div>
        )}

        {/* Capture button */}
        {(ready || nativeFallbackMode) && (
          <button
            type="button"
            className="mcc-shutter"
            onClick={() => {
              if (ready) handleCapture()
              else nativeInputRef.current?.click()
            }}
            aria-label="Foto aufnehmen"
          >
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
