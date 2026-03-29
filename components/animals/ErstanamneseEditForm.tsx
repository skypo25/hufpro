'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import type { ClinicalFirstContext } from '@/lib/animals/clinicalIntakeTypes'
import { mergeIntakeWithClinical } from '@/lib/animals/mergeIntakeClinical'
import {
  ClinicalBlockAnamnesis,
  ClinicalBlockHistory,
  ClinicalBlockLocomotion,
} from '@/components/animals/AnimalFachlicherErstkontext'

type Props = {
  horseId: string
  initialClinical: ClinicalFirstContext
  backHref: string
}

export default function ErstanamneseEditForm({ horseId, initialClinical, backHref }: Props) {
  const router = useRouter()
  const [clinical, setClinical] = useState<ClinicalFirstContext>(() =>
    JSON.parse(JSON.stringify(initialClinical)) as ClinicalFirstContext
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError('Nicht angemeldet.')
      return
    }

    const { data: row, error: fetchErr } = await supabase
      .from('horses')
      .select('intake')
      .eq('id', horseId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchErr || !row) {
      setSaving(false)
      setError(fetchErr?.message ?? 'Tier konnte nicht geladen werden.')
      return
    }

    const mergedIntake = mergeIntakeWithClinical(row.intake, clinical, {
      now: new Date().toISOString(),
    })
    const ownerObs = clinical.anamnesis.more.ownerObservations.trim() || null

    const { error: upErr } = await supabase
      .from('horses')
      .update({
        intake: mergedIntake,
        special_notes: ownerObs,
      })
      .eq('id', horseId)
      .eq('user_id', user.id)

    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    router.push(backHref)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-5 py-3.5 text-[13px] text-[#1E40AF]">
        Hier bearbeitest du nur die <strong>Erstanamnese</strong> (fachliche Erstaufnahme).{' '}
        <strong>Interne Notizen</strong> bleiben unverändert — du findest sie in der Tierbearbeitung.
      </div>

      <section className="huf-card">
        <div className="border-b border-[#E5E2DC] px-6 py-[18px]">
          <h2 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">Allgemeine Anamnese</h2>
        </div>
        <div className="p-6">
          <ClinicalBlockAnamnesis value={clinical} onChange={setClinical} />
        </div>
      </section>

      <section className="huf-card">
        <div className="border-b border-[#E5E2DC] px-6 py-[18px]">
          <h2 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">
            Bewegungsapparat / Funktion
          </h2>
        </div>
        <div className="p-6">
          <ClinicalBlockLocomotion value={clinical} onChange={setClinical} />
        </div>
      </section>

      <section className="huf-card">
        <div className="border-b border-[#E5E2DC] px-6 py-[18px]">
          <h2 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">
            Vorgeschichte / strukturelle Auffälligkeiten
          </h2>
        </div>
        <div className="p-6">
          <ClinicalBlockHistory value={clinical} onChange={setClinical} />
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E2DC] pt-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#6B7280] hover:bg-black/5"
        >
          ← Abbrechen
        </Link>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#0f301b] disabled:opacity-50"
        >
          <i className="bi bi-check-lg" /> {saving ? 'Speichere…' : 'Erstanamnese speichern'}
        </button>
      </div>
    </div>
  )
}
