'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { AnnotationsData, Point, Annotation } from '@/lib/photos/annotations'

type PhotoAnnotatorProps = {
  imageUrl: string
  width: number
  height: number
  annotations: AnnotationsData
  onChange: (annotations: AnnotationsData) => void
  readOnly?: boolean
  /** Wenn false: nur Bild + Anzeige der Annotationen, keine Toolbar, kein Zeichen-Layer */
  showToolbar?: boolean
  className?: string
}

const STROKE_WIDTH = 3
type DrawMode = 'line' | 'stroke' | null

function relativePoint(
  e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  rect: DOMRect
): Point {
  const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX
  const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
  }
}

export default function PhotoAnnotator({
  imageUrl,
  width,
  height,
  annotations,
  onChange,
  readOnly = false,
  showToolbar = true,
  className = '',
}: PhotoAnnotatorProps) {
  const canInteract = !readOnly && showToolbar
  const containerRef = useRef<HTMLDivElement>(null)
  const currentPointsRef = useRef<Point[]>([])
  const lineAxisStartRef = useRef<Point | null>(null)
  const drawModeRef = useRef<DrawMode>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>(null)
  const [currentPoints, setCurrentPoints] = useState<Point[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  drawModeRef.current = drawMode
  // currentPointsRef nur in Handlern setzen – nicht aus State syncen

  const toPx = useCallback(
    (p: Point) => ({
      x: p.x * width,
      y: p.y * height,
    }),
    [width, height]
  )

  const handlePointer = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, add: boolean) => {
      if (readOnly) return
      const target = e.currentTarget as HTMLDivElement
      const r = target.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      e.preventDefault()
      e.stopPropagation()
      const p = relativePoint(e, r)
      const points = currentPointsRef.current
      const mode = drawModeRef.current
      if (!add) {
        const lineStart = lineAxisStartRef.current
        if (mode === 'line' && (points.length === 1 || lineStart !== null)) {
          const start = points.length === 1 ? points[0] : lineStart!
          const newItem: Annotation = {
            type: 'line',
            points: [start, p],
            color: '#ffffff',
          }
          onChange({ ...annotations, items: [...annotations.items, newItem] })
          setCurrentPoints([])
          currentPointsRef.current = []
          lineAxisStartRef.current = null
          return
        }
        if (!mode) return
        setCurrentPoints([p])
        currentPointsRef.current = [p]
        if (mode === 'line') lineAxisStartRef.current = p
        setIsDrawing(true)
        return
      }
      setCurrentPoints((prev) => {
        const next = [...prev, p]
        currentPointsRef.current = next
        return next
      })
    },
    [readOnly, annotations, onChange]
  )

  const finishDrawing = useCallback(() => {
    if (readOnly || !drawModeRef.current) return
    const points = currentPointsRef.current
    const drawMode = drawModeRef.current
    if (points.length === 0) {
      setIsDrawing(false)
      return
    }
    if (drawMode === 'line' && points.length === 1) {
      lineAxisStartRef.current = points[0]
      return
    }
    const color = '#ffffff'
    let newItem: Annotation | null = null
    if (drawMode === 'line' && points.length >= 2) {
      newItem = { type: 'line', points: [points[0], points[1]], color }
    }
    if (drawMode === 'stroke' && points.length >= 2) {
      newItem = { type: 'stroke', points: [...points], color }
    }
    if (newItem) {
      onChange({
        ...annotations,
        items: [...annotations.items, newItem],
      })
    }
    setCurrentPoints([])
    currentPointsRef.current = []
    lineAxisStartRef.current = null
    setIsDrawing(false)
  }, [readOnly, annotations, onChange])

  useEffect(() => {
    if (!isDrawing) return
    const onUp = () => finishDrawing()
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [isDrawing, finishDrawing])

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden rounded-[12px] bg-[#E5E2DC]"
      >
        <img
          src={imageUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
          width={width}
          height={height}
          draggable={false}
        />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full touch-none"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {annotations.items.map((item, idx) => {
            if (item.type === 'line' || item.type === 'axis') {
              const [a, b] = item.points
              const pa = toPx(a)
              const pb = toPx(b)
              return (
                <line
                  key={idx}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke="#ffffff"
                  strokeWidth={STROKE_WIDTH}
                />
              )
            }
            if (item.type === 'point') {
              const pa = toPx(item.point)
              return (
                <circle
                  key={idx}
                  cx={pa.x}
                  cy={pa.y}
                  r={4}
                  fill={item.color ?? '#ffffff'}
                  stroke="#ffffff"
                  strokeWidth={STROKE_WIDTH}
                />
              )
            }
            if (item.type === 'stroke' && item.points.length >= 2) {
              const d = item.points
                .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toPx(pt).x} ${toPx(pt).y}`)
                .join(' ')
              return (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke={item.color ?? '#ffffff'}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                />
              )
            }
            if (item.type === 'angle') {
              const [a, b, c] = item.points
              const pa = toPx(a)
              const pb = toPx(b)
              const pc = toPx(c)
              return (
                <g key={idx}>
                  <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={item.color ?? '#ffffff'} strokeWidth={STROKE_WIDTH} />
                  <line x1={pa.x} y1={pa.y} x2={pc.x} y2={pc.y} stroke={item.color ?? '#ffffff'} strokeWidth={STROKE_WIDTH} />
                </g>
              )
            }
            return null
          })}
          {currentPoints.length >= 1 &&
            drawMode === 'stroke' &&
            currentPoints.length >= 2 && (
              <path
                d={currentPoints
                  .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toPx(pt).x} ${toPx(pt).y}`)
                  .join(' ')}
                fill="none"
                stroke="#ffffff"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
              />
            )}
          {currentPoints.length === 2 && drawMode === 'line' && (
            <line
              x1={toPx(currentPoints[0]).x}
              y1={toPx(currentPoints[0]).y}
              x2={toPx(currentPoints[1]).x}
              y2={toPx(currentPoints[1]).y}
              stroke="#ffffff"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray="4"
            />
          )}
          {currentPoints.length === 1 && drawMode === 'line' && (
            <circle cx={toPx(currentPoints[0]).x} cy={toPx(currentPoints[0]).y} r={5} fill="none" stroke="#ffffff" strokeWidth={STROKE_WIDTH} />
          )}
        </svg>
        {canInteract && (
          <div
            className="absolute inset-0 z-10 cursor-crosshair touch-none"
            onMouseDown={(e) => handlePointer(e, false)}
            onMouseMove={(e) => {
              if (currentPointsRef.current.length >= 1 && drawModeRef.current === 'stroke') {
                handlePointer(e, true)
              }
            }}
            onTouchStart={(e) => handlePointer(e, false)}
            onTouchMove={(e) => {
              if (currentPointsRef.current.length >= 1 && drawModeRef.current === 'stroke') {
                handlePointer(e, true)
              }
            }}
          />
        )}
        {canInteract && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-wrap items-center justify-center gap-2 bg-black/50 px-2 py-2 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {([
              { mode: 'line' as const, title: 'Linie', icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <line x1={4} y1={20} x2={20} y2={4} strokeLinecap="round" />
                </svg>
              ) },
              { mode: 'stroke' as const, title: 'Strich', icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
                  <path d="M4 12c2-2 4-2 6 0s4 4 8 4 4-2 6-4" />
                </svg>
              ) },
            ]).map(({ mode, title, icon }) => (
              <button
                key={mode}
                type="button"
                title={title}
                onClick={(e) => {
                  e.stopPropagation()
                  setDrawMode(drawMode === mode ? null : mode)
                }}
                className={`rounded-[20px] border-[1.5px] p-2 transition ${
                  drawMode === mode
                    ? 'border-[#154226] bg-[#edf3ef] text-[#0f301b]'
                    : 'border-white/40 bg-white/90 text-[#1B1F23] hover:border-[#154226] hover:bg-[#edf3ef]'
                }`}
              >
                {icon}
              </button>
            ))}
            <button
              type="button"
              title="Letzte Markierung rückgängig"
              onClick={(e) => {
                e.stopPropagation()
                if (annotations.items.length === 0) return
                onChange({ ...annotations, items: annotations.items.slice(0, -1) })
              }}
              className="rounded-[20px] border-[1.5px] border-white/40 bg-white/90 p-2 text-[#1B1F23] transition hover:border-[#154226] hover:bg-[#edf3ef]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a4 4 0 014 4v2M3 10l4-4m-4 4l4 4" />
              </svg>
            </button>
            <button
              type="button"
              title="Alle Markierungen löschen"
              onClick={(e) => {
                e.stopPropagation()
                if (annotations.items.length === 0) return
                onChange({ ...annotations, items: [] })
              }}
              className="rounded-[20px] border-[1.5px] border-white/40 bg-white/90 p-2 text-[#1B1F23] transition hover:border-red-400 hover:bg-red-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
