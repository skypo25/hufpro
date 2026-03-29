'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { useAppProfile } from '@/context/AppProfileContext'
import HorseForm from '@/components/horses/HorseForm'
import AnimalForm, { type AnimalFormInitialData, type AnimalType } from '@/components/animals/AnimalForm'
import { emptyHorseFormData } from '@/components/horses/horseFormDefaults'
import type { HorseFormInitialData } from '@/components/horses/HorseForm'
import { animalSingularLabel, newAnimalButtonLabel } from '@/lib/appProfile'
import { profilePhotoPathFromIntake, resolveClinicalForForm } from '@/lib/animals/clinicalIntakeTypes'

type CustomerRow = {
  id: string
  customer_number?: number | null
  name: string | null
}

type HorseRow = {
  id: string
  customer_id: string | null
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  birth_date: string | null
  usage: string | null
  housing: string | null
  hoof_status: string | null
  care_interval: string | null
  special_notes: string | null
  notes: string | null
  stable_name?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  stable_country?: string | null
  stable_contact?: string | null
  stable_phone?: string | null
  stable_directions?: string | null
  stable_drive_time?: string | null
  animal_type?: string | null
  neutered?: string | null
  weight_kg?: number | null
  coat_color?: string | null
  chip_id?: string | null
  intake?: Record<string, unknown> | null
}

function mapHorseToAnimalFormInitial(horse: HorseRow): AnimalFormInitialData {
  const intake = horse.intake ?? undefined
  const health = (intake?.health as Record<string, unknown> | undefined) ?? {}
  const husbandry = (intake?.husbandry as Record<string, unknown> | undefined) ?? {}
  const behavior = (intake?.behavior as Record<string, unknown> | undefined) ?? {}

  return {
    id: horse.id,
    customerId: horse.customer_id || '',
    animalType: (horse.animal_type || 'dog') as AnimalType,
    name: horse.name || '',
    breed: horse.breed || '',
    sex: horse.sex || '',
    birthYear: horse.birth_year ? String(horse.birth_year) : '',
    weightKg: horse.weight_kg != null ? String(horse.weight_kg).replace('.', ',') : '',
    coatColor: horse.coat_color || '',
    chipId: horse.chip_id || '',
    internalNotes: horse.notes || String(intake?.internalNotes ?? ''),
    neutered:
      horse.neutered === 'yes' || horse.neutered === 'no' || horse.neutered === 'unknown'
        ? (horse.neutered as 'unknown' | 'yes' | 'no')
        : ((intake?.neutered as 'unknown' | 'yes' | 'no') || 'unknown'),
    stableName: horse.stable_name || '',
    stableStreet: horse.stable_street || '',
    stableZip: horse.stable_zip || '',
    stableCity: horse.stable_city || '',
    stableCountry: horse.stable_country || 'Deutschland',
    stableContact: horse.stable_contact || '',
    stablePhone: horse.stable_phone || '',
    stableDirections: horse.stable_directions || '',
    stableDriveTime: horse.stable_drive_time ?? null,
    clinicalFirstContext: resolveClinicalForForm(horse.intake, {
      diagnoses: String(health.diagnoses ?? ''),
      meds: String(health.medication ?? ''),
      allergies: String(health.allergies ?? ''),
      reason: Array.isArray(health.reason) ? (health.reason as string[]) : [],
      vetName: String(health.vetName ?? ''),
      vetPhone: String(health.vetPhone ?? ''),
      vaccination: String(health.vaccination ?? ''),
      housing: String(husbandry.housing ?? ''),
      feeding: String(husbandry.feeding ?? ''),
      activity: String(husbandry.activity ?? ''),
      supplements: String(husbandry.supplements ?? ''),
      behavior: String(behavior.treatmentBehavior ?? ''),
      compatibility: String(behavior.compatibility ?? ''),
      specialNotes: horse.special_notes || String(behavior.notes ?? ''),
    }),
    profilePhotoPath: profilePhotoPathFromIntake(horse.intake),
  }
}

function mapHorseToHorseFormInitial(horse: HorseRow): HorseFormInitialData {
  return {
    id: horse.id,
    customerId: horse.customer_id || '',
    name: horse.name || '',
    breed: horse.breed || '',
    sex: horse.sex || '',
    birthYear: horse.birth_year ? String(horse.birth_year) : '',
    birthDate: horse.birth_date || '',
    usage: horse.usage || '',
    housing: horse.housing || '',
    hoofStatus: horse.hoof_status || '',
    careInterval: horse.care_interval || '',
    specialNotes: horse.special_notes || '',
    notes: horse.notes || '',
    stableName: horse.stable_name || '',
    stableStreet: horse.stable_street || '',
    stableZip: horse.stable_zip || '',
    stableCity: horse.stable_city || '',
    stableCountry: horse.stable_country || 'Deutschland',
    stableContact: horse.stable_contact || '',
    stablePhone: horse.stable_phone || '',
    stableDirections: horse.stable_directions || '',
    stableDriveTime: horse.stable_drive_time ?? null,
  }
}

type Props = {
  mode: 'create' | 'edit'
  horseId?: string
}

export default function MobileAnimalFormScreen({ mode, horseId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCustomerId = searchParams.get('customerId') || ''
  const { profile, loading: profileLoading } = useAppProfile()

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [horse, setHorse] = useState<HorseRow | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoadError('')
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        router.push('/login')
        setLoading(false)
        return
      }

      const { data: custData, error: cErr } = await supabase
        .from('customers')
        .select('id, customer_number, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (cancelled) return
      if (cErr) {
        setLoadError(`Kunden konnten nicht geladen werden: ${cErr.message}`)
        setLoading(false)
        return
      }
      setCustomers(custData ?? [])

      if (mode === 'edit' && horseId) {
        const { data: h, error: hErr } = await supabase
          .from('horses')
          .select('*')
          .eq('id', horseId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return
        if (hErr || !h) {
          setLoadError(hErr?.message || 'Eintrag konnte nicht geladen werden.')
          setHorse(null)
          setLoading(false)
          return
        }
        setHorse(h as HorseRow)
      } else {
        setHorse(null)
      }

      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [mode, horseId, router])

  const title =
    mode === 'create'
      ? newAnimalButtonLabel(profile.terminology)
      : `${animalSingularLabel(profile.terminology)} bearbeiten`

  if (profileLoading || loading) {
    return (
      <div className="mhf-root">
        <div className="status-bar" aria-hidden />
        <header className="mhf-header">
          <div className="mhf-ah-top">
            <div className="mhf-ah-title">{title}</div>
          </div>
          <div className="mhf-ah-sub">Laden…</div>
        </header>
        <div className="mhf-content">
          <div className="mhf-loading">Daten werden geladen…</div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mhf-root">
        <div className="status-bar" aria-hidden />
        <header className="mhf-header">
          <div className="mhf-ah-top">
            <div className="mhf-ah-title">Fehler</div>
            <button
              type="button"
              className="mhf-ah-close"
              onClick={() => router.back()}
              aria-label="Schließen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>
        <div className="mhf-content">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
            {loadError}
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'edit' && !horse) {
    return null
  }

  return (
    <div className="mhf-root">
      <div className="status-bar" aria-hidden />
      <header className="mhf-header">
        <div className="mhf-ah-top">
          <div className="mhf-ah-title">{title}</div>
          <button
            type="button"
            className="mhf-ah-close"
            onClick={() => router.back()}
            aria-label="Schließen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mhf-ah-sub">Pflichtfelder sind mit * gekennzeichnet</div>
      </header>

      <div className="mhf-content mobile-form-embed-root">
        {profile.requiresAnimalTypeChoice ? (
          mode === 'create' ? (
            <AnimalForm customers={customers} initialCustomerId={initialCustomerId} />
          ) : (
            <AnimalForm
              mode="edit"
              customers={customers}
              initialData={mapHorseToAnimalFormInitial(horse)}
            />
          )
        ) : mode === 'create' ? (
          <HorseForm
            mode="create"
            customers={customers}
            initialData={{
              ...emptyHorseFormData,
              customerId: initialCustomerId,
            }}
          />
        ) : (
          <HorseForm
            mode="edit"
            customers={customers}
            initialData={mapHorseToHorseFormInitial(horse)}
          />
        )}
      </div>
    </div>
  )
}
