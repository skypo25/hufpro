'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { HoofKey } from '@/lib/hoofs'
import { photoOverlayTitle, type HoofCompareView } from '@/lib/hoofCompare'
import {
  defaultCompareExportFilename,
  exportCompareSideBySidePng,
} from '@/lib/hoofCompare/exportCompareSideBySide'
import type { CompareSidePayload, TimelineItem } from '@/components/hoofCompare/HoofComparePageClient'
import { HorseIcon } from '@/components/icons/HorseIcon'

function formatGermanDateShort(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function formatGermanDateLong(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function docDisplay(side: CompareSidePayload): string {
  return side.docNumber ?? side.recordId.replace(/-/g, '').slice(-4).toUpperCase()
}

function recordTypeLine(timeline: TimelineItem[], legacyId: string, side: CompareSidePayload): string {
  const t = timeline.find((x) => x.legacyRecordId === legacyId)?.recordTypeLabel
  const dok = docDisplay(side)
  if (t) return `${dok} · ${t}`
  return dok
}

type Props = {
  open: boolean
  onClose: () => void
  horseName: string
  horseSubtitle: string
  hoof: HoofKey
  view: HoofCompareView
  left: CompareSidePayload
  right: CompareSidePayload
  timeline: TimelineItem[]
  onSwap: () => void
}

export default function HoofCompareFullscreen({
  open,
  onClose,
  horseName,
  horseSubtitle,
  hoof,
  view,
  left,
  right,
  timeline,
  onSwap,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [clickZoomLeft, setClickZoomLeft] = useState(false)
  const [clickZoomRight, setClickZoomRight] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const zoomIn = useCallback(() => {
    setZoomPercent((z) => Math.min(200, z + 25))
  }, [])
  const zoomOut = useCallback(() => {
    setZoomPercent((z) => Math.max(50, z - 25))
  }, [])
  const resetZoom = useCallback(() => {
    setZoomPercent(100)
    setClickZoomLeft(false)
    setClickZoomRight(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
        return
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
        return
      }
      if (e.key === '0') {
        e.preventDefault()
        resetZoom()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, zoomIn, zoomOut, resetZoom])

  useEffect(() => {
    if (!open) {
      setZoomPercent(100)
      setClickZoomLeft(false)
      setClickZoomRight(false)
    }
  }, [open])

  const titleLine =
    view === 'solar'
      ? `Fotovergleich · ${hoof.toUpperCase()} Sohlenansicht`
      : `Fotovergleich · ${hoof.toUpperCase()} Lateral`

  async function handleExportPng() {
    if (exporting) return
    setExporting(true)
    try {
      await exportCompareSideBySidePng({
        leftUrl: left.signedUrl,
        rightUrl: right.signedUrl,
        titleLine,
        leftCaption: `Vorher · ${formatGermanDateShort(left.recordDate)}`,
        rightCaption: `Nachher · ${formatGermanDateShort(right.recordDate)}`,
        filenameBase: defaultCompareExportFilename(horseName),
      })
    } catch (e) {
      const insecure =
        (e instanceof Error && /insecure|SecurityError/i.test(e.message)) ||
        (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'SecurityError')
      const msg = e instanceof Error ? e.message : 'Export fehlgeschlagen'
      window.alert(
        insecure
          ? 'PNG-Export wird auf diesem Gerät blockiert. Bitte Seite neu laden oder erneut versuchen.'
          : `${msg}\n\nTipp: Falls das Bild von einer anderen Domain geladen wird, kann der Browser den Export blockieren. Seite neu laden und erneut versuchen.`
      )
    } finally {
      setExporting(false)
    }
  }

  if (!mounted || !open) return null

  const baseScale = zoomPercent / 100

  const PhotoBlock = ({
    side,
    variant,
  }: {
    side: CompareSidePayload
    variant: 'left' | 'right'
  }) => {
    const clickZoom = variant === 'left' ? clickZoomLeft : clickZoomRight
    const setClickZoom = variant === 'left' ? setClickZoomLeft : setClickZoomRight
    const combined = baseScale * (clickZoom ? 1.5 : 1)

    return (
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div
          className={[
            'pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] backdrop-blur-md',
            variant === 'left'
              ? 'border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.15)] text-[#3B82F6]'
              : 'border border-[rgba(82,183,136,0.2)] bg-[rgba(82,183,136,0.15)] text-[#52b788]',
          ].join(' ')}
        >
          {variant === 'left' ? (
            <>
              <i className="bi bi-arrow-left-circle-fill pointer-events-none text-[12px]" aria-hidden />
              VORHER · {formatGermanDateShort(side.recordDate)}
            </>
          ) : (
            <>
              NACHHER · {formatGermanDateShort(side.recordDate)}
              <i className="bi bi-arrow-right-circle-fill pointer-events-none text-[12px]" aria-hidden />
            </>
          )}
        </div>

        <div
          className={`relative flex flex-1 items-center overflow-hidden py-5 ${
            variant === 'left' ? 'justify-end pr-1.5' : 'justify-start pl-1.5'
          }`}
        >
          <button
            type="button"
            onClick={() => setClickZoom((v) => !v)}
            className="relative aspect-[9/16] max-h-[min(100%,calc(100vh-140px))] h-full overflow-hidden rounded-xl bg-[#8B7355] shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-transform duration-200"
            style={{ transform: `scale(${combined})`, transformOrigin: 'center center' }}
            title={clickZoom ? 'Zoom zurücksetzen (Klick)' : 'Vergrößern (Klick)'}
          >
            {side.missingDoc || !side.signedUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25">
                <i className="bi bi-image text-[40px]" aria-hidden />
                <span className="text-[12px] font-medium">
                  {photoOverlayTitle(hoof, view)} · {formatGermanDateShort(side.recordDate)}
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={side.signedUrl} alt="" className="h-full w-full object-cover" />
            )}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5] h-[30%] bg-gradient-to-t from-black/50 to-transparent"
              aria-hidden
            />
            <div className="absolute bottom-0 left-0 right-0 z-[5] px-5 py-4 text-left text-white">
              <div className="text-[14px] font-bold">{photoOverlayTitle(hoof, view)}</div>
              <div className="mt-0.5 text-[12px] opacity-70">{formatGermanDateLong(side.recordDate)}</div>
              <div className="mt-0.5 text-[10px] opacity-50">
                {recordTypeLine(timeline, side.recordId, side)}
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex h-[100dvh] flex-col bg-[#0a0c0e] text-[#F1F2F0]"
      role="dialog"
      aria-modal="true"
      aria-label="Fotovergleich Vollbild"
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-4 border-b border-white/[0.08] bg-white/[0.03] px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-0 bg-white/[0.06] text-[#F1F2F0] transition hover:bg-white/10"
          title="Zurück"
        >
          <i className="bi bi-arrow-left text-[16px]" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(82,183,136,0.12)] text-[#52b788]">
              <HorseIcon className="h-[18px] w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-[family-name:var(--font-serif)] text-[16px] font-semibold leading-tight text-[#F1F2F0]">
                {horseName}
              </div>
              <div className="hidden text-[11px] text-[#9CA3AF] sm:block">{horseSubtitle}</div>
            </div>
          </div>
          <div className="hidden h-6 w-px bg-white/[0.08] sm:block" aria-hidden />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-[14px] font-semibold text-[#F1F2F0]">{titleLine}</div>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <button
            type="button"
            disabled
            title="Demnächst"
            className="flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/[0.08] px-4 text-[12px] font-semibold text-[#6B7280]"
          >
            <i className="bi bi-file-pdf-fill text-[15px]" aria-hidden />
            PDF
          </button>
          <button
            type="button"
            onClick={() => void handleExportPng()}
            disabled={exporting || (!left.signedUrl && !right.signedUrl)}
            title="Beide Fotos nebeneinander als PNG speichern"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] px-4 text-[12px] font-semibold text-[#F1F2F0] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className={`bi ${exporting ? 'bi-hourglass-split' : 'bi-download'} text-[15px]`} aria-hidden />
            {exporting ? 'Export…' : 'Export'}
          </button>
          <button
            type="button"
            disabled
            title="Demnächst"
            className="flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/[0.08] px-4 text-[12px] font-semibold text-[#6B7280]"
          >
            <i className="bi bi-share-fill text-[15px]" aria-hidden />
            Teilen
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-transparent text-[#9CA3AF] transition hover:bg-white/[0.08] hover:text-white"
          title="Schließen (Esc)"
        >
          <i className="bi bi-x-lg text-[18px]" aria-hidden />
        </button>
      </div>

      {/* Control bar — nur Zoom (Huf/Ansicht über URL) */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-4 border-b border-white/[0.08] px-4 py-2.5 sm:gap-5 sm:px-6">
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Zoom</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={zoomOut}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-[#9CA3AF] transition hover:bg-white/[0.06] hover:text-[#F1F2F0]"
              aria-label="Verkleinern"
            >
              <i className="bi bi-dash text-[14px]" aria-hidden />
            </button>
            <span className="min-w-[40px] text-center text-[11px] font-semibold text-[#9CA3AF]">{zoomPercent}%</span>
            <button
              type="button"
              onClick={zoomIn}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-[#9CA3AF] transition hover:bg-white/[0.06] hover:text-[#F1F2F0]"
              aria-label="Vergrößern"
            >
              <i className="bi bi-plus text-[14px]" aria-hidden />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-[#9CA3AF] transition hover:bg-white/[0.06] hover:text-[#F1F2F0]"
              title="Zurücksetzen"
            >
              <i className="bi bi-fullscreen text-[14px]" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Compare area */}
      <div className="group/compare-area relative flex min-h-0 flex-1 overflow-hidden">
        <PhotoBlock side={left} variant="left" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={onSwap}
            title="Seiten tauschen"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[rgba(20,22,24,0.85)] text-[11px] font-extrabold text-[#9CA3AF] backdrop-blur-md transition hover:border-[rgba(82,183,136,0.3)] hover:bg-[rgba(82,183,136,0.2)] hover:text-[#52b788]"
          >
            <i className="bi bi-arrow-left-right text-[14px]" aria-hidden />
          </button>
        </div>
        <PhotoBlock side={right} variant="right" />

        <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden gap-2 opacity-0 transition-opacity group-hover/compare-area:opacity-100 sm:flex">
          <span className="rounded border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold text-[#9CA3AF]">
            + − Zoom
          </span>
          <span className="rounded border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold text-[#9CA3AF]">
            ESC Schließen
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}
