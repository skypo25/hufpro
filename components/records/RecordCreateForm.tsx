'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PhotoGrid from '@/components/photos/PhotoGrid'
import { useOfflineDraft, useOnlineStatus } from '@/hooks/useOfflineDraft'
import OfflineStatusBanner from '@/components/OfflineStatusBanner'
import { serializeRecordForm, deserializeStagedPhotos } from '@/lib/record-draft-serializer'
import { uploadProcessedPhoto, saveAnnotationsForExistingPhoto } from '@/components/photos/usePhotoUpload'
import { deleteRecordPhotos } from '@/app/(app)/horses/[id]/records/actions'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'
import type { StagedPhoto } from '@/components/photos/usePhotoUpload'
import type { AnnotationsData } from '@/lib/photos/annotations'
import type { ExistingPhoto } from '@/components/photos/PhotoSlot'
import ErstterminBodyPhotosCard from '@/components/records/ErstterminBodyPhotosCard'
import VoiceRecorder from '@/components/VoiceRecorder'
import ImproveTextButton from '@/components/ImproveTextButton'
import MinimalRichEditor from '@/components/records/MinimalRichEditor'
import { processVoiceCommand, applyVoiceCommand } from '@/lib/voiceCommands'
import type { HoofKey, HoofState } from '@/lib/hoofs'
import {
  createInitialHoofs,
  parseHoofsFromJson,
  computeHoofOverallStatus,
  singleHoofStatus,
  HOOF_STANDARD,
} from '@/lib/hoofs'

type TextBlock = {
  id: string
  category: string
  label: string
  sort_order: number
  is_system: boolean
  user_id: string | null
}

type HorseContext = {
  id: string
  name: string
  breed: string | null
  sex: string | null
  birthYear: number | null
  customerName: string
  stableName: string | null
  memo: string | null
}

type LastRecord = {
  date: string | null
  text: string
} | null

export type ErstterminBodyPhoto = {
  url: string
  label: string
}

type RecordCreateFormProps = {
  horse?: HorseContext | null
  defaultRecordDate: string
  defaultRecordType: string
  lastRecord?: LastRecord
  textBlocks?: TextBlock[]
  saveAction: (formData: FormData) => Promise<{ recordId: string } | { error: string } | void>
  erstterminBodyPhotos?: ErstterminBodyPhoto[]
  erstterminRecordDate?: string | null
  /** Edit mode: show same form with initial values and update action instead of create */
  mode?: 'create' | 'edit'
  recordId?: string
  initialRecordDate?: string
  initialSummaryNotes?: string
  initialRecommendationNotes?: string
  initialNotes?: string
  initialGeneralCondition?: string
  initialGait?: string
  initialHandlingBehavior?: string
  initialHornQuality?: string
  initialHoofsJson?: unknown
  initialChecklistJson?: unknown
  updateAction?: (horseId: string, recordId: string, formData: FormData) => Promise<void>
  /** Edit mode: existing photos for this record (with signed URLs in existingPhotoUrls) */
  existingPhotos?: ExistingPhoto[]
  existingPhotoUrls?: Record<string, string>
}

const GENERAL_CONDITION_OPTIONS = ['Unauffällig', 'Auffällig']
const GAIT_OPTIONS = ['Taktrein', 'Leicht ungleichmäßig', 'Lahm']
const HANDLING_OPTIONS = ['Kooperativ', 'Unruhig', 'Widersetzlich']
const HORN_OPTIONS = ['Stabil', 'Mittel', 'Brüchig', 'Weich']

function mapLegacyGeneralCondition(v: string | null | undefined): string | null {
  if (!v) return null
  const u = v.trim()
  if (GENERAL_CONDITION_OPTIONS.includes(u)) return u
  if (['Gut', 'Unauffällig'].includes(u)) return 'Unauffällig'
  if (['Reduziert', 'Auffällig'].includes(u)) return 'Auffällig'
  return null
}

function mapLegacyGait(v: string | null | undefined): string | null {
  if (!v) return null
  const u = v.trim()
  if (GAIT_OPTIONS.includes(u)) return u
  if (['Frei / gleichmäßig', 'Nicht beurteilt'].includes(u)) return 'Taktrein'
  if (u === 'Leicht ungleichmäßig') return 'Leicht ungleichmäßig'
  if (u === 'Lahm') return 'Lahm'
  return null
}

function mapLegacyHandling(v: string | null | undefined): string | null {
  if (!v) return null
  const u = v.trim()
  if (HANDLING_OPTIONS.includes(u)) return u
  if (['Probleme HL', 'Probleme HR'].includes(u)) return 'Unruhig'
  return null
}

function mapLegacyHornQuality(v: string | null | undefined): string | null {
  if (!v) return null
  const u = v.trim()
  if (HORN_OPTIONS.includes(u)) return u
  if (u === 'Gut') return 'Stabil'
  if (u === 'Spröde / brüchig') return 'Brüchig'
  if (['Mittel', 'Weich'].includes(u)) return u
  return null
}

const CHECKLIST_ITEMS = [
  'Gangbild beurteilt',
  'Allgemeinzustand geprüft',
  'Alle 4 Hufe bearbeitet',
  'Hufwinkel gemessen',
  'Sohlenfotos gemacht',
  'Seitenfotos gemacht',
  'Markierungen gesetzt',
  'Befund dokumentiert',
  'Empfehlung vermerkt',
  'Besitzer informiert',
]

function formatHorseMeta(horse: HorseContext) {
  return [
    horse.breed,
    horse.sex,
    horse.birthYear ? `${new Date().getFullYear() - horse.birthYear} J.` : null,
    horse.customerName,
    horse.stableName,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Strips HTML tags and decodes basic entities for plain-text use (e.g. AI improvement). */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Wraps improved plain text (paragraphs separated by double newline) back into HTML. */
function wrapAsHtml(text: string): string {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (!paras.length) return ''
  return paras.map((p) => `<p>${p}</p>`).join('')
}

function formatGermanDate(dateString: string | null) {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

function parseChecklistFromJson(json: unknown): string[] {
  if (!json || !Array.isArray(json)) return ['Gangbild beurteilt', 'Allgemeinzustand geprüft']
  return json.filter((x): x is string => typeof x === 'string')
}

function SectionHeader({
  icon,
  title,
  hint,
  iconClassName,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  iconClassName: string
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-[22px] py-4">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[14px] ${iconClassName}`}>
        {icon}
      </div>
      <h3 className="dashboard-serif flex-1 text-[15px] font-medium text-[#1B1F23]">{title}</h3>
      {hint && <span className="text-[11px] text-[#9CA3AF]">{hint}</span>}
    </div>
  )
}

const CHIP_COLOR_CLASSES: Record<string, string> = {
  green: 'border-[#86EFAC] bg-[#DCFCE7] text-[#166534]',
  yellow: 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]',
  red: 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]',
}

function SingleChoiceChips({
  options,
  value,
  onChange,
  color = 'green',
  optionColors,
}: {
  options: string[]
  value: string
  onChange: (value: string) => void
  color?: 'green' | 'yellow' | 'red' | 'default'
  /** Farbe pro Option wenn ausgewählt (z. B. Taktrein=grün, Lahm=rot) */
  optionColors?: Record<string, 'green' | 'yellow' | 'red'>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option
        const colorKey = active && optionColors?.[option] ? optionColors[option] : active ? color : null
        const selectedClass = colorKey ? CHIP_COLOR_CLASSES[colorKey] : CHIP_COLOR_CLASSES.green

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={[
              'rounded-lg border-[1.5px] px-2.5 py-1.5 !text-[13px] font-medium transition',
              active
                ? selectedClass
                : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#52b788] hover:text-[#52b788]',
            ].join(' ')}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function TogglePhraseRow({
  phrases,
  selected,
  onToggle,
}: {
  phrases: TextBlock[]
  selected: string[]
  onToggle: (label: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {phrases.map((phrase) => {
        const active = selected.includes(phrase.label)

        return (
          <button
            key={phrase.id}
            type="button"
            onClick={() => onToggle(phrase.label)}
            className={[
              'rounded-lg border-[1.5px] px-2.5 py-1.5 !text-[13px] font-medium transition',
              active
                ? CHIP_COLOR_CLASSES.green
                : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#52b788] hover:text-[#52b788]',
            ].join(' ')}
          >
            {phrase.label}
          </button>
        )
      })}
    </div>
  )
}

function HoofCard({
  title,
  colorClass,
  hoof,
  onChange,
}: {
  title: string
  colorClass: string
  hoof: HoofState
  onChange: (next: Partial<HoofState>) => void
}) {
  const dotStatus = singleHoofStatus(hoof)
  const [badge, fullTitle] = title.includes(' – ') ? title.split(' – ') : [title.slice(0, 2), title]
  const titleText = fullTitle ? fullTitle.toUpperCase() : title.toUpperCase()
  return (
    <div className="rounded-[14px] border-2 border-[#E5E2DC] p-4 transition hover:border-[rgba(21,66,38,0.4)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 rounded-md bg-[#edf3ef] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#52b788]">
            {badge.trim()}
          </span>
          <span className="truncate text-[13px] font-bold uppercase tracking-[0.06em] text-[#1B1F23]">
            {titleText}
          </span>
        </div>
        <span
          className={[
            'h-2.5 w-2.5 rounded-full',
            dotStatus === 'problematisch'
              ? 'bg-[#EF4444]'
              : dotStatus === 'behandlungsbeduerftig'
                ? 'bg-[#EAB308]'
                : 'bg-[#22C55E]',
          ].join(' ')}
          aria-hidden
        />
      </div>

      <div className="space-y-3">
        {[
          {
            label: 'Zehe',
            value: hoof.toe_alignment,
            options: ['gerade', 'medial', 'lateral'],
            optionColors: { gerade: 'green', medial: 'yellow', lateral: 'yellow' },
            set: (v: string | null) => onChange({ toe_alignment: v }),
          },
          {
            label: 'Trachten',
            value: hoof.heel_balance,
            options: ['normal', 'untergeschoben', 'ungleich'],
            optionColors: { normal: 'green', untergeschoben: 'yellow', ungleich: 'yellow' },
            set: (v: string | null) => onChange({ heel_balance: v }),
          },
          {
            label: 'Strahl',
            value: hoof.frog_condition,
            options: ['gesund', 'faulig'],
            optionColors: { gesund: 'green', faulig: 'red' },
            set: (v: string | null) => onChange({ frog_condition: v }),
          },
          {
            label: 'Sohle',
            value: hoof.sole_condition,
            options: ['stabil', 'dünn'],
            optionColors: { stabil: 'green', dünn: 'yellow' },
            set: (v: string | null) => onChange({ sole_condition: v }),
          },
        ].map(({ label, value, options, optionColors, set }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="min-w-[55px] pt-1 text-[11px] font-medium text-[#6B7280]">{label}</span>
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => {
                const active = value === option
                const colorKey = active ? ((optionColors as unknown as Record<string, string> | undefined)?.[option] ?? 'green') : null
                const activeClass = colorKey ? CHIP_COLOR_CLASSES[colorKey] : ''
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => set(active ? null : option)}
                    className={[
                      'rounded-lg border-[1.5px] px-2.5 py-1.5 !text-[13px] font-semibold transition',
                      active
                        ? activeClass
                        : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#52b788]',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressSidebar({
  generalDone,
  hoofDoneCount,
  checklistDoneCount,
  totalChecklist,
  lastRecord,
  memo,
  erstterminBodyPhotos = [],
  erstterminRecordDate = null,
}: {
  generalDone: number
  hoofDoneCount: number
  checklistDoneCount: number
  totalChecklist: number
  lastRecord: LastRecord | null
  memo: string | null
  erstterminBodyPhotos?: ErstterminBodyPhoto[]
  erstterminRecordDate?: string | null
}) {
  return (
    <div className="space-y-5">
      <section className="huf-card huf-card--lg">
        <div className="border-b border-[#E5E2DC] px-5 py-4">
          <h4 className="dashboard-serif text-[15px] font-medium text-[#1B1F23]">Fortschritt</h4>
        </div>

        <div className="space-y-0 px-5 py-[18px]">
          {[
            {
              done: generalDone === 4,
              current: generalDone > 0 && generalDone < 4,
              title: 'Allgemeiner Eindruck',
              sub: `${generalDone}/4 ausgefüllt`,
            },
            {
              done: hoofDoneCount === 4,
              current: hoofDoneCount > 0 && hoofDoneCount < 4,
              title: 'Hufbefund pro Huf',
              sub: `${hoofDoneCount}/4 Hufe dokumentiert`,
            },
            {
              done: false,
              current: false,
              title: 'Fotos aufnehmen',
              sub: 'Upload kommt im nächsten Schritt',
            },
            {
              done: checklistDoneCount === totalChecklist,
              current: checklistDoneCount > 0 && checklistDoneCount < totalChecklist,
              title: 'Checkliste',
              sub: `${checklistDoneCount}/${totalChecklist} abgehakt`,
            },
          ].map((step, index, array) => (
            <div key={step.title} className="relative flex gap-3 py-3">
              {index < array.length - 1 && (
                <div
                  className={[
                    'absolute left-[15px] top-[38px] bottom-[-2px] w-[2px]',
                    step.done ? 'bg-[#52b788]' : 'bg-[#E5E2DC]',
                  ].join(' ')}
                />
              )}

              <div
                className={[
                  'z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold',
                  step.done
                    ? 'border-[#52b788] bg-[#52b788] text-white'
                    : step.current
                      ? 'border-[#52b788] bg-[#edf3ef] text-[#52b788]'
                      : 'border-[#E5E2DC] bg-[#F9FAFB] text-[#6B7280]',
                ].join(' ')}
              >
                {step.done ? <i className="bi bi-check text-[16px]" aria-hidden /> : index + 1}
              </div>

              <div className="flex-1">
                <div
                  className={[
                    'text-[13px] font-medium',
                    step.done
                      ? 'text-[#52b788]'
                      : step.current
                        ? 'text-[#52b788]'
                        : 'text-[#1B1F23]',
                  ].join(' ')}
                >
                  {step.title}
                </div>
                <div className="text-[11px] text-[#9CA3AF]">{step.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {erstterminBodyPhotos.length > 0 && (
        <ErstterminBodyPhotosCard
          photos={erstterminBodyPhotos}
          recordDate={erstterminRecordDate ?? undefined}
        />
      )}

      <section className="huf-card huf-card--lg">
        <div className="border-b border-[#E5E2DC] px-5 py-4">
          <h4 className="dashboard-serif text-[15px] font-medium text-[#1B1F23]">
            Letzter Befund{lastRecord?.date ? ` · ${formatGermanDate(lastRecord.date)}` : ''}
          </h4>
        </div>

        <div className="px-5 py-[18px] text-[13px] leading-[1.6] text-[#6B7280]">
          {lastRecord?.text ? (
            lastRecord.text
          ) : (
            <span>Für dieses Pferd liegt noch kein älterer Befund vor.</span>
          )}
        </div>
      </section>

      {memo && (
        <section className="huf-card huf-card--lg huf-card--accent-left-warning">
          <div className="border-b border-[#E5E2DC] px-5 py-4">
            <h4 className="dashboard-serif text-[15px] font-medium text-[#1B1F23]">📌 Merke für dieses Pferd</h4>
          </div>

          <div className="px-5 py-[18px] text-[13px] leading-[1.6] text-[#6B7280]">
            {memo}
          </div>
        </section>
      )}
    </div>
  )
}

export default function RecordCreateForm({
  horse,
  defaultRecordDate,
  defaultRecordType,
  lastRecord,
  textBlocks = [],
  saveAction,
  erstterminBodyPhotos = [],
  erstterminRecordDate = null,
  mode = 'create',
  recordId: editRecordId,
  initialRecordDate,
  initialSummaryNotes = '',
  initialRecommendationNotes = '',
  initialNotes = '',
  initialGeneralCondition,
  initialGait,
  initialHandlingBehavior,
  initialHornQuality,
  initialHoofsJson,
  initialChecklistJson,
  updateAction,
  existingPhotos = [],
  existingPhotoUrls = {},
}: RecordCreateFormProps) {
  const isEdit = mode === 'edit'

  const [recordDate, setRecordDate] = useState(isEdit && initialRecordDate ? initialRecordDate.slice(0, 10) : defaultRecordDate)
  const [generalCondition, setGeneralCondition] = useState(
    mapLegacyGeneralCondition(initialGeneralCondition) ?? GENERAL_CONDITION_OPTIONS[0]
  )
  const [gait, setGait] = useState(mapLegacyGait(initialGait) ?? GAIT_OPTIONS[0])
  const [handlingBehavior, setHandlingBehavior] = useState(
    mapLegacyHandling(initialHandlingBehavior) ?? HANDLING_OPTIONS[0]
  )
  const [hornQuality, setHornQuality] = useState(mapLegacyHornQuality(initialHornQuality) ?? HORN_OPTIONS[0])

  const [hoofs, setHoofs] = useState<Record<HoofKey, HoofState>>(
    isEdit && initialHoofsJson ? parseHoofsFromJson(initialHoofsJson) : createInitialHoofs()
  )

  const [summaryText, setSummaryText] = useState(initialSummaryNotes)
  const [recommendationText, setRecommendationText] = useState(initialRecommendationNotes)
  const [notesText, setNotesText] = useState(initialNotes)

  const [selectedWorkPhrases, setSelectedWorkPhrases] = useState<string[]>([])
  const [selectedFindingPhrases, setSelectedFindingPhrases] = useState<string[]>([])
  const [selectedRecommendationPhrases, setSelectedRecommendationPhrases] = useState<string[]>([])

  const [checklist, setChecklist] = useState<string[]>(
    isEdit && initialChecklistJson ? parseChecklistFromJson(initialChecklistJson) : ['Gangbild beurteilt', 'Allgemeinzustand geprüft']
  )

  const [stagedPhotos, setStagedPhotos] = useState<Partial<Record<PhotoSlotKey, StagedPhoto>>>({})
  const [annotationsBySlot, setAnnotationsBySlot] = useState<Partial<Record<PhotoSlotKey, AnnotationsData>>>({})
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const { draft, loading: draftLoading, persist, persistImmediate, clear } = useOfflineDraft(
    horse?.id ?? '',
    isEdit ? editRecordId : undefined
  )
  const draftRestoredRef = useRef(false)

  // ── Restore from offline draft (create mode only) ──
  useEffect(() => {
    if (!horse || isEdit || draftLoading || !draft?.formData || draftRestoredRef.current) return
    const form = draft.formData as Record<string, unknown>
    if (form.recordDate) setRecordDate(String(form.recordDate).slice(0, 10))
    if (form.generalCondition) setGeneralCondition(String(form.generalCondition))
    if (form.gait) setGait(String(form.gait))
    if (form.handlingBehavior) setHandlingBehavior(String(form.handlingBehavior))
    if (form.hornQuality) setHornQuality(String(form.hornQuality))
    if (form.summaryText) setSummaryText(String(form.summaryText ?? ''))
    if (form.recommendationText) setRecommendationText(String(form.recommendationText ?? ''))
    if (form.notesText) setNotesText(String(form.notesText ?? ''))
    if (form.hoofs && Array.isArray(form.hoofs)) {
      setHoofs(parseHoofsFromJson(form.hoofs))
    }
    if (form.checklist && Array.isArray(form.checklist)) {
      setChecklist(form.checklist as string[])
    }
    if (form.stagedPhotosBase64 && typeof form.stagedPhotosBase64 === 'object') {
      deserializeStagedPhotos(form.stagedPhotosBase64 as Record<string, string>).then((photos) => {
        const next: Partial<Record<PhotoSlotKey, StagedPhoto>> = {}
        for (const [slot, p] of Object.entries(photos)) {
          if (p && slot) {
            next[slot as PhotoSlotKey] = { slot: slot as PhotoSlotKey, blob: p.blob, width: p.width, height: p.height, previewUrl: p.previewUrl }
          }
        }
        if (Object.keys(next).length > 0) setStagedPhotos(next)
      })
    }
    if (form.annotationsBySlot && typeof form.annotationsBySlot === 'object') {
      setAnnotationsBySlot(form.annotationsBySlot as Partial<Record<PhotoSlotKey, AnnotationsData>>)
    }
    draftRestoredRef.current = true
  }, [horse, isEdit, draft, draftLoading])

  // ── Persist draft on form change (create mode, debounced) ──
  const buildFormSnapshot = useCallback(() => {
    const hoofArray = Object.values(hoofs)
    return {
      recordDate,
      generalCondition,
      gait,
      handlingBehavior,
      hornQuality,
      summaryText,
      recommendationText,
      notesText,
      hoofs: hoofArray,
      checklist,
      stagedPhotos: Object.fromEntries(
        Object.entries(stagedPhotos).filter(([, p]) => !!p).map(([s, p]) => [s, p ? { blob: p.blob, width: p.width, height: p.height } : null])
      ) as Record<string, { blob: Blob; width: number; height: number }>,
      annotationsBySlot,
    }
  }, [recordDate, generalCondition, gait, handlingBehavior, hornQuality, summaryText, recommendationText, notesText, hoofs, checklist, stagedPhotos, annotationsBySlot])

  useEffect(() => {
    if (!horse || isEdit || draftLoading) return
    let cancelled = false
    const t = setTimeout(() => {
      serializeRecordForm(buildFormSnapshot()).then((snapshot) => {
        if (!cancelled) persist(snapshot as unknown as Record<string, unknown>)
      })
    }, 1500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [horse, isEdit, draftLoading, buildFormSnapshot, persist])

  const workBlocks = useMemo(
    () => (textBlocks ?? []).filter((item) => item.category === 'bearbeitung'),
    [textBlocks]
  )

  const findingBlocks = useMemo(
    () => (textBlocks ?? []).filter((item) => item.category === 'befund'),
    [textBlocks]
  )

  const recommendationBlocks = useMemo(
    () => (textBlocks ?? []).filter((item) => item.category === 'empfehlung'),
    [textBlocks]
  )

  function togglePhrase(
    label: string,
    selected: string[],
    setSelected: (value: string[]) => void
  ) {
    setSelected(
      selected.includes(label)
        ? selected.filter((item) => item !== label)
        : [...selected, label]
    )
  }

  function toggleChecklist(label: string) {
    setChecklist((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    )
  }

  const handleStagedPhotoAdd = useCallback((slot: PhotoSlotKey, staged: StagedPhoto) => {
    setStagedPhotos((prev) => ({ ...prev, [slot]: staged }))
    setAnnotationsBySlot((prev) => ({ ...prev, [slot]: { version: 1, items: [] } }))
  }, [])
  const handleStagedPhotoRemove = useCallback((slot: PhotoSlotKey) => {
    setStagedPhotos((prev) => {
      const next = { ...prev }
      const s = next[slot]
      if (s?.previewUrl) URL.revokeObjectURL(s.previewUrl)
      delete next[slot]
      return next
    })
  }, [])
  const handleAnnotationsChange = useCallback((slot: PhotoSlotKey, data: AnnotationsData) => {
    setAnnotationsBySlot((prev) => ({ ...prev, [slot]: data }))
  }, [])
  const handleRemoveExistingPhoto = useCallback((photoId: string) => {
    setRemovedPhotoIds((prev) => (prev.includes(photoId) ? prev : [...prev, photoId]))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!horse) return
    if (!isOnline && !isEdit) {
      setSubmitting(true)
      setMessage('')
      try {
        const snapshot = await serializeRecordForm(buildFormSnapshot())
        await persistImmediate(snapshot as unknown as Record<string, unknown>)
        setMessage('✓ Entwurf lokal gespeichert. Wird synchronisiert, sobald du wieder online bist.')
        setTimeout(() => setMessage(''), 4000)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Entwurf konnte nicht lokal gespeichert werden.')
      } finally {
        setSubmitting(false)
      }
      return
    }
    const form = e.currentTarget
    const fd = new FormData(form)
    if (isEdit && updateAction && editRecordId) {
      setSubmitting(true)
      try {
        await updateAction(horse.id, editRecordId, fd)
        if (removedPhotoIds.length > 0) {
          await deleteRecordPhotos(horse.id, editRecordId, removedPhotoIds)
        }
        const staged = Object.entries(stagedPhotos) as [PhotoSlotKey, StagedPhoto][]
        for (const [slot, photo] of staged) {
          if (!photo) continue
          await uploadProcessedPhoto({
            recordId: editRecordId,
            horseId: horse.id,
            slot,
            blob: photo.blob,
            width: photo.width,
            height: photo.height,
            annotationsJson: annotationsBySlot[slot] ?? undefined,
          })
        }
        // Save annotations for existing photos that were annotated but not re-uploaded
        const stagedSlots = new Set(staged.filter(([, p]) => !!p).map(([s]) => s))
        for (const [slot, annotations] of Object.entries(annotationsBySlot) as [PhotoSlotKey, import('@/lib/photos/annotations').AnnotationsData][]) {
          if (stagedSlots.has(slot)) continue // already saved above via uploadProcessedPhoto
          await saveAnnotationsForExistingPhoto({ recordId: editRecordId, slot, annotationsJson: annotations })
        }
        router.refresh()
        router.push(`/animals/${horse.id}/records/${editRecordId}`)
      } finally {
        setSubmitting(false)
      }
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const result = await saveAction(fd)
      if (result && 'error' in result) {
        setMessage(result.error)
        return
      }
      const recordId = result?.recordId
      if (!recordId) return
      const staged = Object.entries(stagedPhotos) as [PhotoSlotKey, StagedPhoto][]
      for (const [slot, photo] of staged) {
        if (!photo) continue
        await uploadProcessedPhoto({
          recordId,
          horseId: horse.id,
          slot,
          blob: photo.blob,
          width: photo.width,
          height: photo.height,
          annotationsJson: annotationsBySlot[slot] ?? undefined,
        })
      }
      await clear()
      router.refresh()
      router.push(`/animals/${horse.id}/records/${recordId}`)
    } finally {
      setSubmitting(false)
    }
  }

  function updateHoof(hoofKey: HoofKey, next: Partial<HoofState>) {
    setHoofs((prev) => ({
      ...prev,
      [hoofKey]: {
        ...prev[hoofKey],
        ...next,
      },
    }))
  }

  const combinedSummary = useMemo(() => {
    // phrases UI is removed – always empty; just pass the HTML content through
    const phrases = [...selectedWorkPhrases, ...selectedFindingPhrases].join(' ')
    return [phrases, (summaryText ?? '').trim()].filter(Boolean).join(' ').trim()
  }, [selectedWorkPhrases, selectedFindingPhrases, summaryText])

  const combinedRecommendation = useMemo(() => {
    const phrases = selectedRecommendationPhrases.join(' ')
    return [phrases, recommendationText.trim()].filter(Boolean).join(' ').trim()
  }, [selectedRecommendationPhrases, recommendationText])

  const hoofArray = useMemo(() => Object.values(hoofs), [hoofs])

  const hoofOverallStatus = useMemo(() => computeHoofOverallStatus(hoofs), [hoofs])

  function setAllHoofsUnauffaellig() {
    setHoofs((prev) => {
      const next = { ...prev }
      const keys: HoofKey[] = ['vl', 'vr', 'hl', 'hr']
      for (const k of keys) {
        next[k] = {
          ...prev[k],
          toe_alignment: HOOF_STANDARD.toe_alignment,
          heel_balance: HOOF_STANDARD.heel_balance,
          sole_condition: HOOF_STANDARD.sole_condition,
          frog_condition: HOOF_STANDARD.frog_condition,
        }
      }
      return next
    })
  }

  const filteredExistingPhotos = useMemo(() => {
    if (!isEdit || removedPhotoIds.length === 0) return existingPhotos
    return existingPhotos.filter((p) => !removedPhotoIds.includes(p.id))
  }, [isEdit, existingPhotos, removedPhotoIds])

  const filteredExistingPhotoUrls = useMemo(() => {
    if (!isEdit || removedPhotoIds.length === 0) return existingPhotoUrls
    const removedSlots = new Set(
      existingPhotos.filter((p) => removedPhotoIds.includes(p.id)).map((p) => p.photo_type)
    )
    const next: Record<string, string> = {}
    for (const [slot, url] of Object.entries(existingPhotoUrls)) {
      if (!removedSlots.has(slot)) next[slot] = url
    }
    return next
  }, [isEdit, existingPhotos, existingPhotoUrls, removedPhotoIds])

  const generalDone = [
    generalCondition,
    gait,
    handlingBehavior,
    hornQuality,
  ].filter(Boolean).length

  const hoofDoneCount = hoofArray.filter(
    (hoof) =>
      hoof.work_status ||
      hoof.angle_deg !== null ||
      hoof.toe_alignment ||
      hoof.heel_balance ||
      hoof.sole_condition ||
      hoof.frog_condition
  ).length

  if (!horse) {
    return (
      <div className="huf-card huf-card--lg p-6 text-[14px] text-[#6B7280]">
        Pferd konnte nicht geladen werden. Bitte gehe zurück und versuche es erneut.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7 xl:grid xl:grid-cols-[1fr_340px] xl:items-start">
      {/* Top row: Banner + Message (full width) */}
      <div className="flex flex-col gap-4 xl:col-span-2">
        {!isEdit && horse && (
          <OfflineStatusBanner
            isOnline={isOnline}
            hasLocalDraft={!!draft}
            compact={false}
          />
        )}
        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              message.startsWith('✓')
                ? 'border border-[#52b788]/50 bg-[#edf7f2] text-[#166534]'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message}
          </div>
        )}
      </div>

      <div className="space-y-5 xl:col-start-1 xl:row-start-2 min-w-0">
        <div className="hidden" aria-hidden>
          <input type="hidden" name="record_type" value={defaultRecordType} />
          {isEdit ? (
            <input type="hidden" name="record_date" value={recordDate} />
          ) : (
            <>
              <input type="hidden" name="horse_id" value={horse.id} />
              <input type="hidden" name="record_date" value={defaultRecordDate} />
            </>
          )}
          <input type="hidden" name="general_condition" value={generalCondition} />
          <input type="hidden" name="gait" value={gait} />
          <input type="hidden" name="handling_behavior" value={handlingBehavior} />
          <input type="hidden" name="horn_quality" value={hornQuality} />
          <input type="hidden" name="summary_notes" value={combinedSummary} />
          <input type="hidden" name="recommendation_notes" value={combinedRecommendation} />
          <input type="hidden" name="checklist_json" value={JSON.stringify(checklist)} />
          <input type="hidden" name="hoofs_json" value={JSON.stringify(hoofArray)} />
        </div>
        <div className="mb-5 flex items-center gap-2 text-[13px] text-[#6B7280]">
          {isEdit ? (
            <>
              <a href={`/animals/${horse.id}`} className="text-[#52b788] hover:underline">
                {horse.name}
              </a>
              <span>›</span>
              <a href={`/animals/${horse.id}/records/${editRecordId}`} className="text-[#52b788] hover:underline">
                {formatGermanDate(recordDate)}
              </a>
              <span>›</span>
              <span>Dokumentation bearbeiten</span>
            </>
          ) : (
            <>
              <span className="text-[#52b788]">Termine</span>
              <span>›</span>
              <span className="text-[#52b788]">
                {formatGermanDate(defaultRecordDate)} · {horse.customerName}
              </span>
              <span>›</span>
              <span>Dokumentation erstellen</span>
            </>
          )}
        </div>

        <section className="huf-card huf-card--lg">
          <div className="flex flex-wrap items-center gap-5 px-6 py-5">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#edf3ef] text-[#154226]">
                <svg width="28" height="28" viewBox="0 0 576 512" fill="currentColor" className="shrink-0" aria-hidden>
                  <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="dashboard-serif truncate text-[22px] font-semibold text-[#1B1F23]">
                  {horse.name}
                </div>
                <div className="truncate text-[13px] text-[#6B7280]">
                  {formatHorseMeta(horse)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 md:gap-8">
              <div className={isEdit ? '' : 'text-right'}>
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
                  Datum
                </div>
                {isEdit ? (
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="mt-1 rounded-lg border border-[#E5E2DC] px-3 py-2 text-[14px] font-semibold text-[#1B1F23] focus:border-[#52b788] focus:outline-none focus:ring-2 focus:ring-[#52b788]/20"
                  />
                ) : (
                  <div className="mt-1 text-[14px] font-semibold text-[#1B1F23]">
                    {formatGermanDate(defaultRecordDate)}
                  </div>
                )}
              </div>

              <div className="hidden h-10 w-px bg-[#E5E2DC] md:block" />

              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
                  Terminart
                </div>
                <div className="mt-1 text-[14px] font-semibold text-[#52b788]">
                  {defaultRecordType}
                </div>
              </div>

              <div className="hidden h-10 w-px bg-[#E5E2DC] md:block" />

              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
                  Letzter Termin
                </div>
                <div className="mt-1 text-[14px] font-semibold text-[#1B1F23]">
                  {lastRecord?.date ? formatGermanDate(lastRecord.date) : '-'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="huf-card huf-card--lg">
          <SectionHeader
            icon={<i className="bi bi-eye-fill text-[14px]" aria-hidden />}
            title="Allgemeiner Eindruck"
            hint="~30 Sek. pro Pferd"
            iconClassName="bg-[#edf3ef] text-[#166534]"
          />

          <div className="px-[22px] py-5">
            <div className="flex flex-col">
              <div className="flex flex-col gap-2 border-b border-[#E5E2DC] py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px] font-medium text-[#1B1F23]">Allgemeinzustand</span>
                <SingleChoiceChips
                  options={GENERAL_CONDITION_OPTIONS}
                  value={generalCondition}
                  onChange={setGeneralCondition}
                  optionColors={{ Unauffällig: 'green', Auffällig: 'red' }}
                />
              </div>
              <div className="flex flex-col gap-2 border-b border-[#E5E2DC] py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px] font-medium text-[#1B1F23]">Gangbild</span>
                <SingleChoiceChips
                  options={GAIT_OPTIONS}
                  value={gait}
                  onChange={setGait}
                  optionColors={{
                    Taktrein: 'green',
                    'Leicht ungleichmäßig': 'yellow',
                    Lahm: 'red',
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 border-b border-[#E5E2DC] py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px] font-medium text-[#1B1F23]">Verhalten</span>
                <SingleChoiceChips
                  options={HANDLING_OPTIONS}
                  value={handlingBehavior}
                  onChange={setHandlingBehavior}
                  optionColors={{
                    Kooperativ: 'green',
                    Unruhig: 'yellow',
                    Widersetzlich: 'red',
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 border-b border-[#E5E2DC] py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px] font-medium text-[#1B1F23]">Hornqualität</span>
                <SingleChoiceChips
                  options={HORN_OPTIONS}
                  value={hornQuality}
                  onChange={setHornQuality}
                  optionColors={{
                    Stabil: 'green',
                    Mittel: 'yellow',
                    Brüchig: 'yellow',
                    Weich: 'yellow',
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="huf-card huf-card--lg">
          <SectionHeader
            icon={<i className="bi bi-search text-[14px]" aria-hidden />}
            title="Hufbefund pro Huf"
            hint="Nur Abweichungen ändern"
            iconClassName="bg-[#edf3ef] text-[#52b788]"
          />

          <div className="space-y-5 px-[22px] py-5">
            <button
              type="button"
              onClick={setAllHoofsUnauffaellig}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#52b788] bg-[#edf3ef] px-4 py-3 text-[14px] font-semibold text-[#52b788] transition hover:bg-[#d1e7d8]"
            >
              <i className="bi bi-check text-[18px]" aria-hidden />
              Alle Hufe unauffällig
            </button>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E2DC] bg-[#FAFAF9] px-4 py-3">
              <span
                className={[
                  'inline-flex h-3 w-3 shrink-0 rounded-full',
                  hoofOverallStatus === 'unauffaellig'
                    ? 'bg-[#22C55E]'
                    : hoofOverallStatus === 'behandlungsbeduerftig'
                      ? 'bg-[#EAB308]'
                      : 'bg-[#EF4444]',
                ].join(' ')}
                aria-hidden
              />
              <span className="text-[13px] font-semibold text-[#1B1F23]">
                {hoofOverallStatus === 'unauffaellig'
                  ? 'Unauffällig'
                  : hoofOverallStatus === 'behandlungsbeduerftig'
                    ? 'Behandlungsbedürftig'
                    : 'Problematisch'}
              </span>
              <span className="text-[11px] text-[#6B7280]">· Automatisch erkannt</span>
            </div>

            <div className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              — VORNE —
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <HoofCard
                title="VL – Vorne Links"
                colorClass="text-[#D97706]"
                hoof={hoofs.vl}
                onChange={(next) => updateHoof('vl', next)}
              />
              <HoofCard
                title="VR – Vorne Rechts"
                colorClass="text-[#059669]"
                hoof={hoofs.vr}
                onChange={(next) => updateHoof('vr', next)}
              />
            </div>

            <div className="pt-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              — HINTEN —
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <HoofCard
                title="HL – Hinten Links"
                colorClass="text-[#7C3AED]"
                hoof={hoofs.hl}
                onChange={(next) => updateHoof('hl', next)}
              />
              <HoofCard
                title="HR – Hinten Rechts"
                colorClass="text-[#2563EB]"
                hoof={hoofs.hr}
                onChange={(next) => updateHoof('hr', next)}
              />
            </div>

            <p className="text-center text-[11px] text-[#9CA3AF]">
              © Nur Abweichungen antippen – Standard ist bereits gesetzt
            </p>
          </div>
        </section>

        <section className="huf-card huf-card--lg">
          <SectionHeader
            icon={<i className="bi bi-camera-fill text-[14px]" aria-hidden />}
            title={isEdit ? 'Fotos' : 'Fotos aufnehmen'}
            hint={isEdit ? 'Bestehende anzeigen oder neue hochladen' : 'Tippe einen Slot an zum Hochladen'}
            iconClassName="bg-[#edf3ef] text-[#52b788]"
          />

          <div className="space-y-5 px-[22px] py-5">
            <PhotoGrid
              recordId={isEdit ? editRecordId ?? null : null}
              horseId={horse.id}
              existingPhotos={filteredExistingPhotos}
              imageUrls={filteredExistingPhotoUrls}
              stagedPhotos={stagedPhotos}
              annotationsBySlot={annotationsBySlot}
              isErsttermin={!isEdit && defaultRecordType === 'ersttermin'}
              onStagedAdd={handleStagedPhotoAdd}
              onStagedRemove={handleStagedPhotoRemove}
              onAnnotationsChange={handleAnnotationsChange}
              onRemoveExistingPhoto={isEdit ? handleRemoveExistingPhoto : undefined}
            />
          </div>
        </section>

        <section className="huf-card huf-card--lg">
          <SectionHeader
            icon={<i className="bi bi-file-earmark-richtext-fill text-[14px]" aria-hidden />}
            title="Maßnahmen & Beobachtungen"
            hint="Text eingeben oder Diktat"
            iconClassName="bg-[#edf3ef] text-[#52b788]"
          />

          <div className="space-y-4 px-[22px] py-5">
            <MinimalRichEditor
              value={summaryText ?? ''}
              onChange={setSummaryText}
              placeholder="Text eingeben oder per Diktierfunktion aufnehmen. Fettschrift mit Strg+B oder dem B-Button markieren."
              minRows={5}
            />
            <div className="grid grid-cols-2 gap-3">
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
                className="w-full"
                buttonLabel="Sprachnotiz aufnehmen"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-3 text-[13px] font-semibold text-[#1B1F23] transition hover:border-[#9CA3AF] active:scale-[0.98] disabled:opacity-60"
              />
              <ImproveTextButton
                value={stripHtml(summaryText ?? '')}
                animalName={horse?.name ?? undefined}
                onImproved={(improved) => setSummaryText(wrapAsHtml(improved))}
                className="w-full"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-3 text-[13px] font-semibold text-[#1B1F23] transition hover:border-[#9CA3AF] active:scale-[0.98] disabled:opacity-50"
              />
            </div>
          </div>
        </section>

        {isEdit && (
          <section className="huf-card huf-card--lg">
            <SectionHeader
              icon="📝"
              title="Interne Notiz"
              iconClassName="bg-[#EDE9FE] text-[#7C3AED]"
            />
            <div className="px-[22px] py-5">
              <textarea
                name="notes"
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={3}
                className="huf-input huf-input--multiline w-full leading-6"
                placeholder="Interne Notizen (nur für Sie sichtbar) …"
              />
            </div>
          </section>
        )}

        <section className="huf-card huf-card--lg">
          <SectionHeader
            icon="✅"
            title="Checkliste"
            hint="Abhaken per Fingertipp"
            iconClassName="bg-[#DCFCE7] text-[#166534]"
          />

          <div className="grid gap-2 px-[22px] py-5 md:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => {
              const active = checklist.includes(item)

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleChecklist(item)}
                  className={[
                    'flex items-center gap-2.5 rounded-[10px] border-[1.5px] px-3.5 py-3 text-left transition',
                    active
                      ? 'border-[#34A853] bg-[rgba(52,168,83,0.04)]'
                      : 'border-[#E5E2DC] bg-white hover:border-[#52b788]',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border-2 text-[12px]',
                      active
                        ? 'border-[#34A853] bg-[#34A853] text-white'
                        : 'border-[#E5E2DC] bg-white text-transparent',
                    ].join(' ')}
                  >
                    <i className="bi bi-check text-[14px]" aria-hidden />
                  </div>
                  <span className="text-[13px] font-medium text-[#1B1F23]">{item}</span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex gap-3">
            <a
              href={isEdit ? `/animals/${horse.id}/records/${editRecordId}` : `/animals/${horse.id}`}
              className="huf-button huf-button--ghost text-[14px] text-[#6B7280] hover:text-[#1B1F23]"
            >
              ← Abbrechen
            </a>
          </div>

          <div className="flex flex-wrap gap-3">
            {isEdit ? (
              <button
                type="submit"
                disabled={submitting}
                className="huf-button huf-button--primary"
              >
                {submitting ? 'Speichern …' : 'Änderungen speichern'}
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  name="intent"
                  value="draft"
                  className="huf-button huf-button--outline"
                  disabled={submitting}
                >
                  {submitting ? 'Speichern …' : 'Als Entwurf speichern'}
                </button>

                <span
                  className="huf-button huf-button--outline cursor-default text-[#9CA3AF]"
                  title="Nach dem Speichern können Sie die Dokumentation als PDF auf der Dokumentationsseite herunterladen."
                >
                  PDF nach Speichern
                </span>

                <button
                  type="submit"
                  name="intent"
                  value="complete"
                  disabled={submitting}
                  className="huf-button huf-button--primary bg-[#34A853] border-[#34A853] hover:bg-[#2E9148] hover:border-[#2E9148]"
                >
                  <i className="bi bi-check text-[18px]" aria-hidden /> Dokumentation abschließen
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="xl:col-start-2 xl:row-start-2 xl:row-span-1">
        <ProgressSidebar
          generalDone={generalDone}
          hoofDoneCount={hoofDoneCount}
          checklistDoneCount={checklist.length}
          totalChecklist={CHECKLIST_ITEMS.length}
          lastRecord={lastRecord ?? null}
          memo={horse.memo}
          erstterminBodyPhotos={erstterminBodyPhotos}
          erstterminRecordDate={erstterminRecordDate}
        />
      </div>
    </form>
  )
}