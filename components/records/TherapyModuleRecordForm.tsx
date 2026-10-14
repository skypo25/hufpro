'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import MinimalRichEditor from '@/components/records/MinimalRichEditor'
import VoiceRecorder from '@/components/VoiceRecorder'
import ImproveTextButton from '@/components/ImproveTextButton'
import BodyMapEditor, { type BodyMapState } from '@/components/bodyMap/BodyMapEditor'
import {
  MODULE_CATALOG,
  type DocumentationModuleId,
} from '@/lib/modules'
import {
  therapyAiTypeForModule,
  therapySectionsForModule,
} from '@/lib/modules/therapyTemplates'
import { processVoiceCommand, applyVoiceCommand } from '@/lib/voiceCommands'

type TherapyHorseContext = {
  id: string
  name: string
  breed: string | null
  sex: string | null
  birthYear: number | null
  customerName: string
  stableName: string | null
  memo: string | null
}

type LastRecord = { date: string | null; text: string } | null

type Props = {
  horse: TherapyHorseContext | null
  animalType: string | null | undefined
  moduleId: DocumentationModuleId
  defaultRecordDate: string
  defaultRecordType?: string
  appointmentId?: string | null
  lastRecord: LastRecord
  saveAction: (formData: FormData) => Promise<{ recordId: string } | { error: string } | void>
}

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

function Collapsible({
  title,
  optional,
  defaultOpen,
  children,
}: {
  title: string
  optional?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <section className="content-card content-card--lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-[#E5E2DC] px-[22px] py-4 text-left"
      >
        <h3 className="dashboard-serif flex-1 text-[15px] font-medium text-[#1B1F23]">{title}</h3>
        {optional ? <span className="text-[11px] text-[#9CA3AF]">optional</span> : null}
        <i className={`bi bi-chevron-${open ? 'up' : 'down'} text-[#9CA3AF]`} aria-hidden />
      </button>
      {open ? <div className="space-y-4 px-[22px] py-4">{children}</div> : null}
    </section>
  )
}

export default function TherapyModuleRecordForm({
  horse,
  animalType,
  moduleId,
  defaultRecordDate,
  defaultRecordType = 'Regeltermin',
  appointmentId = null,
  lastRecord,
  saveAction,
}: Props) {
  const router = useRouter()
  const def = MODULE_CATALOG[moduleId]
  const sections = useMemo(
    () => therapySectionsForModule(moduleId, animalType),
    [moduleId, animalType]
  )
  const therapyAiType = therapyAiTypeForModule(moduleId)

  const [recordDate, setRecordDate] = useState(defaultRecordDate)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [openBodyMap, setOpenBodyMap] = useState(false)
  const [bodyMap, setBodyMap] = useState<BodyMapState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const setField = useCallback((id: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!horse) return
      const summary =
        fieldValues.session_notes ||
        fieldValues.chief_complaint ||
        Object.values(fieldValues).find((v) => stripHtml(v).length > 0) ||
        ''
      const recommendation =
        fieldValues.recommendations || fieldValues.interventions || fieldValues.treatment_plan || ''

      const fd = new FormData()
      fd.set('horse_id', horse.id)
      fd.set('record_date', recordDate)
      fd.set('record_type', defaultRecordType)
      if (appointmentId) fd.set('appointment_id', appointmentId)
      fd.set('summary_notes', summary)
      fd.set('recommendation_notes', recommendation)
      fd.set('documentation_module', moduleId)
      fd.set(
        'therapy_payload_json',
        JSON.stringify({
          schema_version: 1,
          module_id: moduleId,
          animal_type: animalType ?? 'horse',
          sections: fieldValues,
          body_map: bodyMap,
        })
      )

      setSubmitting(true)
      setMessage('')
      try {
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
    [
      horse,
      recordDate,
      defaultRecordType,
      appointmentId,
      fieldValues,
      moduleId,
      animalType,
      bodyMap,
      saveAction,
      router,
    ]
  )

  if (!horse) {
    return (
      <div className="content-card content-card--lg p-6 text-[14px] text-[#6B7280]">
        Tier konnte nicht geladen werden.
      </div>
    )
  }

  const showBodyMap =
    def.supportsBodyMap &&
    ['horse', 'dog', 'cat'].includes((animalType ?? 'horse').toLowerCase())

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-5">
      {message ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <div className="content-card content-card--lg px-6 py-5">
        <div className="text-[12px] font-medium uppercase tracking-wide text-primary">
          {def.label}
        </div>
        <h1 className="dashboard-serif mt-1 text-[22px] font-medium text-[#1B1F23]">
          {horse.name}
        </h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {[horse.breed, horse.sex, horse.customerName].filter(Boolean).join(' · ')}
        </p>
        <label className="mt-4 block text-[12px] text-[#6B7280]">
          Datum
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-[#E5E2DC] px-3 py-2 text-[14px]"
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
          />
        </label>
        {lastRecord?.text ? (
          <p className="mt-3 text-[12px] text-[#9CA3AF]">
            Letzter Eintrag: {lastRecord.text.slice(0, 160)}
            {lastRecord.text.length > 160 ? '…' : ''}
          </p>
        ) : null}
      </div>

      {sections.map((section, idx) => (
        <Collapsible
          key={section.id}
          title={section.title}
          optional={section.optional}
          defaultOpen={idx < 2}
        >
          {section.fields.map((field) => {
            const value = fieldValues[field.id] ?? ''
            return (
              <div key={field.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[13px] font-medium text-[#1B1F23]">{field.label}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <VoiceRecorder
                      therapyType={therapyAiType}
                      animalName={horse.name}
                      onResult={(text) => {
                        const cmd = processVoiceCommand(text, value ?? '')
                        applyVoiceCommand(
                          cmd,
                          value ?? '',
                          (html) => setField(field.id, html),
                          (plain) => {
                            const para = `<p>${plain}</p>`
                            setField(field.id, value ? `${value}${para}` : para)
                          }
                        )
                      }}
                      buttonLabel="Einsprechen"
                      buttonClassName="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold"
                    />
                    <ImproveTextButton
                      value={stripHtml(value)}
                      animalName={horse.name}
                      onImproved={(text) => setField(field.id, wrapAsHtml(text))}
                      buttonClassName="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold"
                    />
                  </div>
                </div>
                <MinimalRichEditor
                  value={value}
                  onChange={(html) => setField(field.id, html)}
                  placeholder={field.hint ?? 'Befund oder Notiz…'}
                />
              </div>
            )
          })}
        </Collapsible>
      ))}

      {showBodyMap ? (
        <Collapsible title="Körperkarte" optional defaultOpen={false}>
          <p className="text-[13px] text-[#6B7280]">
            Optional: Markierungen auf der Platzhalter-Ansicht (Pferd/Hund/Katze). Später durch
            anatomische Grafiken ersetzbar.
          </p>
          {!openBodyMap ? (
            <button
              type="button"
              className="rounded-lg border border-[#E5E2DC] px-4 py-2 text-[14px] font-medium text-[#1B1F23] hover:border-primary"
              onClick={() => setOpenBodyMap(true)}
            >
              Körperkarte öffnen
            </button>
          ) : (
            <BodyMapEditor
              animalType={(animalType ?? 'horse').toLowerCase() as 'horse' | 'dog' | 'cat'}
              value={bodyMap}
              onChange={setBodyMap}
            />
          )}
        </Collapsible>
      ) : null}

      <div className="flex justify-end gap-3 pb-8">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-primary px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Speichern…' : 'Dokumentation speichern'}
        </button>
      </div>
    </form>
  )
}
