'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PhotoGrid from '@/components/photos/PhotoGrid'
import { uploadProcessedPhoto } from '@/components/photos/usePhotoUpload'
import { deleteRecordPhotos } from '@/app/(app)/horses/[id]/records/actions'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'
import type { StagedPhoto } from '@/components/photos/usePhotoUpload'
import type { AnnotationsData } from '@/lib/photos/annotations'
import type { ExistingPhoto } from '@/components/photos/PhotoSlot'
import ErstterminBodyPhotosCard from '@/components/records/ErstterminBodyPhotosCard'

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
  saveAction: (formData: FormData) => Promise<{ recordId: string } | void>
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

type HoofKey = 'vl' | 'vr' | 'hl' | 'hr'

type HoofState = {
  hoof_position: HoofKey
  work_status: string | null
  angle_deg: number | null
  toe_alignment: string | null
  heel_balance: string | null
  sole_condition: string | null
  frog_condition: string | null
  notes: string | null
}

const GENERAL_CONDITION_OPTIONS = ['Gut', 'Unauffällig', 'Reduziert', 'Auffällig']
const GAIT_OPTIONS = ['Frei / gleichmäßig', 'Leicht ungleichmäßig', 'Lahm', 'Nicht beurteilt']
const HANDLING_OPTIONS = ['Kooperativ', 'Unruhig', 'Widersetzlich', 'Probleme HL', 'Probleme HR']
const HORN_OPTIONS = ['Gut', 'Mittel', 'Spröde / brüchig', 'Weich']

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

function formatGermanDate(dateString: string | null) {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

function createInitialHoofs(): Record<HoofKey, HoofState> {
  return {
    vl: {
      hoof_position: 'vl',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
    vr: {
      hoof_position: 'vr',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
    hl: {
      hoof_position: 'hl',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
    hr: {
      hoof_position: 'hr',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
  }
}

function parseHoofsFromJson(json: unknown): Record<HoofKey, HoofState> {
  const base = createInitialHoofs()
  if (!json || !Array.isArray(json)) return base
  const keys: HoofKey[] = ['vl', 'vr', 'hl', 'hr']
  for (const item of json) {
    if (!item || typeof item !== 'object' || !('hoof_position' in item)) continue
    const pos = (item as { hoof_position?: string }).hoof_position
    if (pos !== 'vl' && pos !== 'vr' && pos !== 'hl' && pos !== 'hr') continue
    base[pos] = {
      ...base[pos],
      hoof_position: pos,
      work_status: (item as HoofState).work_status ?? null,
      angle_deg: (item as HoofState).angle_deg ?? null,
      toe_alignment: (item as HoofState).toe_alignment ?? null,
      heel_balance: (item as HoofState).heel_balance ?? null,
      sole_condition: (item as HoofState).sole_condition ?? null,
      frog_condition: (item as HoofState).frog_condition ?? null,
      notes: (item as HoofState).notes ?? null,
    }
  }
  return base
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
  icon: string
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

function SingleChoiceChips({
  options,
  value,
  onChange,
  color = 'green',
}: {
  options: string[]
  value: string
  onChange: (value: string) => void
  color?: 'green' | 'yellow' | 'red' | 'default'
}) {
  const selectedClass =
    color === 'green'
      ? 'border-[#86EFAC] bg-[#DCFCE7] text-[#166534]'
      : color === 'yellow'
        ? 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
        : color === 'red'
          ? 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]'
          : 'border-[#154226] bg-[#edf3ef] text-[#0f301b]'

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={[
              'rounded-[20px] border-[1.5px] px-4 py-2 text-[13px] font-medium transition',
              active
                ? selectedClass
                : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#154226] hover:text-[#154226]',
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
              'rounded-lg border px-3.5 py-1.5 text-[12px] font-medium transition',
              active
                ? 'border-[#154226] bg-[#edf3ef] text-[#0f301b]'
                : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-[#154226] hover:text-[#154226]',
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
  return (
    <div className="rounded-[14px] border-2 border-[#E5E2DC] p-4 transition hover:border-[rgba(21,66,38,0.4)]">
      <div className="mb-3 flex items-center justify-between">
        <span className={`text-[13px] font-bold uppercase tracking-[0.06em] ${colorClass}`}>
          {title}
        </span>
        <span
          className={[
            'h-2.5 w-2.5 rounded-full',
            hoof.work_status === 'problem'
              ? 'bg-[#EF4444]'
              : hoof.work_status === 'korrektur'
                ? 'bg-[#F59E0B]'
                : hoof.work_status === 'bearbeitet'
                  ? 'bg-[#34A853]'
                  : 'bg-[#E5E2DC]',
          ].join(' ')}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { label: '✓ bearbeitet', value: 'bearbeitet', className: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]' },
          { label: '⚠ Korrektur', value: 'korrektur', className: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
          { label: '✗ Problem', value: 'problem', className: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]' },
        ].map((item) => {
          const active = hoof.work_status === item.value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                onChange({
                  work_status: active ? null : item.value,
                })
              }
              className={[
                'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                active
                  ? item.className
                  : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#154226]',
              ].join(' ')}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="min-w-[55px] text-[11px] font-medium text-[#6B7280]">Winkel</span>
          <input
            type="number"
            inputMode="decimal"
            value={hoof.angle_deg ?? ''}
            onChange={(e) =>
              onChange({
                angle_deg: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-[52px] rounded-[6px] border border-[#E5E2DC] px-1.5 py-1 text-center text-[13px] font-semibold text-[#154226] outline-none focus:border-[#154226] focus:ring-2 focus:ring-[#154226]/15"
            placeholder="°"
          />
        </div>

        <div className="flex items-start gap-3">
          <span className="min-w-[55px] pt-1 text-[11px] font-medium text-[#6B7280]">Zehe</span>
          <div className="flex flex-wrap gap-1.5">
            {['gerade', 'lateral', 'medial', 'bessernd'].map((option) => {
              const active = hoof.toe_alignment === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({
                      toe_alignment: active ? null : option,
                    })
                  }
                  className={[
                    'rounded-[6px] border px-2 py-[3px] text-[10px] font-semibold transition',
                    active
                      ? 'border-[#154226] bg-[#edf3ef] text-[#0f301b]'
                      : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#154226]',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="min-w-[55px] pt-1 text-[11px] font-medium text-[#6B7280]">Trachten</span>
          <div className="flex flex-wrap gap-1.5">
            {['ausgeglichen', 'med. kürzer', 'lat. kürzer', 'untergeschoben'].map((option) => {
              const active = hoof.heel_balance === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({
                      heel_balance: active ? null : option,
                    })
                  }
                  className={[
                    'rounded-[6px] border px-2 py-[3px] text-[10px] font-semibold transition',
                    active
                      ? 'border-[#154226] bg-[#edf3ef] text-[#0f301b]'
                      : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#154226]',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="min-w-[55px] pt-1 text-[11px] font-medium text-[#6B7280]">Sohle</span>
          <div className="flex flex-wrap gap-1.5">
            {['stabil', 'dünn', 'flach', 'gewölbt'].map((option) => {
              const active = hoof.sole_condition === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({
                      sole_condition: active ? null : option,
                    })
                  }
                  className={[
                    'rounded-[6px] border px-2 py-[3px] text-[10px] font-semibold transition',
                    active
                      ? 'border-[#154226] bg-[#edf3ef] text-[#0f301b]'
                      : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#154226]',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="min-w-[55px] pt-1 text-[11px] font-medium text-[#6B7280]">Strahl</span>
          <div className="flex flex-wrap gap-1.5">
            {['gesund', 'eng', 'faulig', 'rissig'].map((option) => {
              const active = hoof.frog_condition === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({
                      frog_condition: active ? null : option,
                    })
                  }
                  className={[
                    'rounded-[6px] border px-2 py-[3px] text-[10px] font-semibold transition',
                    active
                      ? 'border-[#154226] bg-[#edf3ef] text-[#0f301b]'
                      : 'border-[#E5E2DC] bg-white text-[#9CA3AF] hover:border-[#154226]',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
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
                    step.done ? 'bg-[#34A853]' : 'bg-[#E5E2DC]',
                  ].join(' ')}
                />
              )}

              <div
                className={[
                  'z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[12px]',
                  step.done
                    ? 'border-[#34A853] bg-[#34A853] text-white'
                    : step.current
                      ? 'border-[#154226] bg-[#edf3ef] text-[#154226]'
                      : 'border-[#E5E2DC] bg-white text-[#6B7280]',
                ].join(' ')}
              >
                {step.done ? '✓' : index + 1}
              </div>

              <div className="flex-1">
                <div
                  className={[
                    'text-[13px] font-medium',
                    step.done
                      ? 'text-[#34A853]'
                      : step.current
                        ? 'text-[#154226]'
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
  const [generalCondition, setGeneralCondition] = useState(initialGeneralCondition ?? 'Gut')
  const [gait, setGait] = useState(initialGait ?? 'Frei / gleichmäßig')
  const [handlingBehavior, setHandlingBehavior] = useState(initialHandlingBehavior ?? 'Kooperativ')
  const [hornQuality, setHornQuality] = useState(initialHornQuality ?? 'Gut')

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
  const router = useRouter()

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
        router.push(`/horses/${horse.id}/records/${editRecordId}`)
      } finally {
        setSubmitting(false)
      }
      return
    }
    setSubmitting(true)
    try {
      const result = await saveAction(fd)
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
      router.push(`/horses/${horse.id}/records/${recordId}`)
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
    const phrases = [...selectedWorkPhrases, ...selectedFindingPhrases].join(' ')
    return [phrases, summaryText.trim()].filter(Boolean).join(' ').trim()
  }, [selectedWorkPhrases, selectedFindingPhrases, summaryText])

  const combinedRecommendation = useMemo(() => {
    const phrases = selectedRecommendationPhrases.join(' ')
    return [phrases, recommendationText.trim()].filter(Boolean).join(' ').trim()
  }, [selectedRecommendationPhrases, recommendationText])

  const hoofArray = useMemo(() => Object.values(hoofs), [hoofs])

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
    <form onSubmit={handleSubmit} className="grid w-full gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
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

      <div className="space-y-5">
        <div className="mb-5 flex items-center gap-2 text-[13px] text-[#6B7280]">
          {isEdit ? (
            <>
              <a href={`/horses/${horse.id}`} className="text-[#154226] hover:underline">
                {horse.name}
              </a>
              <span>›</span>
              <a href={`/horses/${horse.id}/records/${editRecordId}`} className="text-[#154226] hover:underline">
                {formatGermanDate(recordDate)}
              </a>
              <span>›</span>
              <span>Dokumentation bearbeiten</span>
            </>
          ) : (
            <>
              <span className="text-[#154226]">Termine</span>
              <span>›</span>
              <span className="text-[#154226]">
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
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#edf3ef] text-[28px]">
                🐴
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
                    className="mt-1 rounded-lg border border-[#E5E2DC] px-3 py-2 text-[14px] font-semibold text-[#1B1F23] focus:border-[#154226] focus:outline-none focus:ring-2 focus:ring-[#154226]/20"
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
                <div className="mt-1 text-[14px] font-semibold text-[#154226]">
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
            icon="👁"
            title="Allgemeiner Eindruck"
            hint="Antippen statt tippen"
            iconClassName="bg-[#DCFCE7] text-[#166534]"
          />

          <div className="space-y-4 px-[22px] py-5">
            <div className="mb-4 last:mb-0">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Allgemeinzustand
              </div>
              <SingleChoiceChips
                options={GENERAL_CONDITION_OPTIONS}
                value={generalCondition}
                onChange={setGeneralCondition}
                color="green"
              />
            </div>

            <div className="mb-4 last:mb-0">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Gangbild
              </div>
              <SingleChoiceChips
                options={GAIT_OPTIONS}
                value={gait}
                onChange={setGait}
                color="green"
              />
            </div>

            <div className="mb-4 last:mb-0">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Verhalten beim Aufheben
              </div>
              <SingleChoiceChips
                options={HANDLING_OPTIONS}
                value={handlingBehavior}
                onChange={setHandlingBehavior}
                color="green"
              />
            </div>

            <div className="mb-4 last:mb-0">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Hornqualität insgesamt
              </div>
              <SingleChoiceChips
                options={HORN_OPTIONS}
                value={hornQuality}
                onChange={setHornQuality}
                color="green"
              />
            </div>
          </div>
        </section>

        <section className="huf-card huf-card--lg">
          <SectionHeader
            icon="🦶"
            title="Hufbefund pro Huf"
            hint="Tippe den Huf an zum Ausfüllen"
            iconClassName="bg-[#edf3ef] text-[#154226]"
          />

          <div className="space-y-5 px-[22px] py-5">
            <div className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
              — Vorne —
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
              — Hinten —
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
          </div>
        </section>

        <section className="huf-card huf-card--lg">
          <SectionHeader
            icon="📷"
            title={isEdit ? 'Fotos' : 'Fotos aufnehmen'}
            hint={isEdit ? 'Bestehende anzeigen oder neue hochladen' : 'Tippe einen Slot an zum Hochladen'}
            iconClassName="bg-[#EDE9FE] text-[#7C3AED]"
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
            icon="✂️"
            title="Maßnahmen & Beobachtungen"
            hint="Textbausteine antippen"
            iconClassName="bg-[#FEF3C7] text-[#D97706]"
          />

          <div className="space-y-5 px-[22px] py-5">
            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Beobachtungen / Verlauf
              </label>
              <textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                rows={4}
                className="huf-input huf-input--multiline leading-6"
                placeholder="Beobachtungen, Verlauf, Besonderheiten …"
              />
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Bearbeitung
              </div>
              <TogglePhraseRow
                phrases={workBlocks}
                selected={selectedWorkPhrases}
                onToggle={(label) =>
                  togglePhrase(label, selectedWorkPhrases, setSelectedWorkPhrases)
                }
              />
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Befund / Beobachtung
              </div>
              <TogglePhraseRow
                phrases={findingBlocks}
                selected={selectedFindingPhrases}
                onToggle={(label) =>
                  togglePhrase(label, selectedFindingPhrases, setSelectedFindingPhrases)
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Empfehlung / Nächste Schritte
              </label>
              <textarea
                value={recommendationText}
                onChange={(e) => setRecommendationText(e.target.value)}
                rows={3}
                className="huf-input huf-input--multiline leading-6"
                placeholder="Empfehlungen, Intervall, Hinweise …"
              />
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Empfehlung
              </div>
              <TogglePhraseRow
                phrases={recommendationBlocks}
                selected={selectedRecommendationPhrases}
                onToggle={(label) =>
                  togglePhrase(
                    label,
                    selectedRecommendationPhrases,
                    setSelectedRecommendationPhrases
                  )
                }
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
                      : 'border-[#E5E2DC] bg-white hover:border-[#154226]',
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
                    ✓
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
              href={isEdit ? `/horses/${horse.id}/records/${editRecordId}` : `/horses/${horse.id}`}
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
                  ✓ Dokumentation abschließen
                </button>
              </>
            )}
          </div>
        </div>
      </div>

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
    </form>
  )
}