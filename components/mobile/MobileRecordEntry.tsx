'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MobileRecordForm from '@/components/mobile/MobileRecordForm'
import TherapyModuleRecordForm from '@/components/records/TherapyModuleRecordForm'
import MobileModulePicker from '@/components/modules/MobileModulePicker'
import { createRecord } from '@/app/(app)/horses/[id]/records/actions'
import { supabase } from '@/lib/supabase-client'
import {
  isDocumentationModuleId,
  MODULE_CATALOG,
  resolveModulesForAnimal,
  type DocumentationModuleId,
} from '@/lib/modules'
type Props = {
  horseId: string
  recordId?: string
  mode?: 'create' | 'edit'
}

function todayIso() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type HorseCtx = {
  id: string
  name: string
  breed: string | null
  sex: string | null
  birthYear: number | null
  customerName: string
  stableName: string | null
  memo: string | null
  animalType: string | null
}

/**
 * Modulwahl + Huf-/Therapie-Formulare (ersetzt alte docType-Binärwahl).
 */
export default function MobileRecordEntry({ horseId, recordId, mode = 'create' }: Props) {
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('appointmentId')
  const moduleParam = searchParams.get('module')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<DocumentationModuleId[]>([])
  const [horse, setHorse] = useState<HorseCtx | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // 1) API: Legacy-Migration (Service Role). 2) RLS-Tabelle: frische Quelle der Wahrheit.
        const [modsRes, horseRes] = await Promise.all([
          fetch('/api/me/documentation-modules', { cache: 'no-store' }),
          supabase
            .from('horses')
            .select(
              'id, name, breed, sex, birth_year, animal_type, special_notes, notes, stable_name, customers(name)'
            )
            .eq('id', horseId)
            .maybeSingle(),
        ])
        if (!modsRes.ok) throw new Error('Module konnten nicht geladen werden.')
        const modsJson = (await modsRes.json()) as { enabled?: string[] }
        const fromApi = (modsJson.enabled ?? []).filter(isDocumentationModuleId)

        const { data: modRows } = await supabase
          .from('user_documentation_modules')
          .select('module_id, enabled')
        const fromDb = (modRows ?? [])
          .filter(
            (r) => Boolean(r.enabled) && isDocumentationModuleId(r.module_id)
          )
          .map((r) => r.module_id as DocumentationModuleId)

        const enabledList = fromDb.length > 0 ? fromDb : fromApi
        if (cancelled) return
        setEnabled(enabledList)

        const row = horseRes.data as
          | {
              id: string
              name: string | null
              breed: string | null
              sex: string | null
              birth_year: number | null
              animal_type: string | null
              special_notes: string | null
              notes: string | null
              stable_name: string | null
              customers: { name: string | null } | { name: string | null }[] | null
            }
          | null
        if (horseRes.error || !row) {
          throw new Error(horseRes.error?.message ?? 'Tier nicht gefunden.')
        }
        const cust = Array.isArray(row.customers) ? row.customers[0] : row.customers
        setHorse({
          id: row.id,
          name: row.name || 'Tier',
          breed: row.breed,
          sex: row.sex,
          birthYear: row.birth_year,
          customerName: cust?.name || 'Kunde',
          stableName: row.stable_name,
          memo: row.special_notes || row.notes,
          animalType: row.animal_type,
        })
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [horseId])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[14px] text-[#6B7280]">
        Wird geladen…
      </div>
    )
  }

  if (error || !horse) {
    return (
      <div className="px-4 py-6 text-[14px] text-red-600">
        {error ?? 'Tier nicht gefunden.'}
      </div>
    )
  }

  // Edit: weiter über bestehendes Mobile-Huf-Formular (Therapie-Edit folgt separat)
  if (mode === 'edit') {
    return (
      <MobileRecordForm
        horseId={horseId}
        recordId={recordId}
        mode="edit"
        appointmentId={appointmentId}
      />
    )
  }

  const resolved = resolveModulesForAnimal(enabled, horse.animalType)
  if (resolved.status === 'none') {
    return (
      <div className="px-4 py-6">
        <h1 className="text-[18px] font-semibold text-[#1B1F23]">Keine passende Dokumentation</h1>
        <p className="mt-2 text-[14px] text-[#6B7280]">
          Für diese Tierart ist kein freigeschaltetes Modul verfügbar.
        </p>
      </div>
    )
  }

  let selected: DocumentationModuleId | null = null
  if (isDocumentationModuleId(moduleParam) && resolved.candidates.includes(moduleParam)) {
    selected = moduleParam
  } else if (resolved.status === 'single') {
    selected = resolved.moduleId
  } else {
    return (
      <MobileModulePicker
        horseId={horseId}
        candidates={resolved.candidates}
        appointmentId={appointmentId}
      />
    )
  }

  const def = MODULE_CATALOG[selected]
  if (def.documentationKind === 'therapy') {
    return (
      <div className="px-2 pb-8 pt-2">
        <TherapyModuleRecordForm
          horse={horse}
          animalType={horse.animalType}
          moduleId={selected}
          defaultRecordDate={todayIso()}
          appointmentId={appointmentId}
          lastRecord={null}
          saveAction={createRecord}
        />
      </div>
    )
  }

  return (
    <MobileRecordForm
      horseId={horseId}
      mode="create"
      appointmentId={appointmentId}
    />
  )
}
