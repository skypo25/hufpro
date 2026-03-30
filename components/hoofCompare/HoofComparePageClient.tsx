'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import type { HoofKey, HoofState } from '@/lib/hoofs'
import { singleHoofStatus, hoofOverallStatusLabel } from '@/lib/hoofs'
import {
  diffHoofSides,
  summarizeDiffGerman,
  photoSlotKeyFromHoofView,
  type HoofCompareView,
  photoOverlayTitle,
  hoofLongLabel,
} from '@/lib/hoofCompare'
import { SLOT_LABELS, type PhotoSlotKey } from '@/lib/photos/photoTypes'
import { HorseIcon } from '@/components/icons/HorseIcon'
import HoofCompareFullscreen from './HoofCompareFullscreen'

export type CompareSidePayload = {
  recordId: string
  recordDate: string | null
  docNumber: string | null
  signedUrl: string | null
  missingDoc: boolean
  hoofState: HoofState
}

export type RecordOption = { id: string; label: string }

export type TimelineItem = {
  legacyRecordId: string
  signedUrl: string | null
  recordDate: string | null
  docNumber: string | null
  recordTypeLabel: string | null
}

type HoofComparePageClientProps = {
  basePath: string
  horseName: string
  horseSubtitle: string
  recordOptions: RecordOption[]
  left: CompareSidePayload
  right: CompareSidePayload
  hoof: HoofKey
  view: HoofCompareView
  slotKey: PhotoSlotKey
  timeline: TimelineItem[]
  daysBetween: number | null
}

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

export default function HoofComparePageClient({
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
}: HoofComparePageClientProps) {
  const router = useRouter()
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  const compareHref = useCallback(
    (next: { left?: string; right?: string; hoof?: HoofKey; view?: HoofCompareView }) => {
      const q = new URLSearchParams()
      q.set('left', next.left ?? left.recordId)
      q.set('right', next.right ?? right.recordId)
      q.set('hoof', next.hoof ?? hoof)
      q.set('view', next.view ?? view)
      router.push(`${basePath}/records/compare?${q.toString()}`)
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

  const swap = () => {
    compareHref({ left: right.recordId, right: left.recordId })
  }

  const slotLabel = SLOT_LABELS[slotKey] ?? slotKey

  return (
    <>
      <div id="hoof-compare-root" className="mx-auto max-w-[1280px] w-full space-y-6 pb-16">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#9CA3AF]">
        <Link href="/dashboard" className="text-[#6B7280] hover:text-[#1B1F23]">
          Dashboard
        </Link>
        <span>›</span>
        <Link href="/animals" className="text-[#6B7280] hover:text-[#1B1F23]">
          Tiere
        </Link>
        <span>›</span>
        <Link href={basePath} className="text-[#6B7280] hover:text-[#1B1F23]">
          {horseName}
        </Link>
        <span>›</span>
        <span className="text-[#6B7280]">Fotovergleich</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#edf3ef] text-[#154226]">
            <HorseIcon className="h-6 w-[27px]" />
          </div>
          <div>
            <h1 className="dashboard-serif text-[24px] font-semibold tracking-[-0.02em] text-[#1B1F23]">
              Fotovergleich · {horseName}
            </h1>
            <p className="mt-0.5 text-[13px] text-[#6B7280]">{horseSubtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFullscreenOpen(true)}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E2DC] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#1B1F23] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:border-[#9CA3AF]"
          >
            <i className="bi bi-fullscreen text-[15px]" aria-hidden />
            Vollbild
          </button>
          <Link
            href={basePath}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E2DC] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#1B1F23] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:border-[#9CA3AF]"
          >
            <i className="bi bi-x-lg text-[15px]" aria-hidden />
            Schließen
          </Link>
          <Link
            href={`${basePath}/records/compare/mobile?${new URLSearchParams({ left: left.recordId, right: right.recordId, hoof, view }).toString()}`}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E2DC] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#1B1F23] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:border-[#9CA3AF] md:hidden"
          >
            <i className="bi bi-phone text-[15px]" aria-hidden />
            App-Ansicht
          </Link>
        </div>
      </div>

      {/* Huf & Ansicht — nur normale Seite; im Vollbild-Modal bewusst weggelassen */}
      <section className="huf-card">
        <div className="border-b border-[#E5E2DC] px-6 py-[18px]">
          <h2 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">Huf &amp; Ansicht</h2>
        </div>
        <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-1.5">
          {HUF_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => compareHref({ hoof: k })}
              className={[
                'min-w-[52px] flex-1 rounded-lg border-[1.5px] px-3 py-1.5 text-center text-[11px] font-semibold transition',
                hoof === k
                  ? 'border-[#52b788] bg-[rgba(82,183,136,0.06)] text-[#52b788]'
                  : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#9CA3AF]',
              ].join(' ')}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => compareHref({ view: 'solar' })}
            className={[
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition',
              view === 'solar'
                ? 'border-[#52b788] bg-[rgba(82,183,136,0.06)] text-[#52b788]'
                : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#9CA3AF]',
            ].join(' ')}
          >
            <i className="bi bi-arrow-down text-[12px]" aria-hidden />
            Solar
          </button>
          <button
            type="button"
            onClick={() => compareHref({ view: 'lateral' })}
            className={[
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition',
              view === 'lateral'
                ? 'border-[#52b788] bg-[rgba(82,183,136,0.06)] text-[#52b788]'
                : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#9CA3AF]',
            ].join(' ')}
          >
            <i className="bi bi-arrow-right text-[12px]" aria-hidden />
            Lateral
          </button>
        </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_48px_1fr] lg:gap-0">
        <SidePanel
          variant="left"
          title="Ältere Dokumentation"
          recordOptions={recordOptions}
          selectedId={left.recordId}
          onSelectId={(id) => compareHref({ left: id })}
          otherId={right.recordId}
          side={left}
          hoof={hoof}
          view={view}
          fieldDiff={fieldDiff}
          statusEqual={statusEqual}
          statusLabel={hoofOverallStatusLabel(statusLeft)}
        />

        <div className="flex flex-row items-center justify-center gap-3 py-2 lg:flex-col lg:justify-start lg:pt-40">
          <div className="hidden h-[60px] w-0.5 bg-[#F0EEEA] lg:block" aria-hidden />
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#E5E2DC] bg-white text-[10px] font-bold text-[#9CA3AF]">
            VS
          </div>
          <button
            type="button"
            title="Seiten tauschen"
            onClick={swap}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E2DC] bg-white text-[16px] text-[#9CA3AF] transition hover:border-[#52b788] hover:bg-[rgba(82,183,136,0.06)] hover:text-[#52b788]"
          >
            <i className="bi bi-arrow-left-right" aria-hidden />
          </button>
          <div className="hidden h-[60px] w-0.5 bg-[#F0EEEA] lg:block" aria-hidden />
        </div>

        <SidePanel
          variant="right"
          title="Aktuelle Dokumentation"
          recordOptions={recordOptions}
          selectedId={right.recordId}
          onSelectId={(id) => compareHref({ right: id })}
          otherId={left.recordId}
          side={right}
          hoof={hoof}
          view={view}
          fieldDiff={fieldDiff}
          statusEqual={statusEqual}
          statusLabel={hoofOverallStatusLabel(statusRight)}
        />
      </div>

      <section className="huf-card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-[13px] text-[#6B7280]">
          {daysBetween != null && (
            <p>
              <strong className="text-[#1B1F23]">Zeitraum:</strong> {daysBetween} Tage (
              {formatGermanDate(left.recordDate)} → {formatGermanDate(right.recordDate)})
            </p>
          )}
          <p>
            <strong className="text-[#1B1F23]">Veränderung:</strong> {summary}
            {statusSummary ? ` ${statusSummary}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            title="Demnächst"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-[10px] border border-[#E5E2DC] bg-[#fafaf9] px-4 py-2.5 text-[13px] font-semibold text-[#9CA3AF]"
          >
            <i className="bi bi-file-pdf-fill" aria-hidden />
            Vergleich als PDF
          </button>
          <button
            type="button"
            disabled
            title="Demnächst"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-[10px] border border-[#E5E2DC] bg-[#fafaf9] px-4 py-2.5 text-[13px] font-semibold text-[#9CA3AF]"
          >
            <i className="bi bi-share-fill" aria-hidden />
            Teilen
          </button>
        </div>
      </section>

      {timeline.length > 0 && (
        <section className="huf-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf3ef] text-[#154226]">
              <i className="bi bi-clock-history text-[15px]" aria-hidden />
            </span>
            <h2 className="dashboard-serif flex-1 text-[16px] font-medium text-[#1B1F23]">
              Foto-Timeline · {slotLabel}
            </h2>
            <span className="shrink-0 text-[11px] text-[#9CA3AF]">Chronologisch · Klick wählt Paar</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-6 py-4 scrollbar-none [&::-webkit-scrollbar]:hidden">
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
                  className="w-20 shrink-0 cursor-pointer text-left transition hover:scale-[1.03]"
                >
                  <div
                    className={[
                      'relative mb-1.5 aspect-[9/16] w-full overflow-hidden rounded-lg border-2 bg-[#fafaf8]',
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
                        <i className="bi bi-image text-[16px] text-[#E5E2DC]" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[10px] font-semibold text-[#6B7280]">{formatShort(t.recordDate)}</div>
                  <div className="mt-0.5 text-center text-[9px] text-[#9CA3AF]">
                    {t.recordTypeLabel || 'Dokumentation'}
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
      </div>

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
    </>
  )
}

function SidePanel({
  variant,
  title,
  recordOptions,
  selectedId,
  onSelectId,
  otherId,
  side,
  hoof,
  view,
  fieldDiff,
  statusEqual,
  statusLabel,
}: {
  variant: 'left' | 'right'
  title: string
  recordOptions: RecordOption[]
  selectedId: string
  onSelectId: (id: string) => void
  otherId: string
  side: CompareSidePayload
  hoof: HoofKey
  view: HoofCompareView
  fieldDiff: ReturnType<typeof diffHoofSides>
  statusEqual: boolean
  statusLabel: string
}) {
  const h = side.hoofState
  const docLabel =
    side.docNumber ?? `${side.recordId.replace(/-/g, '').slice(-4).toUpperCase()}`
  const overlayTitle = photoOverlayTitle(hoof, view)
  const slotKey = photoSlotKeyFromHoofView(hoof, view)

  const row = (label: string, value: string, diffKey: keyof typeof fieldDiff, tone: 'ok' | 'warn' | 'danger') => {
    const equal = fieldDiff[diffKey]
    return (
      <div
        className={[
          'flex justify-between gap-3 py-1.5 text-[12px]',
          !equal ? 'rounded-md bg-[#FDF6EC] px-2 -mx-2' : '',
        ].join(' ')}
      >
        <span className="text-[#9CA3AF]">{label}</span>
        <span className={`font-semibold ${toneClass[tone]}`}>{value}</span>
      </div>
    )
  }

  return (
    <div className="huf-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-6 py-[18px]">
        <span
          className={[
            'shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]',
            variant === 'left' ? 'bg-[rgba(59,130,246,0.06)] text-[#3B82F6]' : 'bg-[rgba(82,183,136,0.06)] text-[#52b788]',
          ].join(' ')}
        >
          {variant === 'left' ? 'Vorher' : 'Nachher'}
        </span>
        <span className="text-[14px] font-semibold text-[#1B1F23]">{title}</span>
      </div>

      <div className="flex items-center gap-2.5 border-b border-[#F0EEEA] px-6 py-3.5">
        <i className="bi bi-file-earmark-text-fill shrink-0 text-[16px] text-[#9CA3AF]" aria-hidden />
        <select
          className="min-w-0 flex-1 cursor-pointer appearance-none rounded-lg border-[1.5px] border-[#E5E2DC] bg-white py-2 pl-3 pr-9 text-[13px] font-medium text-[#1B1F23] focus:border-[#52b788] focus:outline-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
          }}
          value={selectedId}
          onChange={(e) => {
            const v = e.target.value
            if (v === otherId && recordOptions.length > 1) return
            onSelectId(v)
          }}
        >
          {recordOptions.map((o) => (
            <option key={o.id} value={o.id} disabled={o.id === otherId}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-h-[320px] justify-center bg-[#FAFAF8] px-6 py-5 lg:min-h-[480px]">
        {side.missingDoc ? (
          <div className="flex w-full max-w-[280px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E5E2DC] bg-white px-4 py-10 text-center">
            <i className="bi bi-file-earmark-x text-[32px] text-[#E5E2DC]" aria-hidden />
            <span className="text-[13px] font-medium text-[#9CA3AF]">Keine Dokumentation in der Cloud für diesen Eintrag.</span>
          </div>
        ) : !side.signedUrl ? (
          <div className="flex w-full max-w-[280px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E5E2DC] bg-white px-4 py-10 text-center">
            <i className="bi bi-image text-[32px] text-[#E5E2DC]" aria-hidden />
            <span className="text-[13px] font-medium leading-snug text-[#9CA3AF]">
              Kein Foto für {slotKey.replace('_', ' ')} in dieser Dokumentation.
            </span>
          </div>
        ) : (
          <div className="relative w-full max-w-[280px] overflow-hidden rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] aspect-[9/16]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={side.signedUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3.5 py-2.5 text-white">
              <div className="text-[12px] font-bold">{overlayTitle}</div>
              <div className="mt-0.5 text-[11px] opacity-80">
                {formatGermanDate(side.recordDate)} · {docLabel}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#F0EEEA] px-6 py-3.5">
        <div className="flex justify-between gap-3 py-1.5 text-[12px]">
          <span className="text-[#9CA3AF]">Datum</span>
          <span className="font-semibold text-[#1B1F23]">{formatGermanDate(side.recordDate)}</span>
        </div>
        <div className="flex justify-between gap-3 py-1.5 text-[12px]">
          <span className="text-[#9CA3AF]">Huf</span>
          <span className="font-semibold text-[#1B1F23]">{hoofLongLabel(hoof)}</span>
        </div>
        {row('Zehe', h.toe_alignment ?? '–', 'toe_alignment', hoofValueTone('toe', h.toe_alignment))}
        {row('Trachten', h.heel_balance ?? '–', 'heel_balance', hoofValueTone('heel', h.heel_balance))}
        {row('Strahl', h.frog_condition ?? '–', 'frog_condition', hoofValueTone('frog', h.frog_condition))}
        {row('Sohle', h.sole_condition ?? '–', 'sole_condition', hoofValueTone('sole', h.sole_condition))}
        <div
          className={[
            'flex justify-between gap-3 py-1.5 text-[12px]',
            !statusEqual ? 'rounded-md bg-[#FDF6EC] px-2 -mx-2' : '',
          ].join(' ')}
        >
          <span className="text-[#9CA3AF]">Status</span>
          <span className={`font-semibold ${toneClass[statusTone(singleHoofStatus(h))]}`}>{statusLabel}</span>
        </div>
      </div>
    </div>
  )
}
