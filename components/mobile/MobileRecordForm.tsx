'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { createRecord, updateRecord } from '@/app/(app)/horses/[id]/records/actions'
import { uploadProcessedPhoto, saveAnnotationsForExistingPhoto } from '@/components/photos/usePhotoUpload'
import { processHoofImage } from '@/components/photos/imageProcessing'
import { SLOT_SOLAR, SLOT_LATERAL, SLOT_LABELS, toCanonicalPhotoSlot, type PhotoSlotKey } from '@/lib/photos/photoTypes'
import type { AnnotationsData } from '@/lib/photos/annotations'
import { parseAnnotationsJson, DEFAULT_ANNOTATIONS } from '@/lib/photos/annotations'
import MinimalRichEditor from '@/components/records/MinimalRichEditor'
import VoiceRecorder from '@/components/VoiceRecorder'
import ImproveTextButton from '@/components/ImproveTextButton'
import { processVoiceCommand, applyVoiceCommand } from '@/lib/voiceCommands'
import MobileCameraCapture from '@/components/mobile/MobileCameraCapture'
import PhotoAnnotator from '@/components/photos/PhotoAnnotator'

// ─── HTML helpers ────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function wrapAsHtml(text: string): string {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (!paras.length) return ''
  return paras.map((p) => `<p>${p}</p>`).join('')
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  customers?: { name: string | null; stable_name: string | null } | null
}

type HoofState = {
  toe_alignment: string
  heel_balance: string
  frog_condition: string
  sole_condition: string
}

type StagedPhoto = {
  slot: PhotoSlotKey
  blob: Blob
  width: number
  height: number
  previewUrl: string
}

type ExistingPhoto = {
  id: string
  file_path: string
  photo_type: string
  annotations_json?: unknown
  width?: number | null
  height?: number | null
}

type Mode = 'create' | 'edit'

const HOOF_STD: HoofState = {
  toe_alignment: 'gerade',
  heel_balance: 'normal',
  frog_condition: 'gesund',
  sole_condition: 'stabil',
}

const HOOF_EMPTY: HoofState = {
  toe_alignment: '',
  heel_balance: '',
  frog_condition: '',
  sole_condition: '',
}

const HOOF_KEYS = ['vl', 'vr', 'hl', 'hr'] as const
type HoofKey = typeof HOOF_KEYS[number]
const HOOF_LABELS: Record<HoofKey, string> = { vl: 'VL — Vorne Links', vr: 'VR — Vorne Rechts', hl: 'HL — Hinten Links', hr: 'HR — Hinten Rechts' }

// Slot-Keys aus photoTypes – müssen mit Desktop/Detail übereinstimmen (VL_solar, VL_lateral, …)

function hoofStatus(h: HoofState): 'ok' | 'warn' | 'critical' | 'empty' {
  const isEmpty = !h.toe_alignment && !h.heel_balance && !h.frog_condition && !h.sole_condition
  if (isEmpty) return 'empty'
  if (h.frog_condition === 'faulig') return 'critical'
  const isStd =
    (h.toe_alignment === HOOF_STD.toe_alignment || h.toe_alignment === '') &&
    (h.heel_balance === 'normal' || h.heel_balance === 'ausgeglichen' || h.heel_balance === '') &&
    (h.frog_condition === HOOF_STD.frog_condition || h.frog_condition === '') &&
    (h.sole_condition === HOOF_STD.sole_condition || h.sole_condition === '')
  return isStd ? 'ok' : 'warn'
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function HorseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 576 512" fill="currentColor" aria-hidden>
      <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
    </svg>
  )
}

// ─── Hoof Accordion Item ──────────────────────────────────────────────────────

function HoofAccordionItem({
  label, state, onChange,
}: {
  label: string
  state: HoofState
  onChange: (next: Partial<HoofState>) => void
}) {
  const [open, setOpen] = useState(false)
  const st = hoofStatus(state)
  const badgeCls = st === 'critical' ? 'ha-badge crit' : st === 'warn' ? 'ha-badge warn' : st === 'empty' ? 'ha-badge empty' : 'ha-badge ok'
  const badgeTxt = st === 'critical' ? 'Problematisch' : st === 'warn' ? 'Abweichung' : st === 'empty' ? 'Keine Angabe' : 'Unauffällig'
  const dotCls = st === 'critical' ? 'ha-dot crit' : st === 'warn' ? 'ha-dot warn' : st === 'empty' ? 'ha-dot empty' : 'ha-dot ok'

  function mini(field: keyof HoofState, value: string, isDefault: boolean) {
    const active = state[field] === value
    const cls = active
      ? (isDefault ? 'hc-mini on-default' : field === 'frog_condition' && value === 'faulig' ? 'hc-mini on-critical' : 'hc-mini on-deviation')
      : 'hc-mini'
    return (
      <button key={value} type="button" className={cls} onClick={() => onChange({ [field]: value })}>
        {value}
      </button>
    )
  }

  return (
    <div className={`ha-item${open ? ' open' : ''}${st !== 'ok' ? ' has-deviation' : ''}`}>
      <div className="ha-header" onClick={() => setOpen(!open)}>
        <span className={dotCls} />
        <span className="ha-title">{label}</span>
        <span className={badgeCls}>{badgeTxt}</span>
        <svg className="ha-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div className="ha-body">
        <div className="hc-field">
          <span className="hc-field-label">Zehe</span>
          <div className="hc-field-chips">
            {mini('toe_alignment', 'gerade', true)}
            {mini('toe_alignment', 'medial', false)}
            {mini('toe_alignment', 'lateral', false)}
          </div>
        </div>
        <div className="hc-field">
          <span className="hc-field-label">Trachten</span>
          <div className="hc-field-chips">
            {mini('heel_balance', 'normal', true)}
            {mini('heel_balance', 'untergeschoben', false)}
            {mini('heel_balance', 'ungleich', false)}
          </div>
        </div>
        <div className="hc-field">
          <span className="hc-field-label">Strahl</span>
          <div className="hc-field-chips">
            {mini('frog_condition', 'gesund', true)}
            {mini('frog_condition', 'faulig', false)}
          </div>
        </div>
        <div className="hc-field">
          <span className="hc-field-label">Sohle</span>
          <div className="hc-field-chips">
            {mini('sole_condition', 'stabil', true)}
            {mini('sole_condition', 'dünn', false)}
          </div>
        </div>
        <p className="speed-hint">Nur Abweichungen antippen — Standard ist bereits gesetzt</p>
      </div>
    </div>
  )
}

// ─── Photo Slot ───────────────────────────────────────────────────────────────

function MobilePhotoSlot({
  slot, label, signedUrl, staged, uploading,
  annotations, onAnnotationsChange,
  onFileSelect,
}: {
  slot: PhotoSlotKey
  label: string
  signedUrl?: string | null
  staged?: StagedPhoto | null
  uploading?: boolean
  annotations?: AnnotationsData
  onAnnotationsChange?: (a: AnnotationsData) => void
  onFileSelect: (slot: PhotoSlotKey, file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [annotatorOpen, setAnnotatorOpen] = useState(false)
  const displayUrl = staged?.previewUrl ?? signedUrl ?? null
  const hasPhoto = !!displayUrl
  const imgWidth = staged?.width ?? 900
  const imgHeight = staged?.height ?? 1600

  function handleTap() {
    if (uploading) return
    setCameraOpen(true)
  }

  function handleCameraFallback() {
    setCameraOpen(false)
    inputRef.current?.click()
  }

  return (
    <>
      <div className={`photo-slot${hasPhoto ? ' has-photo' : ''}`}>
        {/* Fallback native input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFileSelect(slot, f)
            e.target.value = ''
          }}
        />
        {uploading ? (
          <span className="ps-label" style={{ fontSize: 9 }}>Lädt…</span>
        ) : hasPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl!} alt={label} className="absolute inset-0 h-full w-full object-cover" style={{ borderRadius: 6 }} />
            {/* Annotation overlay preview */}
            {annotations && annotations.items.length > 0 && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${imgWidth} ${imgHeight}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {annotations.items.map((item, idx) => {
                  if ((item.type === 'line' || item.type === 'axis') && item.points?.length >= 2) {
                    const [a, b] = item.points
                    return <line key={idx} x1={a.x * imgWidth} y1={a.y * imgHeight} x2={b.x * imgWidth} y2={b.y * imgHeight} stroke="#fff" strokeWidth={3} />
                  }
                  if (item.type === 'stroke' && item.points?.length >= 2) {
                    const d = item.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * imgWidth} ${p.y * imgHeight}`).join(' ')
                    return <path key={idx} d={d} fill="none" stroke={item.color ?? '#fff'} strokeWidth={3} strokeLinecap="round" />
                  }
                  return null
                })}
              </svg>
            )}
            <span className="ps-badge">✓</span>
            <span className="ps-label" style={{ position: 'relative', zIndex: 1 }}>{label}</span>
            {/* Action buttons: re-take + annotate */}
            <div className="ps-actions">
              <button type="button" className="ps-action-btn" onClick={() => handleTap()} title="Neu aufnehmen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
                  <path strokeLinecap="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </button>
              <button type="button" className={`ps-action-btn${annotations && annotations.items.length > 0 ? ' active' : ''}`} onClick={() => setAnnotatorOpen(true)} title="Markierungen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" onClick={handleTap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 18, height: 18 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="ps-label">{label}</span>
            <span className="ps-sub">Antippen</span>
          </div>
        )}
      </div>

      {cameraOpen && (
        <MobileCameraCapture
          label={label}
          onCapture={(file) => {
            setCameraOpen(false)
            onFileSelect(slot, file)
          }}
          onClose={() => setCameraOpen(false)}
          onFallback={handleCameraFallback}
        />
      )}

      {annotatorOpen && displayUrl && (
        <div className="mcc-overlay" style={{ zIndex: 10000 }}>
          <div className="mcc-container" style={{ flexDirection: 'column', background: '#111' }}>
            {/* Header */}
            <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 10px)', left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
              <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{label} – Markierungen</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { onAnnotationsChange?.({ ...DEFAULT_ANNOTATIONS }); setAnnotatorOpen(false) }}
                  style={{ background: 'rgba(220,38,38,0.8)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                >
                  Löschen
                </button>
                <button
                  type="button"
                  onClick={() => setAnnotatorOpen(false)}
                  style={{ background: 'rgba(21,66,38,0.9)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}
                >
                  Fertig
                </button>
              </div>
            </div>
            {/* Annotator */}
            <div style={{ position: 'absolute', inset: 0, paddingTop: 'calc(env(safe-area-inset-top,0px) + 52px)', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 64px)' }}>
              <PhotoAnnotator
                imageUrl={displayUrl}
                width={imgWidth}
                height={imgHeight}
                annotations={annotations ?? DEFAULT_ANNOTATIONS}
                onChange={(a) => onAnnotationsChange?.(a)}
                showToolbar
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Chip helpers ─────────────────────────────────────────────────────────────

const GC_COLORS: Record<string, string> = {
  unauffällig: 'sel-green', auffällig: 'sel-red',
  taktrein: 'sel-green', 'leicht ungleichmäßig': 'sel-yellow', lahm: 'sel-red',
  kooperativ: 'sel-green', unruhig: 'sel-yellow', widersetzlich: 'sel-red',
  stabil: 'sel-green', mittel: 'sel-yellow', brüchig: 'sel-yellow', weich: 'sel-yellow',
}

function GeneralChips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ae-chips">
      {options.map((o) => {
        const color = GC_COLORS[o.toLowerCase()] ?? 'sel-green'
        const active = value.toLowerCase() === o.toLowerCase()
        return (
          <span
            key={o}
            className={`chip${active ? ` ${color}` : ''}`}
            onClick={() => onChange(active ? '' : o)}
          >
            {o}
          </span>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = {
  horseId: string
  recordId?: string
  mode?: Mode
}

export default function MobileRecordForm({ horseId, recordId, mode = 'create' }: Props) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  // ── Horse data ──
  const [horse, setHorse] = useState<Horse | null>(null)
  const [prevRecordDate, setPrevRecordDate] = useState<string | null>(null)

  // ── Form state ──
  const today = new Date().toISOString().slice(0, 10)
  const [recordDate, setRecordDate] = useState(today)
  const [generalCondition, setGeneralCondition] = useState('')
  const [gait, setGait] = useState('')
  const [handlingBehavior, setHandlingBehavior] = useState('')
  const [hornQuality, setHornQuality] = useState('')
  const [summaryText, setSummaryText] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  const [hoofs, setHoofs] = useState<Record<HoofKey, HoofState>>({
    vl: { ...HOOF_EMPTY }, vr: { ...HOOF_EMPTY }, hl: { ...HOOF_EMPTY }, hr: { ...HOOF_EMPTY },
  })

  // ── Photos ──
  const [stagedPhotos, setStagedPhotos] = useState<Partial<Record<PhotoSlotKey, StagedPhoto>>>({})
  const stagedPhotosRef = useRef(stagedPhotos)
  stagedPhotosRef.current = stagedPhotos
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [uploadingSlot, setUploadingSlot] = useState<PhotoSlotKey | null>(null)
  const [annotationsBySlot, setAnnotationsBySlot] = useState<Partial<Record<PhotoSlotKey, AnnotationsData>>>({})

  // ── UI ──
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [progressOpen, setProgressOpen] = useState(true)
  const [photoOpen, setPhotoOpen] = useState(false)
  const actionRowRef = useRef<HTMLDivElement>(null)

  // ── Load horse + existing record ──
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: h } = await supabase
        .from('horses')
        .select('id, name, breed, sex, birth_year, customers(name, stable_name)')
        .eq('id', horseId)
        .eq('user_id', user.id)
        .single()
      if (h) setHorse(h as Horse)

      // Previous record date
      const { data: prev } = await supabase
        .from('hoof_records')
        .select('record_date')
        .eq('horse_id', horseId)
        .eq('user_id', user.id)
        .order('record_date', { ascending: false })
        .limit(isEdit ? 2 : 1)
      const prevRow = isEdit ? prev?.[1] : prev?.[0]
      if (prevRow?.record_date) setPrevRecordDate(prevRow.record_date)

      if (isEdit && recordId) {
        // Load existing record
        const { data: rec } = await supabase
          .from('hoof_records')
          .select('record_date, hoof_condition, general_condition, gait, handling_behavior, horn_quality, hoofs_json, notes')
          .eq('id', recordId)
          .eq('user_id', user.id)
          .single()
        if (rec) {
          if (rec.record_date) setRecordDate(rec.record_date.slice(0, 10))
          if (rec.hoof_condition) setSummaryText(rec.hoof_condition)
          if (rec.general_condition) setGeneralCondition(rec.general_condition)
          if (rec.gait) setGait(rec.gait)
          if (rec.handling_behavior) setHandlingBehavior(rec.handling_behavior)
          if (rec.horn_quality) setHornQuality(rec.horn_quality)
          if (rec.notes) setInternalNotes(rec.notes)
          if (rec.hoofs_json && Array.isArray(rec.hoofs_json)) {
            const next: Record<HoofKey, HoofState> = { vl: { ...HOOF_EMPTY }, vr: { ...HOOF_EMPTY }, hl: { ...HOOF_EMPTY }, hr: { ...HOOF_EMPTY } }
            for (const h of rec.hoofs_json as { hoof_position?: string; toe_alignment?: string; heel_balance?: string; frog_condition?: string; sole_condition?: string }[]) {
              const k = h.hoof_position as HoofKey
              if (HOOF_KEYS.includes(k)) {
                next[k] = {
                  toe_alignment: h.toe_alignment ?? '',
                  heel_balance: h.heel_balance ?? '',
                  frog_condition: h.frog_condition ?? '',
                  sole_condition: h.sole_condition ?? '',
                }
              }
            }
            setHoofs(next)
          }
        }

        // Load photos
        const { data: photos } = await supabase
          .from('hoof_photos')
          .select('id, file_path, photo_type, annotations_json, width, height')
          .eq('hoof_record_id', recordId)
          .eq('user_id', user.id)
        if (photos?.length) {
          setExistingPhotos(photos as ExistingPhoto[])
          const urls: Record<string, string> = {}
          const loadedAnnotations: Partial<Record<PhotoSlotKey, AnnotationsData>> = {}
          for (const p of photos) {
            if (!p.file_path || !p.photo_type) continue
            const slot = toCanonicalPhotoSlot(p.photo_type)
            if (!slot) continue
            const { data: s } = await supabase.storage.from('hoof-photos').createSignedUrl(p.file_path, 3600)
            if (s?.signedUrl) urls[slot] = s.signedUrl
            if (p.annotations_json) loadedAnnotations[slot] = parseAnnotationsJson(p.annotations_json)
          }
          setPhotoUrls(urls)
          if (Object.keys(loadedAnnotations).length > 0) {
            setAnnotationsBySlot(loadedAnnotations)
          }
        }
      }
    }
    load()
  }, [horseId, recordId, isEdit, router])

  // ── Computed hoof status ──
  const overallStatus = useMemo(() => {
    const statuses = HOOF_KEYS.map((k) => hoofStatus(hoofs[k]))
    if (statuses.includes('empty')) return 'empty'
    if (statuses.includes('critical')) return 'critical'
    if (statuses.includes('warn')) return 'warn'
    return 'ok'
  }, [hoofs])

  const allDefault = useMemo(() =>
    HOOF_KEYS.every((k) => hoofStatus(hoofs[k]) === 'ok'), [hoofs])

  // ── Photo upload ──
  const handlePhotoSelect = useCallback(async (slot: PhotoSlotKey, file: File) => {
    setUploadingSlot(slot)
    setError('')
    try {
      const result = await processHoofImage(file)
      const previewUrl = URL.createObjectURL(result.blob)
      setStagedPhotos((prev) => ({
        ...prev,
        [slot]: { slot, blob: result.blob, width: result.width, height: result.height, previewUrl },
      }))
    } catch (e) {
      // Fallback: Original-Datei ohne Verarbeitung (z.B. wenn processHoofImage auf manchen Mobilgeräten scheitert)
      try {
        const url = URL.createObjectURL(file)
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image()
          i.onload = () => resolve(i)
          i.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
          i.src = url
        })
        URL.revokeObjectURL(url)
        const blob = file
        const previewUrl = URL.createObjectURL(blob)
        setStagedPhotos((prev) => ({
          ...prev,
          [slot]: { slot, blob, width: img.naturalWidth, height: img.naturalHeight, previewUrl },
        }))
      } catch (fallbackErr) {
        // Letzter Fallback: Datei ohne Maße (Upload funktioniert trotzdem)
        try {
          const blob = file.size > 0 ? file : await file.arrayBuffer().then((ab) => new Blob([ab], { type: file.type || 'image/jpeg' }))
          const previewUrl = URL.createObjectURL(blob)
          setStagedPhotos((prev) => ({
            ...prev,
            [slot]: { slot, blob, width: 1080, height: 1920, previewUrl },
          }))
        } catch (lastErr) {
          console.error('Foto-Verarbeitung fehlgeschlagen:', e, fallbackErr, lastErr)
          setError('Bild konnte nicht verarbeitet werden. Bitte erneut aufnehmen oder anderes Foto wählen.')
        }
      }
    } finally {
      setUploadingSlot(null)
    }
  }, [])

  // ── Submit ──
  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const hoofsJson = HOOF_KEYS.map((k) => ({ hoof_position: k, ...hoofs[k] }))
      const fd = new FormData()
      fd.set('horse_id', horseId)
      fd.set('record_date', recordDate)
      fd.set('summary_notes', summaryText)
      fd.set('recommendation_notes', '')
      fd.set('general_condition', generalCondition)
      fd.set('gait', gait)
      fd.set('handling_behavior', handlingBehavior)
      fd.set('horn_quality', hornQuality)
      fd.set('hoofs_json', JSON.stringify(hoofsJson))
      if (internalNotes) fd.set('notes', internalNotes)

      let targetRecordId: string

      if (isEdit && recordId) {
        await updateRecord(horseId, recordId, fd)
        targetRecordId = recordId
      } else {
        const result = await createRecord(fd)
        if (result && 'error' in result) { setError(result.error); return }
        targetRecordId = result.recordId
      }

      // Upload staged photos (Ref für aktuellste Fotos, falls Nutzer schnell speichert)
      const staged = Object.entries(stagedPhotosRef.current) as [PhotoSlotKey, StagedPhoto][]
      const stagedSlots = new Set<PhotoSlotKey>()
      for (const [slot, photo] of staged) {
        if (!photo) continue
        stagedSlots.add(slot)
        await uploadProcessedPhoto({
          recordId: targetRecordId,
          horseId,
          slot,
          blob: photo.blob,
          width: photo.width,
          height: photo.height,
          annotationsJson: annotationsBySlot[slot],
        })
      }

      // Save annotations for existing photos
      for (const [slot, annotations] of Object.entries(annotationsBySlot) as [PhotoSlotKey, AnnotationsData][]) {
        if (stagedSlots.has(slot)) continue
        await saveAnnotationsForExistingPhoto({ recordId: targetRecordId, slot, annotationsJson: annotations })
      }

      // Warten, damit Storage und DB nach Foto-Upload bereit sind (Detail-Anzeige lädt sonst evtl. zu früh)
      if (staged.length > 0) {
        await new Promise((r) => setTimeout(r, 1200))
      }
      router.refresh()
      router.push(`/horses/${horseId}/records/${targetRecordId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setSubmitting(false)
    }
  }

  const horseName = horse?.name ?? '…'
  const horseMeta = [
    horse?.breed,
    horse?.sex,
    horse?.birth_year ? `${new Date().getFullYear() - horse.birth_year} J.` : null,
    (Array.isArray(horse?.customers) ? horse?.customers[0] : horse?.customers)?.name,
  ].filter(Boolean).join(' · ')

  // Progress steps
  const gcDone = !!(generalCondition || gait || handlingBehavior || hornQuality)
  const hoofDone = HOOF_KEYS.every((k) => hoofStatus(hoofs[k]) !== 'empty')
  const photoDone = Object.keys(stagedPhotos).length > 0 || existingPhotos.length > 0
  const summaryDone = !!summaryText.trim()
  const steps = [
    { label: 'Allgemeiner Eindruck', done: gcDone },
    { label: 'Hufbefund pro Huf', done: hoofDone },
    { label: 'Fotos aufnehmen', done: photoDone },
    { label: 'Maßnahmen & Beobachtungen', done: summaryDone },
  ]
  const currentStep = steps.findIndex((s) => !s.done)

  return (
    <div className="mobile-record-form">
      {/* HEADER – normal scrollend */}
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="cd-hero">
          <div className="cd-info min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="cd-name">{horseName}</div>
              <span className="mrf-draft-badge">
                <span className="mrf-draft-dot" />
                Entwurf
              </span>
            </div>
            <div className="cd-meta">
              {horseMeta && <span>{horseMeta}</span>}
            </div>
          </div>
        </div>
      </header>

      {/* ACTION ROW – wie Erstellungsseite */}
      <div ref={actionRowRef} className="cd-action-row flex gap-2">
        <button
          type="button"
          className="cd-action-btn flex flex-1 items-center justify-center gap-1.5"
          onClick={() => router.back()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={15} height={15}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Abbrechen
        </button>
        <button
          type="button"
          className="cd-action-btn primary flex flex-1 items-center justify-center gap-1.5"
          disabled={submitting}
          onClick={handleSubmit}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={15} height={15}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {submitting ? 'Wird gespeichert…' : 'Speichern'}
        </button>
      </div>

      {/* CONTEXT STRIP */}
      <div className="mrf-ctx-strip">
        <div className="mrf-ctx-item">
          <div className="mrf-ctx-label">Datum</div>
          <div className="mrf-ctx-value">
            <input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="mrf-date-input"
            />
          </div>
        </div>
        <div className="mrf-ctx-item">
          <div className="mrf-ctx-label">Terminart</div>
          <div className="mrf-ctx-value mrf-ctx-accent">Regeltermin</div>
        </div>
        <div className="mrf-ctx-item">
          <div className="mrf-ctx-label">Letzter Termin</div>
          <div className="mrf-ctx-value">{formatDate(prevRecordDate)}</div>
        </div>
      </div>

      <div className="mrf-content">

        {/* FORTSCHRITT */}
        <div className="mrf-card">
          <div className="mrf-progress-header" onClick={() => setProgressOpen(!progressOpen)}>
            <span className="mrf-card-title">Fortschritt</span>
            <svg style={{ transform: progressOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {progressOpen && (
            <div className="mrf-progress-body">
              {steps.map((s, i) => {
                const isCurrent = i === currentStep
                return (
                  <div key={s.label} className="mrf-p-step">
                    <div className={`mrf-p-dot${s.done ? ' done' : isCurrent ? ' current' : ''}`}>
                      {s.done ? <i className="bi bi-check" /> : i + 1}
                    </div>
                    <span className={`mrf-p-title${s.done ? ' done' : ''}`}>{s.label}</span>
                  </div>
                )
              })}
              {prevRecordDate && (
                <div className="mrf-last-befund">
                  <strong>Letzter Befund · {formatDate(prevRecordDate)}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 1. ALLGEMEINER EINDRUCK */}
        <div className="mrf-card">
          <div className="mrf-s-header">
            <div className="mrf-s-title">
              <span className="mrf-s-icon"><i className="bi bi-eye-fill" /></span>
              Allgemeiner Eindruck
            </div>
            <span className="mrf-s-hint">~30 Sek.</span>
          </div>
          <div className="mrf-s-body">
            <div className="mrf-ae-row">
              <span className="mrf-ae-label">Allgemeinzustand</span>
              <GeneralChips options={['Unauffällig', 'Auffällig']} value={generalCondition} onChange={setGeneralCondition} />
            </div>
            <div className="mrf-ae-row">
              <span className="mrf-ae-label">Gangbild</span>
              <GeneralChips options={['Taktrein', 'Leicht ungleichmäßig', 'Lahm']} value={gait} onChange={setGait} />
            </div>
            <div className="mrf-ae-row">
              <span className="mrf-ae-label">Verhalten</span>
              <GeneralChips options={['Kooperativ', 'Unruhig', 'Widersetzlich']} value={handlingBehavior} onChange={setHandlingBehavior} />
            </div>
            <div className="mrf-ae-row" style={{ borderBottom: 'none' }}>
              <span className="mrf-ae-label">Hornqualität</span>
              <GeneralChips options={['Stabil', 'Mittel', 'Brüchig', 'Weich']} value={hornQuality} onChange={setHornQuality} />
            </div>
          </div>
        </div>

        {/* 2. HUFBEFUND */}
        <div className="mrf-card">
          <div className="mrf-s-header">
            <div className="mrf-s-title">
              <span className="mrf-s-icon"><i className="bi bi-search" /></span>
              Hufbefund pro Huf
            </div>
            <span className="mrf-s-hint">Nur Abweichungen</span>
          </div>
          <div className="mrf-s-body">
            {/* Reset button */}
            <button
              type="button"
              className={`reset-btn${allDefault ? ' active' : ''}`}
              onClick={() => setHoofs({ vl: { ...HOOF_STD }, vr: { ...HOOF_STD }, hl: { ...HOOF_STD }, hr: { ...HOOF_STD } })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={18} height={18}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Alle Hufe unauffällig
            </button>

            {/* Auto status */}
            <div className={`auto-status ${overallStatus === 'critical' ? 'red' : overallStatus === 'warn' ? 'yellow' : overallStatus === 'empty' ? 'gray' : 'green'}`}>
              <span className="as-dot" />
              <span>
                {overallStatus === 'critical' ? 'Problematisch' : overallStatus === 'warn' ? 'Behandlungsbedürftig' : overallStatus === 'empty' ? 'Noch nicht erfasst' : 'Unauffällig'}
              </span>
              {overallStatus !== 'empty' && <span className="as-hint">· Automatisch erkannt</span>}
            </div>

            {/* Accordion */}
            <div className="hoof-accordion">
              {HOOF_KEYS.map((k) => (
                <HoofAccordionItem
                  key={k}
                  label={HOOF_LABELS[k]}
                  state={hoofs[k]}
                  onChange={(next) => setHoofs((prev) => ({ ...prev, [k]: { ...prev[k], ...next } }))}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 3. FOTOS – ausklappbar */}
        {(() => {
          const totalPhotos = [...SLOT_SOLAR, ...SLOT_LATERAL].filter(s => stagedPhotos[s] || photoUrls[s]).length
          return (
            <div className="mrf-card">
              <div className="mrf-s-header" style={{ cursor: 'pointer' }} onClick={() => setPhotoOpen(o => !o)}>
                <div className="mrf-s-title">
                  <span className="mrf-s-icon"><i className="bi bi-camera-fill" /></span>
                  Fotos aufnehmen
                  {totalPhotos > 0 && (
                    <span className="mrf-photo-count">{totalPhotos} / 8</span>
                  )}
                </div>
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}
                  style={{ color: '#9CA3AF', flexShrink: 0, transition: 'transform .2s', transform: photoOpen ? 'rotate(180deg)' : 'none' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {photoOpen && (
                <div className="mrf-s-body">
                  <div className="photo-label">Sohlenansicht (Solar)</div>
                  <div className="photo-grid">
                    {SLOT_SOLAR.map((slot) => (
                      <MobilePhotoSlot
                        key={slot} slot={slot} label={SLOT_LABELS[slot]}
                        signedUrl={photoUrls[slot]}
                        staged={stagedPhotos[slot]}
                        uploading={uploadingSlot === slot}
                        annotations={annotationsBySlot[slot]}
                        onAnnotationsChange={(a) => setAnnotationsBySlot(prev => ({ ...prev, [slot]: a }))}
                        onFileSelect={handlePhotoSelect}
                      />
                    ))}
                  </div>
                  <div className="photo-label">Seitenansicht (Lateral)</div>
                  <div className="photo-grid">
                    {SLOT_LATERAL.map((slot) => (
                      <MobilePhotoSlot
                        key={slot} slot={slot} label={SLOT_LABELS[slot]}
                        signedUrl={photoUrls[slot]}
                        staged={stagedPhotos[slot]}
                        uploading={uploadingSlot === slot}
                        annotations={annotationsBySlot[slot]}
                        onAnnotationsChange={(a) => setAnnotationsBySlot(prev => ({ ...prev, [slot]: a }))}
                        onFileSelect={handlePhotoSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* 4. MAßNAHMEN */}
        <div className="mrf-card">
          <div className="mrf-s-header">
            <div className="mrf-s-title">
              <span className="mrf-s-icon"><i className="bi bi-file-earmark-richtext-fill" /></span>
              Maßnahmen &amp; Beobachtungen
            </div>
            <span className="mrf-s-hint">Text, Diktat oder KI</span>
          </div>
          <div className="mrf-s-body" style={{ gap: 12 }}>
            <MinimalRichEditor
              value={summaryText ?? ''}
              onChange={setSummaryText}
              placeholder="Text eingeben oder per Diktierfunktion aufnehmen…"
              minRows={4}
            />
            <div className="mrf-summary-actions">
              <VoiceRecorder
                therapyType="huf"
                animalName={horse?.name ?? undefined}
                onResult={(text) => {
                  const cmd = processVoiceCommand(text, summaryText ?? '')
                  applyVoiceCommand(
                    cmd,
                    summaryText ?? '',
                    setSummaryText,
                    (plain) => setSummaryText((prev) => {
                      const para = `<p>${plain}</p>`
                      return prev ? `${prev}${para}` : para
                    })
                  )
                }}
                className="flex-1"
                buttonLabel="Sprachnotiz"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1B1F23] active:scale-[0.97]"
              />
              <ImproveTextButton
                value={stripHtml(summaryText ?? '')}
                animalName={horse?.name ?? undefined}
                onImproved={(improved) => setSummaryText(wrapAsHtml(improved))}
                className="flex-1"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1B1F23] active:scale-[0.97]"
              />
            </div>
          </div>
        </div>

        {/* 5. INTERNE NOTIZ */}
        <div className="mrf-card">
          <div className="mrf-s-header">
            <div className="mrf-s-title">
              <span className="mrf-s-icon"><i className="bi bi-lock-fill" /></span>
              Interne Notiz
            </div>
          </div>
          <div className="mrf-s-body">
            <textarea
              className="mrf-editor"
              placeholder="Interne Notizen (nur für Sie sichtbar) …"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {error && (
          <div className="mrf-error">{error}</div>
        )}

        {/* SPEICHERN / ABBRECHEN */}
        <div className="mrf-submit-row">
          <button
            type="button"
            className="mrf-submit-cancel"
            onClick={() => router.back()}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="mrf-submit-save"
            disabled={submitting}
            onClick={handleSubmit}
          >
            <i className="bi bi-floppy2-fill" />
            {submitting ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>

      </div>

    </div>
  )
}
