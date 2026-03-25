'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { createRecord, updateRecord } from '@/app/(app)/horses/[id]/records/actions'
import MinimalRichEditor from '@/components/records/MinimalRichEditor'
import VoiceRecorder from '@/components/VoiceRecorder'
import ImproveTextButton from '@/components/ImproveTextButton'
import { processVoiceCommand, applyVoiceCommand } from '@/lib/voiceCommands'
import type { TherapyType } from '@/lib/aiFormatter'
import type { PreservedHoofRecordFields } from '@/components/records/TherapyRecordForm'

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

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  customers?:
    | { name: string | null; stable_name: string | null }
    | { name: string | null; stable_name: string | null }[]
    | null
}

type Props = {
  horseId: string
  recordId?: string
  mode?: 'create' | 'edit'
  therapyAiType: TherapyType
}

export default function MobileTherapyRecordForm({
  horseId,
  recordId,
  mode = 'create',
  therapyAiType,
}: Props) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  const today = new Date().toISOString().slice(0, 10)

  const [horse, setHorse] = useState<Horse | null>(null)
  const [recordDate, setRecordDate] = useState(today)
  const [summaryText, setSummaryText] = useState('')
  const [recommendationText, setRecommendationText] = useState('')
  const [preserved, setPreserved] = useState<PreservedHoofRecordFields | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: h } = await supabase
        .from('horses')
        .select('id, name, breed, sex, birth_year, customers(name, stable_name)')
        .eq('id', horseId)
        .eq('user_id', user.id)
        .single()
      if (h) setHorse(h as unknown as Horse)

      if (isEdit && recordId) {
        const { data: rec } = await supabase
          .from('hoof_records')
          .select(
            'record_date, hoof_condition, treatment, notes, general_condition, gait, handling_behavior, horn_quality, hoofs_json, checklist_json'
          )
          .eq('id', recordId)
          .eq('user_id', user.id)
          .single()
        if (rec) {
          if (rec.record_date) setRecordDate(rec.record_date.slice(0, 10))
          if (rec.hoof_condition) setSummaryText(rec.hoof_condition)
          if (rec.treatment) setRecommendationText(rec.treatment)
          setPreserved({
            general_condition: rec.general_condition ?? null,
            gait: rec.gait ?? null,
            handling_behavior: rec.handling_behavior ?? null,
            horn_quality: rec.horn_quality ?? null,
            hoofs_json: rec.hoofs_json ?? null,
            checklist_json: rec.checklist_json ?? null,
            notes: rec.notes ?? null,
          })
        }
      }
    }
    load()
  }, [horseId, recordId, isEdit, router])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('record_date', recordDate)
      fd.set('summary_notes', summaryText)
      fd.set('recommendation_notes', recommendationText)

      if (preserved) {
        fd.set('general_condition', preserved.general_condition ?? '')
        fd.set('gait', preserved.gait ?? '')
        fd.set('handling_behavior', preserved.handling_behavior ?? '')
        fd.set('horn_quality', preserved.horn_quality ?? '')
        fd.set(
          'hoofs_json',
          preserved.hoofs_json != null ? JSON.stringify(preserved.hoofs_json) : ''
        )
        fd.set(
          'checklist_json',
          preserved.checklist_json != null ? JSON.stringify(preserved.checklist_json) : ''
        )
        fd.set('notes', preserved.notes ?? '')
      }

      let targetId: string
      if (isEdit && recordId) {
        await updateRecord(horseId, recordId, fd)
        targetId = recordId
      } else {
        fd.set('horse_id', horseId)
        const result = await createRecord(fd)
        if (result && 'error' in result) {
          setError(result.error)
          return
        }
        if (!result?.recordId) return
        targetId = result.recordId
      }

      router.refresh()
      router.push(`/horses/${horseId}/records/${targetId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSubmitting(false)
    }
  }, [
    horseId,
    recordDate,
    summaryText,
    recommendationText,
    preserved,
    isEdit,
    recordId,
    router,
  ])

  const horseName = horse?.name ?? '…'
  const horseMeta = [
    horse?.breed,
    horse?.sex,
    horse?.birth_year ? `${new Date().getFullYear() - horse.birth_year} J.` : null,
    (Array.isArray(horse?.customers) ? horse?.customers[0] : horse?.customers)?.name,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mobile-record-form mobile-therapy-record">
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="cd-hero">
          <div className="cd-info min-w-0 flex-1">
            <div className="cd-name">Therapie · {horseName}</div>
            <div className="cd-meta">{horseMeta && <span>{horseMeta}</span>}</div>
          </div>
        </div>
      </header>

      <div className="cd-action-row flex gap-2">
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

      <div className="px-4 pb-28 pt-2 space-y-4">
        <div className="mrf-card">
          <div className="mrf-s-header">
            <div className="mrf-s-title">
              <span className="mrf-s-icon">
                <i className="bi bi-calendar3" />
              </span>
              Datum
            </div>
          </div>
          <div className="mrf-s-body">
            <input
              type="date"
              className="w-full rounded-xl border border-[#E5E2DC] bg-white px-3 py-2.5 text-[15px]"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mrf-card">
          <div className="mrf-s-header">
            <div className="mrf-s-title">
              <span className="mrf-s-icon">
                <i className="bi bi-file-earmark-richtext-fill" />
              </span>
              Hauptnotiz
            </div>
            <span className="mrf-s-hint">Befund &amp; Maßnahmen</span>
          </div>
          <div className="mrf-s-body" style={{ gap: 12 }}>
            <MinimalRichEditor
              value={summaryText}
              onChange={setSummaryText}
              placeholder="Befund und dokumentierte Maßnahmen …"
              minRows={5}
            />
            <div className="mrf-summary-actions">
              <VoiceRecorder
                therapyType={therapyAiType}
                animalName={horse?.name ?? undefined}
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

        <div className="mrf-card">
          <div className="mrf-s-header">
            <div className="mrf-s-title">
              <span className="mrf-s-icon">
                <i className="bi bi-chat-heart-fill" />
              </span>
              Empfehlungen
            </div>
            <span className="mrf-s-hint">optional</span>
          </div>
          <div className="mrf-s-body" style={{ gap: 12 }}>
            <MinimalRichEditor
              value={recommendationText}
              onChange={setRecommendationText}
              placeholder="Empfehlungen für die Haltung, Übungen …"
              minRows={4}
            />
            <div className="mrf-summary-actions">
              <VoiceRecorder
                therapyType={therapyAiType}
                animalName={horse?.name ?? undefined}
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
                className="flex-1"
                buttonLabel="Einsprechen"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1B1F23] active:scale-[0.97]"
              />
              <ImproveTextButton
                value={stripHtml(recommendationText ?? '')}
                animalName={horse?.name ?? undefined}
                onImproved={(improved) => setRecommendationText(wrapAsHtml(improved))}
                className="flex-1"
                buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E2DC] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1B1F23] active:scale-[0.97]"
              />
            </div>
          </div>
        </div>

        {error && <div className="mrf-error">{error}</div>}
      </div>
    </div>
  )
}
