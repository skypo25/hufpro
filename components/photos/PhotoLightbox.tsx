'use client'

import { useState, useEffect, useCallback } from 'react'

type AnnotationItem = {
  type: 'line' | 'axis' | 'stroke' | 'angle' | 'point'
  points?: { x: number; y: number }[]
  point?: { x: number; y: number }
  color?: string
}

type PhotoLightboxProps = {
  label: string
  signedUrl: string
  annotations?: AnnotationItem[]
  width?: number
  height?: number
}

export default function PhotoLightbox({ label, signedUrl, annotations = [], width = 400, height = 711 }: PhotoLightboxProps) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const W = width
  const H = height

  const renderAnnotations = (scale = 1) => (
    annotations.length > 0 && (
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {annotations.map((item, idx) => {
          if ((item.type === 'line' || item.type === 'axis') && item.points && item.points.length >= 2) {
            const [a, b] = item.points
            return <line key={idx} x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H} stroke="#ffffff" strokeWidth={3 * scale} />
          }
          if (item.type === 'stroke' && item.points && item.points.length >= 2) {
            const d = item.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * W} ${p.y * H}`).join(' ')
            return <path key={idx} d={d} fill="none" stroke={item.color ?? '#ffffff'} strokeWidth={3 * scale} strokeLinecap="round" />
          }
          if (item.type === 'angle' && item.points && item.points.length >= 3) {
            const [a, b, c] = item.points
            return (
              <g key={idx}>
                <line x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H} stroke={item.color ?? '#ffffff'} strokeWidth={3 * scale} />
                <line x1={a.x * W} y1={a.y * H} x2={c.x * W} y2={c.y * H} stroke={item.color ?? '#ffffff'} strokeWidth={3 * scale} />
              </g>
            )
          }
          if (item.type === 'point' && item.point) {
            return <circle key={idx} cx={item.point.x * W} cy={item.point.y * H} r={4 * scale} fill={item.color ?? '#ffffff'} stroke="#ffffff" strokeWidth={3 * scale} />
          }
          return null
        })}
      </svg>
    )
  )

  return (
    <>
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block h-full w-full cursor-zoom-in overflow-hidden rounded-xl"
        title="Vergrößern"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signedUrl} alt={label} className="h-full w-full object-cover" />
        {renderAnnotations()}
        <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1.5 text-[11px] font-medium text-white">
          {label}
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={close}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition"
            title="Schließen"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Label */}
          <p className="absolute left-4 top-4 rounded-xl bg-white/20 px-3 py-1.5 text-[13px] font-medium text-white">
            {label}
          </p>

          {/* Image */}
          <div
            className="relative max-h-[calc(100dvh-5rem)] w-auto"
            style={{ aspectRatio: `${W}/${H}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt={label}
              className="h-full w-full rounded-xl object-contain"
            />
            {renderAnnotations()}
          </div>
        </div>
      )}
    </>
  )
}
