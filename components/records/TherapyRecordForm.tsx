'use client'

import { useCallback, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MinimalRichEditor from '@/components/records/MinimalRichEditor'
import VoiceRecorder from '@/components/VoiceRecorder'
import ImproveTextButton from '@/components/ImproveTextButton'
import { processVoiceCommand, applyVoiceCommand } from '@/lib/voiceCommands'
import type { TherapyType } from '@/lib/aiFormatter'

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function wrapAsHtml(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!paras.length) return ''
  return paras.map((p) => `<p>${p}</p>`).join('')
}

function formatGermanDate(ds: string | null | undefined): string {
  if (!ds) return '–'
  const d = new Date(ds)
  if (Number.isNaN(d.getTime())) return ds
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function formatAnimalMeta(horse: TherapyHorseContext) {
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

function hasText(html: string) {
  return stripHtml(html).length > 0
}

function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: ReactNode
  title: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-[22px] py-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-light text-[14px] text-primary">
        {icon}
      </div>
      <h3 className="dashboard-serif flex-1 text-[15px] font-medium text-[#1B1F23]">{title}</h3>
      {hint && <span className="text-[11px] text-[#9CA3AF]">{hint}</span>}
    </div>
  )
}

function TherapyProgressSidebar({
  summaryDone,
  recommendationDone,
  lastRecord,
  memo,
}: {
  summaryDone: boolean
  recommendationDone: boolean
  lastRecord: LastRecord
  memo: string | null | undefined
}) {
  const steps = [
    {
      done: summaryDone,
      current: !summaryDone,
      title: 'Hauptnotiz',
      sub: summaryDone ? 'Befund dokumentiert' : 'Befund, Behandlung, Verlauf',
    },
    {
      done: recommendationDone,
      current: summaryDone && !recommendationDone,
      title: 'Empfehlungen',
      sub: recommendationDone ? 'Empfehlung hinterlegt' : 'optional',
    },
  ]

  return (
    <div className="space-y-5">
      <section className="content-card content-card--lg">
        <div className="border-b border-[#E5E2DC] px-5 py-4">
          <h4 className="dashboard-serif text-[15px] font-medium text-[#1B1F23]">Fortschritt</h4>
        </div>
        <div className="space-y-0 px-5 py-[18px]">
          {steps.map((step, index, array) => (
            <div key={step.title} className="relative flex gap-3 py-3">
              {index < array.length - 1 && (
                <div
                  className={[
                    'absolute left-[15px] top-[38px] bottom-[-2px] w-[2px]',
                    step.done ? 'bg-primary' : 'bg-[#E5E2DC]',
                  ].join(' ')}
                />
              )}
              <div
                className={[
                  'z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold',
                  step.done
                    ? 'border-primary bg-primary text-white'
                    : step.current
                      ? 'border-primary bg-primary-light text-primary'
                      : 'border-[#E5E2DC] bg-[#F9FAFB] text-[#6B7280]',
                ].join(' ')}
              >
                {step.done ? <i className="bi bi-check text-[16px]" aria-hidden /> : index + 1}
              </div>
              <div className="flex-1">
                <div
                  className={[
                    'text-[13px] font-medium',
                    step.done || step.current ? 'text-primary' : 'text-[#1B1F23]',
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

      <section className="content-card content-card--lg">
        <div className="border-b border-[#E5E2DC] px-5 py-4">
          <h4 className="dashboard-serif text-[15px] font-medium text-[#1B1F23]">
            Letzter Befund{lastRecord?.date ? ` · ${formatGermanDate(lastRecord.date)}` : ''}
          </h4>
        </div>
        <div className="px-5 py-[18px] text-[13px] leading-[1.6] text-[#6B7280]">
          {lastRecord?.text ? lastRecord.text : <span>Für dieses Tier liegt noch kein älterer Befund vor.</span>}
        </div>
      </section>

      {memo ? (
        <section className="content-card content-card--lg content-card--accent-left-warning">
          <div className="border-b border-[#E5E2DC] px-5 py-4">
            <h4 className="dashboard-serif text-[15px] font-medium text-[#1B1F23]">📌 Merke für dieses Tier</h4>
          </div>
          <div className="px-5 py-[18px] text-[13px] leading-[1.6] text-[#6B7280]">{memo}</div>
        </section>
      ) : null}
    </div>
  )
}

export type TherapyHorseContext = {
  id: string
  name: string
  breed?: string | null
  sex?: string | null
  birthYear?: number | null
  customerName: string
  stableName: string | null
  memo?: string | null
}

export type PreservedHoofRecordFields = {
  general_condition: string | null
  gait: string | null
  handling_behavior: string | null
  horn_quality: string | null
  hoofs_json: unknown
  checklist_json: unknown
  notes: string | null
}

type LastRecord = { date: string | null; text: string } | null

export type TherapyRecordFormProps = {
  horse: TherapyHorseContext | null
  defaultRecordDate: string
  lastRecord?: LastRecord
  therapyAiType: TherapyType
  saveAction: (formData: FormData) => Promise<{ recordId: string } | { error: string } | void>
  mode?: 'create' | 'edit'
  recordId?: string
  initialRecordDate?: string
  initialSummaryNotes?: string
  initialRecommendationNotes?: string
  updateAction?: (horseId: string, recordId: string, formData: FormData) => Promise<void>
  /** Beim Bearbeiten: bestehende Huf-/Meta-Felder durchreichen, damit updateRecord sie nicht unbeabsichtigt leert. */
  preservedExtendedFields?: PreservedHoofRecordFields | null
}

export default function TherapyRecordForm({
  horse,
  defaultRecordDate,
  lastRecord,
  therapyAiType,
  saveAction,
  mode = 'create',
  recordId: editRecordId,
  initialRecordDate,
  initialSummaryNotes = '',
  initialRecommendationNotes = '',
  updateAction,
  preservedExtendedFields,
}: TherapyRecordFormProps) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  const [recordDate, setRecordDate] = useState(
    () => initialRecordDate?.slice(0, 10) ?? defaultRecordDate
  )
  const [summaryText, setSummaryText] = useState(initialSummaryNotes)
  const [recommendationText, setRecommendationText] = useState(initialRecommendationNotes)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!horse) return
      const form = e.currentTarget
      const fd = new FormData(form)

      setSubmitting(true)
      setMessage('')
      try {
        if (isEdit && updateAction && editRecordId) {
          await updateAction(horse.id, editRecordId, fd)
          router.refresh()
          router.push(`/animals/${horse.id}/records/${editRecordId}`)
          return
        }
        const result = await saveAction(fd)
        if (result && 'error' in result) {
          setMessage(result.error)
          return
        }
        const rid = result?.recordId
        if (!rid) return
        router.refresh()
        router.push(`/animals/${horse.id}/records/${rid}`)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
      } finally {
        setSubmitting(false)
      }
    },
    [horse, isEdit, updateAction, editRecordId, saveAction, router]
  )

  const preserve = isEdit && preservedExtendedFields
  const summaryDone = hasText(summaryText)
  const recommendationDone = hasText(recommendationText)

  if (!horse) {
    return (
      <div className="content-card content-card--lg p-6 text-[14px] text-[#6B7280]">
        Tier konnte nicht geladen werden. Bitte gehe zurück und versuche es erneut.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7 xl:grid xl:grid-cols-[1fr_340px] xl:items-start">
      {message ? (
        <div className="xl:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-5 xl:col-start-1 xl:row-start-2 min-w-0">
        <div className="hidden" aria-hidden>
          {!isEdit && (
            <>
              <input type="hidden" name="horse_id" value={horse.id} />
              <input type="hidden" name="record_date" value={recordDate} />
            </>
          )}
          {isEdit && <input type="hidden" name="record_date" value={recordDate} />}
          <input type="hidden" name="summary_notes" value={summaryText} />
          <input type="hidden" name="recommendation_notes" value={recommendationText} />
          {preserve && (
            <>
              <input
                type="hidden"
                name="general_condition"
                value={preservedExtendedFields.general_condition ?? ''}
              />
              <input type="hidden" name="gait" value={preservedExtendedFields.gait ?? ''} />
              <input
                type="hidden"
                name="handling_behavior"
                value={preservedExtendedFields.handling_behavior ?? ''}
              />
              <input
                type="hidden"
                name="horn_quality"
                value={preservedExtendedFields.horn_quality ?? ''}
              />
              <input
                type="hidden"
                name="hoofs_json"
                value={
                  preservedExtendedFields.hoofs_json != null
                    ? JSON.stringify(preservedExtendedFields.hoofs_json)
                    : ''
                }
              />
              <input
                type="hidden"
                name="checklist_json"
                value={
                  preservedExtendedFields.checklist_json != null
                    ? JSON.stringify(preservedExtendedFields.checklist_json)
                    : ''
                }
              />
              <input type="hidden" name="notes" value={preservedExtendedFields.notes ?? ''} />
            </>
          )}
        </div>

        <section className="content-card content-card--lg">
          <div className="flex flex-wrap items-center gap-5 px-6 py-5">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-primary-light text-[#154226]">
                <svg width="28" height="28" viewBox="0 0 576 512" fill="currentColor" className="shrink-0" aria-hidden>
                  <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="dashboard-serif truncate text-[22px] font-semibold text-[#1B1F23]">
                  {horse.name}
                </div>
                <div className="truncate text-[13px] text-[#6B7280]">{formatAnimalMeta(horse)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 md:gap-8">
              <div className={isEdit ? '' : 'text-right'}>
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
                  Datum
                </div>
                {isEdit ? (
                  <input
                    id="therapy-record-date"
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    required
                    className="mt-1 rounded-lg border border-[#E5E2DC] px-3 py-2 text-[14px] font-semibold text-[#1B1F23] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ) : (
                  <div className="mt-1 text-[14px] font-semibold text-[#1B1F23]">
                    {formatGermanDate(recordDate)}
                  </div>
                )}
              </div>

              <div className="hidden h-10 w-px bg-[#E5E2DC] md:block" />

              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
                  Terminart
                </div>
                <div className="mt-1 text-[14px] font-semibold text-primary">Therapietermin</div>
              </div>

              <div className="hidden h-10 w-px bg-[#E5E2DC] md:block" />

              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#9CA3AF]">
                  Letzter Termin
                </div>
                <div className="mt-1 text-[14px] font-semibold text-[#1B1F23]">
                  {lastRecord?.date ? formatGermanDate(lastRecord.date) : '–'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="content-card content-card--lg">
          <SectionHeader
            icon={<i className="bi bi-file-earmark-richtext-fill text-[14px]" aria-hidden />}
            title="Hauptnotiz"
            hint="Befund, Behandlung, Verlauf"
          />
          <div className="space-y-4 px-[22px] py-5">
            <MinimalRichEditor
              value={summaryText}
              onChange={setSummaryText}
              placeholder="Befund und dokumentierte Maßnahmen …"
              minRows={6}
            />
            <div className="grid grid-cols-2 gap-3">
              <VoiceRecorder
                therapyType={therapyAiType}
                animalName={horse.name}
                onResult={(text) => {
                  const cmd = processVoiceCommand(text, summaryText ?? '')
                  applyVoiceCommand(
                    cmd,
                    summaryText ?? '',
                    setSummaryText,
                    (plain) =>
                      setSummaryText((prev) => {
                        const para = `<p>${plain}</p>`
                        return prev ? `${prev}${para}` : para
                      })
                  )
                }}
                buttonLabel="Sprachnotiz"
                className="w-full"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-3 text-[13px] font-semibold text-[#1B1F23] transition hover:border-[#9CA3AF] active:scale-[0.98] disabled:opacity-60"
              />
              <ImproveTextButton
                value={stripHtml(summaryText ?? '')}
                animalName={horse.name}
                onImproved={(improved) => setSummaryText(wrapAsHtml(improved))}
                className="w-full"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-3 text-[13px] font-semibold text-[#1B1F23] transition hover:border-[#9CA3AF] active:scale-[0.98] disabled:opacity-50"
              />
            </div>
          </div>
        </section>

        <section className="content-card content-card--lg">
          <SectionHeader
            icon={<i className="bi bi-clipboard2-pulse-fill text-[14px]" aria-hidden />}
            title="Empfehlungen"
            hint="optional"
          />
          <div className="space-y-4 px-[22px] py-5">
            <MinimalRichEditor
              value={recommendationText}
              onChange={setRecommendationText}
              placeholder="Empfehlungen für die Haltung, Übungen, Wiedervorlage …"
              minRows={4}
            />
            <div className="grid grid-cols-2 gap-3">
              <VoiceRecorder
                therapyType={therapyAiType}
                animalName={horse.name}
                onResult={(text) => {
                  const cmd = processVoiceCommand(text, recommendationText ?? '')
                  applyVoiceCommand(
                    cmd,
                    recommendationText ?? '',
                    setRecommendationText,
                    (plain) =>
                      setRecommendationText((prev) => {
                        const para = `<p>${plain}</p>`
                        return prev ? `${prev}${para}` : para
                      })
                  )
                }}
                buttonLabel="Empfehlungen einsprechen"
                className="w-full"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-3 text-[13px] font-semibold text-[#1B1F23] transition hover:border-[#9CA3AF] active:scale-[0.98] disabled:opacity-60"
              />
              <ImproveTextButton
                value={stripHtml(recommendationText ?? '')}
                animalName={horse.name}
                onImproved={(improved) => setRecommendationText(wrapAsHtml(improved))}
                className="w-full"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-3 text-[13px] font-semibold text-[#1B1F23] transition hover:border-[#9CA3AF] active:scale-[0.98] disabled:opacity-50"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <Link
            href={isEdit && editRecordId ? `/animals/${horse.id}/records/${editRecordId}` : `/animals/${horse.id}`}
            className="ghost-button"
          >
            ← Abbrechen
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="primary-button primary-button--lg font-semibold disabled:opacity-60"
          >
            {submitting ? 'Wird gespeichert…' : isEdit ? 'Änderungen speichern' : 'Speichern'}
          </button>
        </div>
      </div>

      <div className="xl:col-start-2 xl:row-start-2">
        <TherapyProgressSidebar
          summaryDone={summaryDone}
          recommendationDone={recommendationDone}
          lastRecord={lastRecord ?? null}
          memo={horse.memo}
        />
      </div>
    </form>
  )
}
