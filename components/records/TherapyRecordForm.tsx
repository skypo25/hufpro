'use client'

import { useCallback, useState } from 'react'
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

export type TherapyHorseContext = {
  id: string
  name: string
  customerName: string
  stableName: string | null
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

  if (!horse) {
    return (
      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-6 text-[14px] text-[#6B7280]">
        Pferd konnte nicht geladen werden. Bitte zurückgehen und erneut versuchen.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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

      <div className="mb-1 flex flex-wrap items-center gap-2 text-[13px] text-[#6B7280]">
        {isEdit ? (
          <>
            <Link href={`/animals/${horse.id}`} className="text-[#52b788] hover:underline">
              {horse.name}
            </Link>
            <span>›</span>
            <Link
              href={`/animals/${horse.id}/records/${editRecordId}`}
              className="text-[#52b788] hover:underline"
            >
              {formatGermanDate(recordDate)}
            </Link>
            <span>›</span>
            <span>Therapie dokumentieren</span>
          </>
        ) : (
          <>
            <Link href={`/animals/${horse.id}`} className="text-[#52b788] hover:underline">
              {horse.name}
            </Link>
            <span>›</span>
            <span>Neue Therapiedokumentation</span>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-[#1B1F23]">
          Therapiedokumentation · {horse.name}
        </h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {horse.customerName}
          {horse.stableName ? ` · ${horse.stableName}` : ''}
        </p>
        {!isEdit && lastRecord?.date && (
          <p className="mt-3 text-[13px] text-[#6B7280]">
            Letzter Eintrag: {formatGermanDate(lastRecord.date)}
            {lastRecord.text ? ` — ${lastRecord.text.slice(0, 120)}${lastRecord.text.length > 120 ? '…' : ''}` : ''}
          </p>
        )}
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-5 shadow-sm">
        <label className="mb-2 block text-[13px] font-medium text-[#374151]" htmlFor="therapy-record-date">
          Datum
        </label>
        <input
          id="therapy-record-date"
          type="date"
          className="w-full max-w-[240px] rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[14px] text-[#1B1F23] focus:border-[#52b788] focus:outline-none focus:ring-1 focus:ring-[#52b788]"
          value={recordDate}
          onChange={(e) => setRecordDate(e.target.value)}
          required
        />
      </div>

      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#1B1F23]">Hauptnotiz</h2>
          <span className="text-[12px] text-[#9CA3AF]">Befund, Behandlung, Verlauf</span>
        </div>
        <MinimalRichEditor
          value={summaryText}
          onChange={setSummaryText}
          placeholder="Befund und dokumentierte Maßnahmen …"
          minRows={6}
        />
        <div className="mt-3 flex flex-wrap gap-2">
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
            className="flex-1 min-w-[140px]"
          />
          <ImproveTextButton
            value={stripHtml(summaryText ?? '')}
            animalName={horse.name}
            onImproved={(improved) => setSummaryText(wrapAsHtml(improved))}
            className="flex-1 min-w-[140px]"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#1B1F23]">Empfehlungen</h2>
          <span className="text-[12px] text-[#9CA3AF]">optional</span>
        </div>
        <MinimalRichEditor
          value={recommendationText}
          onChange={setRecommendationText}
          placeholder="Empfehlungen für die Haltung, Übungen, Wiedervorlage …"
          minRows={4}
        />
        <div className="mt-3 flex flex-wrap gap-2">
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
            className="flex-1 min-w-[140px]"
          />
          <ImproveTextButton
            value={stripHtml(recommendationText ?? '')}
            animalName={horse.name}
            onImproved={(improved) => setRecommendationText(wrapAsHtml(improved))}
            className="flex-1 min-w-[140px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pb-8">
        <Link
          href={isEdit && editRecordId ? `/animals/${horse.id}/records/${editRecordId}` : `/animals/${horse.id}`}
          className="rounded-xl border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#374151] hover:bg-[#FAFAF8]"
        >
          Abbrechen
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#52b788] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#459e74] disabled:opacity-60"
        >
          {submitting ? 'Wird gespeichert…' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}
