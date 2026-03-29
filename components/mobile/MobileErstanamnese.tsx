'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useAppProfile } from '@/context/AppProfileContext'
import { formatAnimalTypeLabel } from '@/lib/animalTypeDisplay'
import {
  clinicalFirstContextHasContent,
  clinicalIntakeTimestampsFromIntake,
  erstanamneseDateLeadForMeta,
  legacyFlatFromHorseIntake,
  resolveClinicalForForm,
} from '@/lib/animals/clinicalIntakeTypes'
import { ErstanamneseReadOnly } from '@/components/animals/ErstanamneseReadOnly'

export default function MobileErstanamnese({ horseId }: { horseId: string }) {
  const router = useRouter()
  const { profile, loading: profileLoading } = useAppProfile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [horseRow, setHorseRow] = useState<{
    name: string | null
    animal_type: string | null
  } | null>(null)
  const [clinical, setClinical] = useState<ReturnType<typeof resolveClinicalForForm> | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (profileLoading) return
    if (profile.isHufbearbeiter) {
      router.replace(`/animals/${horseId}`)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setError('Nicht angemeldet.')
        setLoading(false)
        return
      }
      const { data: horse, error: qErr } = await supabase
        .from('horses')
        .select('id, name, animal_type, intake, special_notes')
        .eq('id', horseId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (qErr || !horse) {
        setError(qErr?.message ?? 'Tier nicht gefunden.')
        setLoading(false)
        return
      }
      const c = resolveClinicalForForm(horse.intake, legacyFlatFromHorseIntake(horse))
      const ts = clinicalIntakeTimestampsFromIntake(horse.intake)
      setHorseRow({
        name: horse.name,
        animal_type: horse.animal_type ?? null,
      })
      setClinical(c)
      setCreatedAt(ts.createdAt)
      setUpdatedAt(ts.updatedAt)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [horseId, profile.isHufbearbeiter, profileLoading, router])

  const backHref = `/animals/${horseId}`
  const editHref = `/animals/${horseId}/erstanamnese/edit`
  const backToAkteLabel = profile.terminology === 'pferd' ? 'Zurück zur Pferdeakte' : 'Zurück zur Tierakte'
  const nameFallback = profile.terminology === 'pferd' ? 'Pferd' : 'Tier'

  const metaLine = useMemo(() => {
    if (!horseRow) return ''
    const hasContent =
      clinical != null && clinicalFirstContextHasContent(clinical)
    const dateLead = erstanamneseDateLeadForMeta(
      hasContent,
      createdAt,
      updatedAt
    )
    const parts = [
      dateLead,
      horseRow.name?.trim() || nameFallback,
      formatAnimalTypeLabel(horseRow.animal_type),
    ].filter(Boolean)
    return parts.join(' · ')
  }, [horseRow, nameFallback, clinical, createdAt, updatedAt])

  if (profileLoading || loading || (!clinical && !error)) {
    return (
      <>
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <div className="cd-hero flex !items-start gap-3">
            <div className="cd-info min-w-0 flex-1">
              <div className="cd-name">Erstanamnese</div>
              <div className="cd-meta">
                <span className="text-white/35">Wird geladen…</span>
              </div>
            </div>
          </div>
        </header>
      </>
    )
  }

  if (error || !clinical || !horseRow) {
    return (
      <>
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <div className="cd-hero flex !items-start gap-3">
            <div className="cd-info min-w-0 flex-1">
              <div className="cd-name">Erstanamnese</div>
            </div>
          </div>
        </header>
        <div className="mobile-content px-4 py-6 text-[14px] text-red-700">{error ?? 'Fehler'}</div>
      </>
    )
  }

  const hasContent = clinicalFirstContextHasContent(clinical)

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="cd-hero flex !items-start gap-3">
          <div className="cd-info min-w-0 flex-1">
            <div className="cd-name leading-tight">Erstanamnese</div>
            {metaLine ? (
              <div className="cd-meta mt-1">
                <span className="whitespace-normal break-words">{metaLine}</span>
              </div>
            ) : null}
          </div>
          <Link href={editHref} className="cd-edit shrink-0" aria-label="Anamnese bearbeiten">
            <i className="bi bi-gear-fill" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="cd-action-row flex gap-2">
        <Link href={backHref} className="cd-action-btn flex flex-1 items-center justify-center gap-1.5">
          <i className="bi bi-file-earmark-plus text-[15px]" aria-hidden />
          {backToAkteLabel}
        </Link>
      </div>

      <div className="mobile-content px-4 pb-28 pt-2">
        {!hasContent && (
          <div className="mb-4 rounded-xl border border-[#E5E2DC] bg-[#fafaf9] px-4 py-3 text-[13px] text-[#6B7280]">
            Noch keine Erstanamnese erfasst. Tippe auf das <strong className="text-[#1B1F23]">Zahnrad</strong>, um
            die Anamnese zu bearbeiten, oder trage sie beim Anlegen des Tieres ein.
          </div>
        )}

        <div className="space-y-4 [&_.huf-card]:shadow-[0_1px_3px_rgba(0,0,0,.06)]">
          <ErstanamneseReadOnly clinical={clinical} />
        </div>
      </div>
    </>
  )
}
