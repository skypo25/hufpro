'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DirectoryOwnerAnalyticsDailyRow } from '@/lib/directory/stats/fetchDirectoryOwnerStatsSeries.server'

type Point = { dateIso: string; count: number }

export type DirectoryStatisticsInitial = {
  /** Legacy-Gesamtzähler (alle Zeiten), für Hinweis unter KPI Aufrufe. */
  profileViewsTotal: number
  contactInquiriesDaily: Point[]
  analyticsDaily: DirectoryOwnerAnalyticsDailyRow[]
}

const ACCENT = '#52b788'
const GRAY = '#E5E7EB'
const GRAY2 = '#D1D5DB'
const BLUE = '#3B82F6'
const ORANGE = '#F97316'
const PURPLE = '#8B5CF6'
const MUTED = '#9CA3AF'

const SOURCE_META: { field: keyof DirectoryOwnerAnalyticsDailyRow; label: string; color: string }[] = [
  { field: 'viewsDirectorySearch', label: 'Verzeichnis-Suche', color: ACCENT },
  { field: 'viewsSearchEngine', label: 'Google / Suchmaschine', color: BLUE },
  { field: 'viewsDirect', label: 'Direktaufruf (URL / Link)', color: PURPLE },
  { field: 'viewsSocial', label: 'Social Media', color: ORANGE },
  { field: 'viewsOther', label: 'Sonstige', color: MUTED },
]

function formatInt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('de-DE')
}

function fmtDayDe(iso: string): string {
  const [y, m, d] = iso.split('-').map((x) => Number(x))
  if (!y || !m || !d) return iso
  return `${d}.${m}.`
}

function lastNDaysKeysUtc(n: number, now = new Date()): string[] {
  const out: string[] = []
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - (n - 1))
  for (let i = 0; i < n; i++) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    out.push(`${y}-${m}-${day}`)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** Vorperiode: dieselbe Länge, direkt davor (endet am Tag vor dem aktuellen Fenster). */
function previousNDaysKeysUtc(n: number, now = new Date()): string[] {
  const out: string[] = []
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  end.setUTCDate(end.getUTCDate() - n)
  const d = new Date(end)
  d.setUTCDate(d.getUTCDate() - (n - 1))
  for (let i = 0; i < n; i++) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    out.push(`${y}-${m}-${day}`)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

function buildAnalyticsMap(rows: DirectoryOwnerAnalyticsDailyRow[]): Map<string, DirectoryOwnerAnalyticsDailyRow> {
  const m = new Map<string, DirectoryOwnerAnalyticsDailyRow>()
  for (const r of rows) m.set(r.dateIso, r)
  return m
}

function buildContactMap(points: Point[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of points) m.set(p.dateIso, Number(p.count) || 0)
  return m
}

function sumContactForKeys(contactMap: Map<string, number>, keys: string[]): number {
  return keys.reduce((s, k) => s + (contactMap.get(k) ?? 0), 0)
}

function sumAnalyticsField(
  analyticsMap: Map<string, DirectoryOwnerAnalyticsDailyRow>,
  keys: string[],
  field: keyof DirectoryOwnerAnalyticsDailyRow
): number {
  let s = 0
  for (const k of keys) {
    const row = analyticsMap.get(k)
    if (!row) continue
    s += Number(row[field] ?? 0) || 0
  }
  return s
}

function chunkAvg(arr: number[], size: number): number[] {
  const r: number[] = []
  for (let i = 0; i < arr.length; i += size) {
    const chunk = arr.slice(i, i + size)
    const avg = chunk.length ? chunk.reduce((a, b) => a + b, 0) / chunk.length : 0
    r.push(Math.round(avg * 10) / 10)
  }
  return r
}

function pctDelta(cur: number, prev: number): { text: string; cls: 'up' | 'down' | 'flat' } | null {
  if (cur <= 0 && prev <= 0) return null
  if (prev <= 0 && cur > 0) return { text: '+100%', cls: 'up' }
  const p = Math.round(((cur - prev) / prev) * 100)
  if (p === 0) return { text: '0%', cls: 'flat' }
  if (p > 0) return { text: `+${p}%`, cls: 'up' }
  return { text: `${p}%`, cls: 'down' }
}

function animateCount(el: HTMLElement, target: number, dur = 650) {
  const start = performance.now()
  const from = 0
  function tick(now: number) {
    const p = Math.min((now - start) / dur, 1)
    const ease = 1 - Math.pow(1 - p, 3)
    el.textContent = formatInt(from + (target - from) * ease)
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function drawSpark(canvas: HTMLCanvasElement, data: number[], color: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = 100
  const h = 48
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const pad = 4
  ctx.clearRect(0, 0, w, h)
  ctx.beginPath()
  data.forEach((v, i) => {
    const x = pad + (i * (w - 2 * pad)) / Math.max(1, data.length - 1)
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()

  ctx.lineTo(pad + ((data.length - 1) * (w - 2 * pad)) / Math.max(1, data.length - 1), h)
  ctx.lineTo(pad, h)
  ctx.closePath()
  ctx.fillStyle = color === ACCENT ? 'rgba(82,183,136,0.08)' : 'rgba(239,68,68,0.08)'
  ctx.fill()
}

function drawLineChart(
  canvas: HTMLCanvasElement,
  args: {
    data: number[]
    comp: number[]
    showCompare: boolean
    weekly: boolean
    xLabels?: string[]
  }
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.parentElement?.getBoundingClientRect()
  const W = Math.max(1, rect?.width ?? 640)
  const H = 260
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const pad = { t: 10, r: 16, b: 32, l: 40 }
  const data = args.weekly ? chunkAvg(args.data, 7) : args.data
  const comp = args.weekly ? chunkAvg(args.comp, 7) : args.comp
  const labels =
    args.xLabels && args.xLabels.length === data.length && !args.weekly
      ? args.xLabels.map(fmtDayDe)
      : args.weekly
        ? data.map((_, i) => `KW${i + 1}`)
        : data.map((_, i) => String(i + 1))
  const all = args.showCompare ? [...data, ...comp] : data
  const max = Math.max(...all, 1) * 1.15
  const cw = W - pad.l - pad.r
  const ch = H - pad.t - pad.b

  ctx.clearRect(0, 0, W, H)

  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * (1 - i / 4)
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(W - pad.r, y)
    ctx.strokeStyle = '#F3F4F6'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '10px DM Sans'
    ctx.textAlign = 'right'
    ctx.fillText(String(Math.round((max * i) / 4)), pad.l - 8, y + 3)
  }

  ctx.fillStyle = '#9CA3AF'
  ctx.font = '10px DM Sans'
  ctx.textAlign = 'center'
  const step = Math.max(1, Math.floor(labels.length / 8))
  labels.forEach((l, i) => {
    if (i % step !== 0) return
    const x = pad.l + (i * cw) / Math.max(1, labels.length - 1)
    ctx.fillText(l, x, H - 8)
  })

  const draw = (arr: number[], color: string, fill: boolean) => {
    ctx.beginPath()
    arr.forEach((v, i) => {
      const x = pad.l + (i * cw) / Math.max(1, arr.length - 1)
      const y = pad.t + ch * (1 - v / max)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    if (fill) {
      const lastI = arr.length - 1
      ctx.lineTo(pad.l + (lastI * cw) / Math.max(1, lastI), pad.t + ch)
      ctx.lineTo(pad.l, pad.t + ch)
      ctx.closePath()
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch)
      grad.addColorStop(0, 'rgba(82,183,136,0.18)')
      grad.addColorStop(1, 'rgba(82,183,136,0)')
      ctx.fillStyle = grad
      ctx.fill()
    }
    arr.forEach((v, i) => {
      const x = pad.l + (i * cw) / Math.max(1, arr.length - 1)
      const y = pad.t + ch * (1 - v / max)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    })
  }

  if (args.showCompare) draw(comp, GRAY2, false)
  draw(data, ACCENT, true)
}

function roundedBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  let rr = r
  if (h < rr * 2) rr = h / 2
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawBarChart(
  canvas: HTMLCanvasElement,
  args: { data: number[]; comp: number[]; showCompare: boolean; labels: string[] }
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.parentElement?.getBoundingClientRect()
  const W = Math.max(1, rect?.width ?? 420)
  const H = 260
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const pad = { t: 10, r: 16, b: 32, l: 36 }
  const all = args.showCompare ? [...args.data, ...args.comp] : args.data
  const max = Math.max(...all, 1) * 1.2
  const cw = W - pad.l - pad.r
  const ch = H - pad.t - pad.b
  const n = args.data.length
  const bw = args.showCompare ? (cw / n) * 0.35 : (cw / n) * 0.55
  const gap = (cw / n - bw * (args.showCompare ? 2 : 1)) / (args.showCompare ? 3 : 2)

  ctx.clearRect(0, 0, W, H)

  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * (1 - i / 4)
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(W - pad.r, y)
    ctx.strokeStyle = '#F3F4F6'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '10px DM Sans'
    ctx.textAlign = 'right'
    ctx.fillText(String(Math.round((max * i) / 4)), pad.l - 8, y + 3)
  }

  args.data.forEach((v, i) => {
    const groupX = pad.l + i * (cw / n)
    const barH = (v / max) * ch
    if (args.showCompare) {
      const cBarH = ((args.comp[i] ?? 0) / max) * ch
      roundedBar(ctx, groupX + gap, pad.t + ch - cBarH, bw, cBarH, 4, GRAY)
      roundedBar(ctx, groupX + gap + bw + 2, pad.t + ch - barH, bw, barH, 4, ACCENT)
    } else {
      const x = groupX + (cw / n - bw) / 2
      roundedBar(ctx, x, pad.t + ch - barH, bw, barH, 4, ACCENT)
    }
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '10px DM Sans'
    ctx.textAlign = 'center'
    ctx.fillText(args.labels[i] ?? '', groupX + cw / n / 2, H - 8)
  })
}

function seriesForKeys(
  keys: string[],
  get: (iso: string) => number
): number[] {
  return keys.map((k) => get(k))
}

export function DirectoryStatisticsPageClient({ initial }: { initial: DirectoryStatisticsInitial }) {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 365>(30)
  const [showCompare, setShowCompare] = useState(false)
  const [chartMode, setChartMode] = useState<'daily' | 'weekly'>('daily')

  const kpi1Ref = useRef<HTMLDivElement | null>(null)
  const kpi2Ref = useRef<HTMLDivElement | null>(null)
  const kpi3Ref = useRef<HTMLDivElement | null>(null)
  const kpi4Ref = useRef<HTMLDivElement | null>(null)

  const spark1Ref = useRef<HTMLCanvasElement | null>(null)
  const spark2Ref = useRef<HTMLCanvasElement | null>(null)
  const spark3Ref = useRef<HTMLCanvasElement | null>(null)
  const spark4Ref = useRef<HTMLCanvasElement | null>(null)
  const lineViewsRef = useRef<HTMLCanvasElement | null>(null)
  const barContactRef = useRef<HTMLCanvasElement | null>(null)

  const analyticsMap = useMemo(() => buildAnalyticsMap(initial.analyticsDaily), [initial.analyticsDaily])
  const contactMap = useMemo(() => buildContactMap(initial.contactInquiriesDaily), [initial.contactInquiriesDaily])

  const currentKeys = useMemo(() => lastNDaysKeysUtc(rangeDays), [rangeDays])
  const previousKeys = useMemo(() => previousNDaysKeysUtc(rangeDays), [rangeDays])

  const viewsSeries = useMemo(
    () => seriesForKeys(currentKeys, (iso) => sumAnalyticsField(analyticsMap, [iso], 'profileViews')),
    [analyticsMap, currentKeys]
  )
  const viewsPrevSeries = useMemo(
    () => seriesForKeys(previousKeys, (iso) => sumAnalyticsField(analyticsMap, [iso], 'profileViews')),
    [analyticsMap, previousKeys]
  )

  const contactSeries = useMemo(
    () => seriesForKeys(currentKeys, (iso) => contactMap.get(iso) ?? 0),
    [contactMap, currentKeys]
  )
  const contactPrevSeries = useMemo(
    () => seriesForKeys(previousKeys, (iso) => contactMap.get(iso) ?? 0),
    [contactMap, previousKeys]
  )

  const kpis = useMemo(() => {
    const views = sumAnalyticsField(analyticsMap, currentKeys, 'profileViews')
    const viewsPrev = sumAnalyticsField(analyticsMap, previousKeys, 'profileViews')
    const inquiries = sumContactForKeys(contactMap, currentKeys)
    const inquiriesPrev = sumContactForKeys(contactMap, previousKeys)
    const calls = sumAnalyticsField(analyticsMap, currentKeys, 'phoneClicks')
    const callsPrev = sumAnalyticsField(analyticsMap, previousKeys, 'phoneClicks')
    const shares = sumAnalyticsField(analyticsMap, currentKeys, 'shareClicks')
    const sharesPrev = sumAnalyticsField(analyticsMap, previousKeys, 'shareClicks')
    return {
      views,
      viewsPrev,
      inquiries,
      inquiriesPrev,
      calls,
      callsPrev,
      shares,
      sharesPrev,
    }
  }, [analyticsMap, contactMap, currentKeys, previousKeys])

  const sourceRows = useMemo(() => {
    const totalViews = SOURCE_META.reduce(
      (s, m) => s + sumAnalyticsField(analyticsMap, currentKeys, m.field),
      0
    )
    return SOURCE_META.map((m) => {
      const v = sumAnalyticsField(analyticsMap, currentKeys, m.field)
      const pct = totalViews > 0 ? Math.round((v / totalViews) * 100) : 0
      return { ...m, views: v, pct }
    })
  }, [analyticsMap, currentKeys])

  const lineViewsData = useMemo(() => {
    if (chartMode === 'weekly') {
      return {
        data: chunkAvg(viewsSeries, 7),
        comp: chunkAvg(viewsPrevSeries, 7),
        xLabels: undefined as string[] | undefined,
      }
    }
    return { data: viewsSeries, comp: viewsPrevSeries, xLabels: currentKeys }
  }, [chartMode, viewsSeries, viewsPrevSeries, currentKeys])

  const barContactData = useMemo(() => {
    if (chartMode === 'weekly') {
      return {
        data: chunkAvg(contactSeries, 7),
        comp: chunkAvg(contactPrevSeries, 7),
        labels: contactSeries.length ? chunkAvg(contactSeries, 7).map((_, i) => `KW${i + 1}`) : [],
      }
    }
    const n = Math.min(12, contactSeries.length)
    const slice = contactSeries.slice(-n)
    const compSlice = contactPrevSeries.slice(-n)
    const labelKeys = currentKeys.slice(-n)
    return {
      data: slice,
      comp: compSlice,
      labels: labelKeys.map(fmtDayDe),
    }
  }, [chartMode, contactSeries, contactPrevSeries, currentKeys])

  const redraw = useCallback(() => {
    const sp1 = viewsSeries.slice(-15)
    const sp2 = contactSeries.slice(-15)
    const sp3 = seriesForKeys(lastNDaysKeysUtc(15), (iso) => sumAnalyticsField(analyticsMap, [iso], 'phoneClicks'))
    const sp4 = seriesForKeys(lastNDaysKeysUtc(15), (iso) => sumAnalyticsField(analyticsMap, [iso], 'shareClicks'))
    if (spark1Ref.current) drawSpark(spark1Ref.current, sp1.length ? sp1 : [0], ACCENT)
    if (spark2Ref.current) drawSpark(spark2Ref.current, sp2.length ? sp2 : [0], ACCENT)
    if (spark3Ref.current) drawSpark(spark3Ref.current, sp3.length ? sp3 : [0], GRAY2)
    if (spark4Ref.current) drawSpark(spark4Ref.current, sp4.length ? sp4 : [0], '#EF4444')

    if (lineViewsRef.current) {
      drawLineChart(lineViewsRef.current, {
        data: lineViewsData.data,
        comp: showCompare ? lineViewsData.comp : [],
        showCompare,
        weekly: chartMode === 'weekly',
        xLabels: lineViewsData.xLabels,
      })
    }
    if (barContactRef.current && barContactData.data.length > 0) {
      drawBarChart(barContactRef.current, {
        data: barContactData.data,
        comp: showCompare ? barContactData.comp : [],
        showCompare,
        labels: barContactData.labels,
      })
    }
  }, [
    analyticsMap,
    barContactData,
    chartMode,
    contactSeries,
    lineViewsData,
    showCompare,
    viewsSeries,
  ])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (kpi1Ref.current) animateCount(kpi1Ref.current, kpis.views)
      if (kpi2Ref.current) animateCount(kpi2Ref.current, kpis.inquiries)
      if (kpi3Ref.current) animateCount(kpi3Ref.current, kpis.calls)
      if (kpi4Ref.current) animateCount(kpi4Ref.current, kpis.shares)
      redraw()
    }, 120)
    return () => window.clearTimeout(t)
  }, [kpis, redraw])

  useEffect(() => {
    const onResize = () => redraw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [redraw])

  const d1 = pctDelta(kpis.views, kpis.viewsPrev)
  const d2 = pctDelta(kpis.inquiries, kpis.inquiriesPrev)
  const d3 = pctDelta(kpis.calls, kpis.callsPrev)
  const d4 = pctDelta(kpis.shares, kpis.sharesPrev)

  return (
    <div className="dir-stats-page">
      <div className="dir-stats-hdr anim">
        <div>
          <h1>Statistik</h1>
          <div className="dir-stats-hdr-sub">Überblick über dein Profil im anidocs-Verzeichnis</div>
        </div>
        <div className="dir-stats-filters">
          {([7, 30, 90, 365] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`fbtn${rangeDays === d ? ' on' : ''}`}
              onClick={() => setRangeDays(d)}
            >
              {d === 365 ? '12 Monate' : `${d} Tage`}
            </button>
          ))}
          <button
            type="button"
            className={`compare-toggle${showCompare ? ' on' : ''}`}
            onClick={() => setShowCompare((v) => !v)}
          >
            <i className="bi bi-arrow-left-right" aria-hidden />
            Vergleichen
          </button>
        </div>
      </div>

      <div className="dir-stats-kpis">
        <div className="kpi anim anim-1">
          <div className="kpi-label">
            <i className="bi bi-eye-fill" aria-hidden /> Profilaufrufe
          </div>
          <div className="kpi-row">
            <div className="kpi-num" ref={kpi1Ref}>
              {formatInt(kpis.views)}
            </div>
            {d1 ? (
              <div className={`kpi-change ${d1.cls}`}>
                {d1.cls === 'up' ? <i className="bi bi-arrow-up-short" aria-hidden /> : null}
                {d1.cls === 'down' ? <i className="bi bi-arrow-down-short" aria-hidden /> : null}
                {d1.cls === 'flat' ? <i className="bi bi-dash" aria-hidden /> : null}
                {d1.text}
              </div>
            ) : (
              <div className="kpi-change flat">
                <i className="bi bi-dash" aria-hidden /> —
              </div>
            )}
          </div>
          <div className="kpi-sub">Im gewählten Zeitraum · Gesamt seit Start: {formatInt(initial.profileViewsTotal)}</div>
          <canvas className="kpi-spark" ref={spark1Ref} />
        </div>

        <div className="kpi anim anim-2">
          <div className="kpi-label">
            <i className="bi bi-envelope-fill" aria-hidden /> Kontaktanfragen
          </div>
          <div className="kpi-row">
            <div className="kpi-num" ref={kpi2Ref}>
              {formatInt(kpis.inquiries)}
            </div>
            {d2 ? (
              <div className={`kpi-change ${d2.cls}`}>
                {d2.cls === 'up' ? <i className="bi bi-arrow-up-short" aria-hidden /> : null}
                {d2.cls === 'down' ? <i className="bi bi-arrow-down-short" aria-hidden /> : null}
                {d2.cls === 'flat' ? <i className="bi bi-dash" aria-hidden /> : null}
                {d2.text}
              </div>
            ) : (
              <div className="kpi-change flat">
                <i className="bi bi-dash" aria-hidden /> —
              </div>
            )}
          </div>
          <div className="kpi-sub">Über das Kontaktformular · Zeitraum wie oben</div>
          <canvas className="kpi-spark" ref={spark2Ref} />
        </div>

        <div className="kpi anim anim-3">
          <div className="kpi-label">
            <i className="bi bi-telephone-fill" aria-hidden /> Anruf-Klicks
          </div>
          <div className="kpi-row">
            <div className="kpi-num" ref={kpi3Ref}>
              {formatInt(kpis.calls)}
            </div>
            {d3 ? (
              <div className={`kpi-change ${d3.cls}`}>
                {d3.cls === 'up' ? <i className="bi bi-arrow-up-short" aria-hidden /> : null}
                {d3.cls === 'down' ? <i className="bi bi-arrow-down-short" aria-hidden /> : null}
                {d3.cls === 'flat' ? <i className="bi bi-dash" aria-hidden /> : null}
                {d3.text}
              </div>
            ) : (
              <div className="kpi-change flat">
                <i className="bi bi-dash" aria-hidden /> —
              </div>
            )}
          </div>
          <div className="kpi-sub">Klick auf die öffentliche Telefonnummer</div>
          <canvas className="kpi-spark" ref={spark3Ref} />
        </div>

        <div className="kpi anim anim-4">
          <div className="kpi-label">
            <i className="bi bi-share-fill" aria-hidden /> Profil geteilt
          </div>
          <div className="kpi-row">
            <div className="kpi-num" ref={kpi4Ref}>
              {formatInt(kpis.shares)}
            </div>
            {d4 ? (
              <div className={`kpi-change ${d4.cls}`}>
                {d4.cls === 'up' ? <i className="bi bi-arrow-up-short" aria-hidden /> : null}
                {d4.cls === 'down' ? <i className="bi bi-arrow-down-short" aria-hidden /> : null}
                {d4.cls === 'flat' ? <i className="bi bi-dash" aria-hidden /> : null}
                {d4.text}
              </div>
            ) : (
              <div className="kpi-change flat">
                <i className="bi bi-dash" aria-hidden /> —
              </div>
            )}
          </div>
          <div className="kpi-sub">Nach erfolgreichem Teilen oder Kopieren des Links</div>
          <canvas className="kpi-spark" ref={spark4Ref} />
        </div>
      </div>

      <div className="dir-stats-charts">
        <div className="chart-card anim" style={{ animationDelay: '.25s' }}>
          <div className="chart-head">
            <div className="chart-title">
              <i className="bi bi-graph-up" aria-hidden /> Profilaufrufe
            </div>
            <div className="chart-tabs">
              <button type="button" className={`ctab${chartMode === 'daily' ? ' on' : ''}`} onClick={() => setChartMode('daily')}>
                Täglich
              </button>
              <button type="button" className={`ctab${chartMode === 'weekly' ? ' on' : ''}`} onClick={() => setChartMode('weekly')}>
                Wöchentlich
              </button>
            </div>
          </div>
          <div className="chart-area">
            <canvas ref={lineViewsRef} />
          </div>
          <div className="legend">
            <div className="leg">
              <span className="leg-dot" style={{ background: 'var(--accent)' }} />
              Aktueller Zeitraum
            </div>
            <div className="leg" style={{ display: showCompare ? 'flex' : 'none' }}>
              <span className="leg-dot" style={{ background: 'var(--bd)' }} />
              Vorperiode
            </div>
          </div>
        </div>

        <div className="chart-card anim" style={{ animationDelay: '.3s' }}>
          <div className="chart-head">
            <div className="chart-title">
              <i className="bi bi-bar-chart-fill" aria-hidden /> Kontaktanfragen
            </div>
          </div>
          <div className="chart-area">
            <canvas ref={barContactRef} />
          </div>
          <div className="legend">
            <div className="leg">
              <span className="leg-dot" style={{ background: 'var(--accent)' }} />
              Anfragen
            </div>
            <div className="leg" style={{ display: showCompare ? 'flex' : 'none' }}>
              <span className="leg-dot" style={{ background: 'var(--bd)' }} />
              Vorperiode
            </div>
          </div>
        </div>
      </div>

      <div className="tbl-card anim" style={{ animationDelay: '.35s' }}>
        <div className="chart-head">
          <div className="chart-title">
            <i className="bi bi-list-ul" aria-hidden /> Aufrufe nach Quelle
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Quelle</th>
              <th>Aufrufe</th>
              <th>Anteil</th>
              <th aria-label="Verteilung" />
            </tr>
          </thead>
          <tbody>
            {sourceRows.map((row) => (
              <tr key={row.field}>
                <td>{row.label}</td>
                <td className="tbl-num">{formatInt(row.views)}</td>
                <td>{row.pct}%</td>
                <td>
                  <div className="tbl-bar">
                    <div
                      className="tbl-fill"
                      style={{ width: `${row.pct}%`, background: row.color, transition: 'width 0.8s ease' }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dir-stats-note mt-4 text-[12px] leading-snug">
          Quellen werden aus dem Referrer beim ersten Seitenaufruf je Sitzung zugeordnet (z. B. Suche, Social, direkt).
          Kontaktanfragen stammen aus <code>directory_contact_inquiries</code>.
        </div>
      </div>
    </div>
  )
}
