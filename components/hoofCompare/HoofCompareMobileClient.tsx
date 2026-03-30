'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { HoofKey, HoofState } from '@/lib/hoofs'
import { singleHoofStatus, hoofOverallStatusLabel } from '@/lib/hoofs'
import {
  diffHoofSides,
  summarizeDiffGerman,
  type HoofCompareView,
  photoOverlayTitle,
} from '@/lib/hoofCompare'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'
import type { HorseHoofCompareLoaded } from '@/lib/hoofCompare/loadHorseHoofComparePageData'
import type { CompareSidePayload } from '@/components/hoofCompare/HoofComparePageClient'
import HoofCompareFullscreen from '@/components/hoofCompare/HoofCompareFullscreen'
import { copyTextWithExecCommand } from '@/lib/clipboard/copyTextIosSafe'
import {
  defaultCompareExportFilename,
  exportCompareSideBySidePng,
} from '@/lib/hoofCompare/exportCompareSideBySide'

const HUF_KEYS: HoofKey[] = ['vl', 'vr', 'hl', 'hr']

function formatGermanDate(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function formatShort(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(d)
}

function hoofValueTone(field: 'toe' | 'heel' | 'sole' | 'frog', val: string | null): 'ok' | 'warn' | 'danger' {
  if (!val) return 'ok'
  if (field === 'frog' && val === 'faulig') return 'danger'
  if (field === 'toe' && val !== 'gerade') return 'warn'
  if (field === 'heel' && val !== 'normal' && val !== 'ausgeglichen') return 'warn'
  if (field === 'sole' && val !== 'stabil') return 'warn'
  if (field === 'frog' && val !== 'gesund') return 'warn'
  return 'ok'
}

function statusTone(status: ReturnType<typeof singleHoofStatus>): 'ok' | 'warn' | 'danger' {
  if (status === 'problematisch') return 'danger'
  if (status === 'behandlungsbeduerftig') return 'warn'
  return 'ok'
}

const toneClass: Record<'ok' | 'warn' | 'danger', string> = {
  ok: 'text-[#166534]',
  warn: 'font-semibold text-[#B45309]',
  danger: 'font-semibold text-[#DC2626]',
}

function BefundMini({
  side,
  fieldDiff,
  statusEqual,
  statusLabel,
}: {
  side: CompareSidePayload
  fieldDiff: ReturnType<typeof diffHoofSides>
  statusEqual: boolean
  statusLabel: string
}) {
  const h = side.hoofState
  const row = (label: string, value: string, diffKey: keyof typeof fieldDiff, tone: 'ok' | 'warn' | 'danger') => {
    const equal = fieldDiff[diffKey]
    return (
      <div
        className={[
          'flex justify-between gap-2 py-1 text-[10px]',
          !equal ? 'rounded bg-[#FDF6EC] px-1 -mx-1' : '',
        ].join(' ')}
      >
        <span className="text-[#9CA3AF]">{label}</span>
        <span className={`font-semibold ${toneClass[tone]}`}>{value}</span>
      </div>
    )
  }
  return (
    <div className="border-t border-[#F0EEEA] px-2.5 py-2">
      {row('Zehe', h.toe_alignment ?? '–', 'toe_alignment', hoofValueTone('toe', h.toe_alignment))}
      {row('Trachten', h.heel_balance ?? '–', 'heel_balance', hoofValueTone('heel', h.heel_balance))}
      {row('Strahl', h.frog_condition ?? '–', 'frog_condition', hoofValueTone('frog', h.frog_condition))}
      {row('Sohle', h.sole_condition ?? '–', 'sole_condition', hoofValueTone('sole', h.sole_condition))}
      <div
        className={[
          'flex justify-between gap-2 py-1 text-[10px]',
          !statusEqual ? 'rounded bg-[#FDF6EC] px-1 -mx-1' : '',
        ].join(' ')}
      >
        <span className="text-[#9CA3AF]">Status</span>
        <span className={`font-semibold ${toneClass[statusTone(singleHoofStatus(h))]}`}>{statusLabel}</span>
      </div>
    </div>
  )
}

export default function HoofCompareMobileClient({
  basePath,
  horseName,
  horseSubtitle,
  recordOptions,
  left,
  right,
  hoof,
  view,
  slotKey,
  timeline,
  daysBetween,
}: HorseHoofCompareLoaded) {
  const router = useRouter()
  const [uiMode, setUiMode] = useState<'side' | 'slider'>('side')
  const [sliderPct, setSliderPct] = useState(50)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)

  const compareHref = useCallback(
    (next: { left?: string; right?: string; hoof?: HoofKey; view?: HoofCompareView }) => {
      const q = new URLSearchParams()
      q.set('left', next.left ?? left.recordId)
      q.set('right', next.right ?? right.recordId)
      q.set('hoof', next.hoof ?? hoof)
      q.set('view', next.view ?? view)
      router.push(`${basePath}/records/compare/mobile?${q.toString()}`)
    },
    [basePath, left.recordId, right.recordId, hoof, view, router]
  )

  const fieldDiff = useMemo(() => diffHoofSides(left.hoofState, right.hoofState), [left.hoofState, right.hoofState])
  const statusLeft = singleHoofStatus(left.hoofState)
  const statusRight = singleHoofStatus(right.hoofState)
  const statusEqual = statusLeft === statusRight
  const summary = useMemo(() => summarizeDiffGerman(fieldDiff), [fieldDiff])
  const statusSummary = !statusEqual
    ? `Status: ${hoofOverallStatusLabel(statusLeft)} → ${hoofOverallStatusLabel(statusRight)}.`
    : null

  const swap = () => compareHref({ left: right.recordId, right: left.recordId })

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
        leftCaption: `Vorher · ${formatGermanDate(left.recordDate)}`,
        rightCaption: `Nachher · ${formatGermanDate(right.recordDate)}`,
        filenameBase: defaultCompareExportFilename(horseName),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export fehlgeschlagen'
      const insecure =
        (e instanceof Error && /insecure|SecurityError/i.test(e.message)) ||
        (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'SecurityError')
      window.alert(
        insecure
          ? 'PNG-Export wird auf diesem Gerät blockiert. Bitte Seite neu laden oder in Safari erneut versuchen.'
          : msg
      )
    } finally {
      setExporting(false)
    }
  }

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Fotovergleich · ${horseName}`, url })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    if (copyTextWithExecCommand(url)) {
      window.alert('Link in die Zwischenablage kopiert.')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      window.alert('Link in die Zwischenablage kopiert.')
    } catch {
      window.prompt('Link zum Kopieren (markieren und kopieren):', url)
    }
  }

  const onSliderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onSliderPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(8, Math.min(92, (x / rect.width) * 100))
    setSliderPct(pct)
  }

  const onSliderPointerUp = (e: React.PointerEvent) => {
    dragRef.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const slotLabel = SLOT_LABELS[slotKey] ?? slotKey
  const docLeft = left.docNumber ?? left.recordId.replace(/-/g, '').slice(-4).toUpperCase()
  const docRight = right.docNumber ?? right.recordId.replace(/-/g, '').slice(-4).toUpperCase()

  return (
    <div className="hoof-compare-mobile mx-auto max-w-[430px] min-h-[100dvh] bg-[#f6f5f3] pb-[calc(16px+env(safe-area-inset-bottom,0px))] [-webkit-tap-highlight-color:transparent]">
      <div className="h-[calc(8px+env(safe-area-inset-top,0px))] bg-[#1c2023]" aria-hidden />

      <header className="bg-[#1c2023] px-5 pb-3.5 pt-4 text-white">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-0 bg-white/10 text-lg active:bg-white/20"
            onClick={() => router.back()}
            aria-label="Zurück"
          >
            <i className="bi bi-chevron-left" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 text-center font-[family-name:var(--font-serif)] text-[17px] font-semibold leading-tight">
            Fotovergleich
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border-0 bg-white/10 active:bg-white/20"
              onClick={() => setFullscreenOpen(true)}
              aria-label="Vollbild"
            >
              <i className="bi bi-fullscreen" aria-hidden />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border-0 bg-white/10 active:bg-white/20"
              onClick={() => void handleShare()}
              aria-label="Teilen"
            >
              <i className="bi bi-share-fill" aria-hidden />
            </button>
          </div>
        </div>
        <p className="text-center text-[11px] text-white/40">{horseSubtitle}</p>
      </header>

      <div className="flex gap-1.5 bg-[#1c2023] px-5 pb-3">
        {HUF_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => compareHref({ hoof: k })}
            className={[
              'min-h-[44px] flex-1 rounded-lg border-[1.5px] py-2 text-center text-[12px] font-semibold transition active:scale-[0.98]',
              hoof === k
                ? 'border-white/20 bg-white/12 text-white'
                : 'border-white/12 bg-transparent text-white/40',
            ].join(' ')}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 bg-[#1c2023] px-5 pb-3">
        <button
          type="button"
          onClick={() => compareHref({ view: 'solar' })}
          className={[
            'flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition',
            view === 'solar'
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-white/10 bg-transparent text-white/35',
          ].join(' ')}
        >
          <i className="bi bi-arrow-down text-[11px]" aria-hidden />
          Solar
        </button>
        <button
          type="button"
          onClick={() => compareHref({ view: 'lateral' })}
          className={[
            'flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition',
            view === 'lateral'
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-white/10 bg-transparent text-white/35',
          ].join(' ')}
        >
          <i className="bi bi-arrow-right text-[11px]" aria-hidden />
          Lateral
        </button>
      </div>

      <div className="flex border-b border-[#E5E2DC] bg-white">
        <button
          type="button"
          onClick={() => setUiMode('side')}
          className={[
            'min-h-[48px] flex-1 py-3 text-center text-[12px] font-semibold transition',
            uiMode === 'side' ? 'border-b-2 border-[#52b788] text-[#1B1F23]' : 'text-[#9CA3AF]',
          ].join(' ')}
        >
          Nebeneinander
        </button>
        <button
          type="button"
          onClick={() => setUiMode('slider')}
          className={[
            'min-h-[48px] flex-1 py-3 text-center text-[12px] font-semibold transition',
            uiMode === 'slider' ? 'border-b-2 border-[#52b788] text-[#1B1F23]' : 'text-[#9CA3AF]',
          ].join(' ')}
        >
          Überblenden
        </button>
      </div>

      {uiMode === 'side' ? (
        <div className="animate-in fade-in grid grid-cols-2 gap-0 duration-200">
          <section className="border-r border-[#E5E2DC]">
            <div className="flex items-center justify-center gap-1.5 border-b border-[#F0EEEA] bg-[rgba(59,130,246,0.06)] py-2.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#3B82F6]">
              <i className="bi bi-arrow-left-circle-fill text-[12px]" aria-hidden />
              Vorher
            </div>
            <div className="border-b border-[#F0EEEA] px-2.5 py-2">
              <select
                className="h-11 w-full cursor-pointer rounded-md border border-[#E5E2DC] bg-white py-1.5 pl-2 pr-7 text-[10px] font-medium text-[#1B1F23] focus:border-[#52b788] focus:outline-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%239CA3AF' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  appearance: 'none',
                }}
                value={left.recordId}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === right.recordId) return
                  compareHref({ left: v })
                }}
              >
                {recordOptions.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.id === right.recordId}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-center p-2.5">
              <div className="relative flex w-full max-w-[200px] aspect-[9/16] overflow-hidden rounded-[10px] bg-[#C9B99A] shadow-md">
                {left.missingDoc || !left.signedUrl ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-white/50">
                    <span>{photoOverlayTitle(hoof, view)}</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={left.signedUrl} alt="" className="h-full w-full object-cover" />
                )}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 py-2 text-[9px] text-white">
                  <div className="text-[10px] font-bold">{photoOverlayTitle(hoof, view)}</div>
                  <div className="mt-0.5 opacity-70">
                    {formatGermanDate(left.recordDate)} · {docLeft}
                  </div>
                </div>
              </div>
            </div>
            <BefundMini
              side={left}
              fieldDiff={fieldDiff}
              statusEqual={statusEqual}
              statusLabel={hoofOverallStatusLabel(statusLeft)}
            />
          </section>

          <section>
            <div className="flex items-center justify-center gap-1.5 border-b border-[#F0EEEA] bg-[rgba(82,183,136,0.06)] py-2.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#52b788]">
              <i className="bi bi-arrow-right-circle-fill text-[12px]" aria-hidden />
              Nachher
            </div>
            <div className="border-b border-[#F0EEEA] px-2.5 py-2">
              <select
                className="h-11 w-full cursor-pointer rounded-md border border-[#E5E2DC] bg-white py-1.5 pl-2 pr-7 text-[10px] font-medium text-[#1B1F23] focus:border-[#52b788] focus:outline-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%239CA3AF' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  appearance: 'none',
                }}
                value={right.recordId}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === left.recordId) return
                  compareHref({ right: v })
                }}
              >
                {recordOptions.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.id === left.recordId}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-center p-2.5">
              <div className="relative flex w-full max-w-[200px] aspect-[9/16] overflow-hidden rounded-[10px] bg-[#C9B99A] shadow-md">
                {right.missingDoc || !right.signedUrl ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-white/50">
                    <span>{photoOverlayTitle(hoof, view)}</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={right.signedUrl} alt="" className="h-full w-full object-cover" />
                )}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2.5 py-2 text-[9px] text-white">
                  <div className="text-[10px] font-bold">{photoOverlayTitle(hoof, view)}</div>
                  <div className="mt-0.5 opacity-70">
                    {formatGermanDate(right.recordDate)} · {docRight}
                  </div>
                </div>
              </div>
            </div>
            <BefundMini
              side={right}
              fieldDiff={fieldDiff}
              statusEqual={statusEqual}
              statusLabel={hoofOverallStatusLabel(statusRight)}
            />
          </section>
        </div>
      ) : (
        <div>
          <div
            ref={sliderRef}
            className="relative w-full touch-none aspect-[9/16] max-h-[min(70vh,520px)] bg-[#C9B99A]"
            onPointerMove={onSliderPointerMove}
            onPointerUp={onSliderPointerUp}
            onPointerLeave={onSliderPointerUp}
          >
            {right.signedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={right.signedUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {left.signedUrl && (
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={left.signedUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
            <button
              type="button"
              aria-label="Vergleichslinie verschieben"
              className="absolute top-0 bottom-0 z-10 w-4 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent p-0"
              style={{ left: `${sliderPct}%` }}
              onPointerDown={onSliderPointerDown}
            >
              <span className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white shadow-md" />
              <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[12px] text-[#6B7280] shadow-md">
                ⇔
              </span>
            </button>
          </div>
          <div className="flex gap-2 border-b border-[#E5E2DC] bg-white px-4 py-2.5">
            <select
              className="h-11 min-h-[44px] flex-1 cursor-pointer rounded-md border border-[#E5E2DC] bg-white px-2 text-[10px] font-medium"
              style={{ appearance: 'none' }}
              value={left.recordId}
              onChange={(e) => {
                const v = e.target.value
                if (v === right.recordId) return
                compareHref({ left: v })
              }}
            >
              {recordOptions.map((o) => (
                <option key={o.id} value={o.id} disabled={o.id === right.recordId}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="h-11 min-h-[44px] flex-1 cursor-pointer rounded-md border border-[#E5E2DC] bg-white px-2 text-[10px] font-medium"
              style={{ appearance: 'none' }}
              value={right.recordId}
              onChange={(e) => {
                const v = e.target.value
                if (v === left.recordId) return
                compareHref({ right: v })
              }}
            >
              {recordOptions.map((o) => (
                <option key={o.id} value={o.id} disabled={o.id === left.recordId}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.04em]">
            <span className="flex items-center gap-1 text-[#3B82F6]">
              <i className="bi bi-arrow-left-circle-fill" aria-hidden />
              {formatGermanDate(left.recordDate)}
            </span>
            <span className="flex items-center gap-1 text-[#52b788]">
              {formatGermanDate(right.recordDate)}
              <i className="bi bi-arrow-right-circle-fill" aria-hidden />
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[#E5E2DC] bg-white px-4 py-3 text-[11px] text-[#6B7280]">
        {daysBetween != null && (
          <span>
            <strong className="text-[#1B1F23]">{daysBetween} Tage</strong> Abstand
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-right">
          {summary}
          {statusSummary ? ` ${statusSummary}` : ''}
        </span>
      </div>

      {timeline.length > 0 && (
        <section className="border-t border-[#E5E2DC] bg-white py-3.5">
          <div className="mb-2.5 flex items-center gap-1.5 px-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9CA3AF]">
            <i className="bi bi-clock-history text-[13px] text-[#52b788]" aria-hidden />
            Foto-Timeline · {slotLabel}
          </div>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
            {timeline.map((t, idx) => {
              const isLeft = t.legacyRecordId === left.recordId
              const isRight = t.legacyRecordId === right.recordId
              const onPick = () => {
                if (timeline.length < 2) return
                if (idx >= 1) {
                  compareHref({ left: timeline[idx - 1]!.legacyRecordId, right: t.legacyRecordId })
                } else {
                  compareHref({ left: timeline[0]!.legacyRecordId, right: timeline[1]!.legacyRecordId })
                }
              }
              return (
                <button
                  key={`${t.legacyRecordId}-${idx}`}
                  type="button"
                  onClick={onPick}
                  className="w-14 shrink-0 cursor-pointer text-left active:scale-[0.97]"
                >
                  <div
                    className={[
                      'relative mb-1 aspect-[9/16] w-full overflow-hidden rounded-md border-2 bg-[#fafaf8]',
                      isLeft ? 'border-[#3B82F6] shadow-[0_0_0_2px_rgba(59,130,246,0.15)]' : '',
                      isRight ? 'border-[#52b788] shadow-[0_0_0_2px_rgba(82,183,136,0.15)]' : '',
                      !isLeft && !isRight ? 'border-transparent' : '',
                    ].join(' ')}
                  >
                    {t.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.signedUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#F0EEEA]">
                        <i className="bi bi-image text-[14px] text-[#E5E2DC]" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[9px] font-semibold text-[#6B7280]">{formatShort(t.recordDate)}</div>
                  <div className="mt-0.5 text-center text-[8px] text-[#9CA3AF]">
                    {t.recordTypeLabel || 'Doku'}
                  </div>
                  {(isLeft || isRight) && (
                    <div className="mt-1 flex justify-center">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isLeft ? 'bg-[#3B82F6]' : 'bg-[#52b788]'}`}
                        aria-hidden
                      />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex gap-2 px-4 py-3.5">
        <button
          type="button"
          disabled
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#E5E2DC] bg-[#fafaf9] text-[12px] font-semibold text-[#9CA3AF]"
        >
          <i className="bi bi-file-pdf-fill text-[15px]" aria-hidden />
          PDF
        </button>
        <button
          type="button"
          onClick={() => void handleShare()}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#E5E2DC] bg-white text-[12px] font-semibold text-[#6B7280] active:scale-[0.98]"
        >
          <i className="bi bi-send-fill text-[15px]" aria-hidden />
          Senden
        </button>
        <button
          type="button"
          disabled={exporting || (!left.signedUrl && !right.signedUrl)}
          onClick={() => void handleExportPng()}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#52b788] bg-[#52b788] text-[12px] font-semibold text-white active:scale-[0.98] disabled:opacity-40"
        >
          <i className={`bi ${exporting ? 'bi-hourglass-split' : 'bi-download'} text-[15px]`} aria-hidden />
          {exporting ? '…' : 'PNG'}
        </button>
      </div>

      <p className="px-4 pb-4 text-center text-[10px] text-[#9CA3AF]">
        <Link href={`${basePath}/records/compare?${new URLSearchParams({ left: left.recordId, right: right.recordId, hoof, view }).toString()}`} className="text-[#52b788] underline">
          Desktop-Ansicht
        </Link>
      </p>

      <HoofCompareFullscreen
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        horseName={horseName}
        horseSubtitle={horseSubtitle}
        hoof={hoof}
        view={view}
        left={left}
        right={right}
        timeline={timeline}
        onSwap={swap}
      />
    </div>
  )
}
