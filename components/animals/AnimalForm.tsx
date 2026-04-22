'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { formatCustomerNumber } from '@/lib/format'
import AddressAutocomplete, { type AddressSuggestion } from '@/components/customers/AddressAutocomplete'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDog, faCat, faHorse, faPaw, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { useAppProfile } from '@/context/AppProfileContext'
import { animalSingularLabel, deriveClinicalIntakeBlocks } from '@/lib/appProfile'
import DeleteHorseForm from '@/app/(app)/horses/[id]/DeleteHorseForm'
import {
  type ClinicalFirstContext,
  clinicalFirstContextHasContent,
  clinicalFromLegacyFlat,
} from '@/lib/animals/clinicalIntakeTypes'
import { uploadAnimalProfilePhoto } from '@/lib/animals/animalProfilePhotoUpload'
import { processWholeBodyImage } from '@/components/photos/imageProcessing'
import {
  ClinicalBlockAnamnesis,
  ClinicalBlockHistory,
  ClinicalBlockLocomotion,
} from '@/components/animals/AnimalFachlicherErstkontext'

export type AnimalFormCustomerOption = {
  id: string
  customer_number?: number | null
  name: string | null
}

export type AnimalType = 'dog' | 'cat' | 'horse' | 'small' | 'other'

export type AnimalFormInitialData = {
  id: string
  customerId: string
  animalType: AnimalType
  name: string
  breed: string
  sex: string
  birthYear: string
  weightKg: string
  coatColor: string
  chipId: string
  /** Legacy nur ohne clinicalFirstContext in DB */
  diagnoses?: string
  meds?: string
  allergies?: string
  reason?: string[]
  vetName?: string
  vetPhone?: string
  vaccination?: string
  housing?: string
  feeding?: string
  activity?: string
  supplements?: string
  behavior?: string
  compatibility?: string
  specialNotes?: string
  internalNotes: string
  neutered: 'unknown' | 'yes' | 'no'

  stableName?: string
  stableStreet?: string
  stableZip?: string
  stableCity?: string
  stableCountry?: string
  stableContact?: string
  stablePhone?: string
  stableDirections?: string
  stableDriveTime?: string | null

  /** Aus intake.clinicalFirstContext (optional; sonst Legacy-Felder unten) */
  clinicalFirstContext?: ClinicalFirstContext | null
  profilePhotoPath?: string | null
  /** Nur Edit: bisheriges intake-JSON (Zeitstempel Erstanamnese o. Ä. erhalten) */
  rawIntake?: unknown
}

type Props = {
  mode?: 'create' | 'edit'
  customers: AnimalFormCustomerOption[]
  initialCustomerId?: string
  initialData?: AnimalFormInitialData
  deleteAction?: () => void | Promise<void>
  deleteLabel?: string
  deleteConfirmText?: string
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <label className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11px] text-[#9CA3AF]">{hint}</div>}
    </div>
  )
}

function Section({
  title,
  icon,
  badge,
  opt,
  children,
}: {
  title: string
  icon: React.ReactNode
  badge?: string
  opt?: string
  children: React.ReactNode
}) {
  return (
    <section className="huf-card">
      <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf5f5] text-[14px] text-[#015555]">
          {icon}
        </span>
        <h3 className="dashboard-serif flex-1 text-[16px] font-medium text-[#1B1F23]">
          {title}
        </h3>
        {badge && (
          <span className="rounded-full bg-[#edf5f5] px-3 py-1 text-[11px] font-medium text-[#015555]">
            {badge}
          </span>
        )}
        {opt && <span className="text-[11px] text-[#9CA3AF]">{opt}</span>}
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  )
}

/** Wie Tierart / Stammdaten / Fachblöcke: Karte mit klickbarem Kopf zum Auf- und Zuklappen */
function CollapsibleSection({
  title,
  icon,
  badge,
  opt,
  defaultOpen = true,
  children,
}: {
  title: string
  icon: React.ReactNode
  badge?: string
  opt?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="huf-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px] text-left transition hover:bg-[#fafaf9]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf5f5] text-[14px] text-[#015555]">
          {icon}
        </span>
        <h3 className="dashboard-serif min-w-0 flex-1 text-[16px] font-medium text-[#1B1F23]">
          {title}
        </h3>
        {badge && (
          <span className="hidden shrink-0 rounded-full bg-[#edf5f5] px-3 py-1 text-[11px] font-medium text-[#015555] sm:inline">
            {badge}
          </span>
        )}
        {opt && (
          <span className="hidden max-w-[140px] shrink-0 truncate text-[11px] text-[#9CA3AF] md:inline">
            {opt}
          </span>
        )}
        <i
          className={`bi bi-chevron-down shrink-0 text-[18px] text-[#6B7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-5 p-6">{children}</div>}
    </section>
  )
}

// Formfelder wie in den bestehenden Desktop-Formularen (CustomerForm/HorseForm)
const inputClass = 'huf-input'
const textareaClass = 'huf-input huf-input--multiline leading-6'
const countryOptions = ['Deutschland', 'Österreich', 'Schweiz']

/** Gleiche Liste wie im Hufbearbeiter-Pferdeformular (`HorseForm`) */
const HORSE_BREED_OPTIONS = [
  'Haflinger',
  'Isländer',
  'Fjordpferd',
  'Welsh Cob',
  'Oldenburger',
  'Trakehner',
  'Hannoveraner',
  'Westfale',
  'Holsteiner',
  'Quarter Horse',
  'Paint Horse',
  'Araber',
  'Warmblut',
  'Dt. Reitpony',
  'Shetlandpony',
  'Friese',
  'Tinker',
  'Andalusier',
  'Lusitano',
  'Appaloosa',
  'Knabstrupper',
  'Noriker',
  'Schwarzwälder Fuchs',
  'Kaltblut',
  'Vollblut',
  'Maultier',
  'Esel',
] as const

const HORSE_BREED_DATALIST_ID = 'animal-form-horse-breed-options'

function initialClinicalFromProps(d?: AnimalFormInitialData): ClinicalFirstContext {
  if (d?.clinicalFirstContext) {
    return JSON.parse(JSON.stringify(d.clinicalFirstContext)) as ClinicalFirstContext
  }
  return clinicalFromLegacyFlat({
    diagnoses: d?.diagnoses,
    meds: d?.meds,
    allergies: d?.allergies,
    reason: d?.reason,
    vetName: d?.vetName,
    vetPhone: d?.vetPhone,
    vaccination: d?.vaccination,
    housing: d?.housing,
    feeding: d?.feeding,
    activity: d?.activity,
    supplements: d?.supplements,
    behavior: d?.behavior,
    compatibility: d?.compatibility,
    specialNotes: d?.specialNotes,
  })
}

function parseBirthYear(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const mYear = s.match(/^(19\d{2}|20\d{2})$/)
  if (!mYear) return null
  return Number(mYear[0])
}

function hasSavedStableLocation(d?: AnimalFormInitialData): boolean {
  if (!d) return false
  return !!(
    d.stableName?.trim() ||
    d.stableStreet?.trim() ||
    d.stableZip?.trim() ||
    d.stableCity?.trim() ||
    d.stableCountry?.trim() ||
    d.stableContact?.trim() ||
    d.stablePhone?.trim() ||
    d.stableDirections?.trim() ||
    (d.stableDriveTime != null && String(d.stableDriveTime).trim() !== '')
  )
}

type StableRow = {
  stable_name?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  stable_country?: string | null
  stable_contact?: string | null
  stable_phone?: string | null
  stable_directions?: string | null
  stable_drive_time?: string | null
}

function horseRowHasStableLocation(row: StableRow | null | undefined): boolean {
  if (!row) return false
  return !!(
    row.stable_name?.trim() ||
    row.stable_street?.trim() ||
    row.stable_zip?.trim() ||
    row.stable_city?.trim() ||
    row.stable_country?.trim() ||
    row.stable_contact?.trim() ||
    row.stable_phone?.trim() ||
    row.stable_directions?.trim() ||
    (row.stable_drive_time != null && String(row.stable_drive_time).trim() !== '')
  )
}

export default function AnimalForm({
  customers,
  initialCustomerId,
  mode = 'create',
  initialData,
  deleteAction,
  deleteLabel,
  deleteConfirmText,
}: Props) {
  const router = useRouter()
  const { profile } = useAppProfile()
  const clinicalBlockIds = deriveClinicalIntakeBlocks(profile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState(
    initialData?.customerId ?? initialCustomerId ?? ''
  )

  const [animalType, setAnimalType] = useState<AnimalType>(
    initialData?.animalType ?? 'dog'
  )
  const [name, setName] = useState(initialData?.name ?? '')
  const [breed, setBreed] = useState(initialData?.breed ?? '')
  const [sex, setSex] = useState(initialData?.sex ?? '')
  const [neutered, setNeutered] = useState<'unknown' | 'yes' | 'no'>(
    initialData?.neutered ?? 'unknown'
  )

  const [birthYear, setBirthYear] = useState(initialData?.birthYear ?? '')
  const [weightKg, setWeightKg] = useState(initialData?.weightKg ?? '')
  const [coatColor, setCoatColor] = useState(initialData?.coatColor ?? '')
  const [chipId, setChipId] = useState(initialData?.chipId ?? '')

  const [clinical, setClinical] = useState<ClinicalFirstContext>(() =>
    initialClinicalFromProps(initialData)
  )
  const [internalNotes, setInternalNotes] = useState(initialData?.internalNotes ?? '')

  const [committedPhotoPath, setCommittedPhotoPath] = useState<string | null>(
    initialData?.profilePhotoPath ?? null
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoRemoteUrl, setPhotoRemoteUrl] = useState<string | null>(null)

  const [stableName, setStableName] = useState(initialData?.stableName ?? '')
  const [stableStreet, setStableStreet] = useState(initialData?.stableStreet ?? '')
  const [stableZip, setStableZip] = useState(initialData?.stableZip ?? '')
  const [stableCity, setStableCity] = useState(initialData?.stableCity ?? '')
  const [stableCountry, setStableCountry] = useState(initialData?.stableCountry ?? 'Deutschland')
  const [stableContact, setStableContact] = useState(initialData?.stableContact ?? '')
  const [stablePhone, setStablePhone] = useState(initialData?.stablePhone ?? '')
  const [stableDirections, setStableDirections] = useState(initialData?.stableDirections ?? '')
  const [stableDistanceText, setStableDistanceText] = useState<string | null>(
    initialData?.stableDriveTime ?? null
  )

  const [stableDiffersFromCustomer, setStableDiffersFromCustomer] = useState(
    () => initialData?.animalType === 'horse' && hasSavedStableLocation(initialData)
  )

  const latestCustomerIdRef = useRef(customerId)
  latestCustomerIdRef.current = customerId

  const selectedCustomer = useMemo(
    () => customers.find((x) => x.id === customerId) || null,
    [customers, customerId]
  )

  const animalNameFieldLabel = useMemo(() => {
    switch (animalType) {
      case 'dog':
        return 'Name des Hundes'
      case 'cat':
        return 'Name der Katze'
      case 'horse':
        return 'Name des Pferdes'
      default:
        return 'Name des Tieres'
    }
  }, [animalType])

  const animalNamePlaceholder = useMemo(() => {
    switch (animalType) {
      case 'dog':
        return 'z. B. Bello'
      case 'cat':
        return 'z. B. Mimi'
      case 'horse':
        return 'z. B. Stella'
      default:
        return 'z. B. Bruno'
    }
  }, [animalType])

  const customerInitials = (selectedCustomer?.name || 'KU')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  async function fetchDistanceFromOrigin(destLat: number, destLon: number): Promise<string | null> {
    try {
      const res = await fetch('/api/user/origin', { credentials: 'include' })
      const origin = await res.json()
      const lat = origin?.lat ?? null
      const lon = origin?.lon ?? null
      if (typeof lat !== 'number' || typeof lon !== 'number') return null
      const params = new URLSearchParams({
        originLon: String(lon),
        originLat: String(lat),
        destLon: String(destLon),
        destLat: String(destLat),
      })
      const routeRes = await fetch(`/api/route-distance?${params}`)
      const data = await routeRes.json()
      const km = data?.distanceKm
      const min = data?.durationMin
      if (typeof km !== 'number') return null
      return min != null ? `Ca. ${km} km, ~${min} Min` : `Ca. ${km} km`
    } catch {
      return null
    }
  }

  /** Nur setState — absichtlich nicht in useEffect-Deps, damit die Array-Länge stabil bleibt (Fast Refresh). */
  function resetStableFields() {
    setStableName('')
    setStableStreet('')
    setStableZip('')
    setStableCity('')
    setStableCountry('Deutschland')
    setStableContact('')
    setStablePhone('')
    setStableDirections('')
    setStableDistanceText(null)
  }

  const applyStableFromRowRef = useRef<(data: StableRow) => void>(() => {})
  applyStableFromRowRef.current = (data: StableRow) => {
    setStableName(data.stable_name ?? '')
    setStableStreet(data.stable_street ?? '')
    setStableZip(data.stable_zip ?? '')
    setStableCity(data.stable_city ?? '')
    setStableCountry(data.stable_country?.trim() || 'Deutschland')
    setStableContact(data.stable_contact ?? '')
    setStablePhone(data.stable_phone ?? '')
    setStableDirections(data.stable_directions ?? '')
    setStableDistanceText(data.stable_drive_time ?? null)
  }

  useEffect(() => {
    if (animalType === 'horse') return
    setStableDiffersFromCustomer(false)
    resetStableFields()
  }, [animalType])

  /** Neues Pferd: Kunde gewählt → wenn ein anderes Pferd schon Stall hat, Schalter an + Felder (nach Fetch). */
  useEffect(() => {
    if (mode !== 'create' || animalType !== 'horse') return
    if (!customerId) {
      setStableDiffersFromCustomer(false)
      resetStableFields()
      return
    }
    const cid = customerId
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('horses')
        .select(
          'stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions, stable_drive_time'
        )
        .eq('customer_id', cid)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || latestCustomerIdRef.current !== cid) return
      if (error || !data || !horseRowHasStableLocation(data)) {
        setStableDiffersFromCustomer(false)
        resetStableFields()
        return
      }
      setStableDiffersFromCustomer(true)
      applyStableFromRowRef.current(data)
    })()
    return () => {
      cancelled = true
    }
  }, [mode, animalType, customerId])

  /** Schalter manuell an (oder nach Auto-An): Stall vom letzten Pferd nachladen. */
  useEffect(() => {
    if (mode !== 'create' || animalType !== 'horse' || !customerId || !stableDiffersFromCustomer) return
    const cid = customerId
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('horses')
        .select(
          'stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions, stable_drive_time'
        )
        .eq('customer_id', cid)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || latestCustomerIdRef.current !== cid) return
      if (error || !data || !horseRowHasStableLocation(data)) {
        resetStableFields()
        return
      }
      applyStableFromRowRef.current(data)
    })()
    return () => {
      cancelled = true
    }
  }, [stableDiffersFromCustomer, mode, animalType, customerId])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  useEffect(() => {
    if (photoFile) {
      setPhotoRemoteUrl(null)
      return
    }
    if (!committedPhotoPath) {
      setPhotoRemoteUrl(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.storage
        .from('hoof-photos')
        .createSignedUrl(committedPhotoPath, 3600)
      if (!cancelled && !error && data?.signedUrl) setPhotoRemoteUrl(data.signedUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [committedPhotoPath, photoFile])

  const handleSave = async () => {
    if (!customerId) {
      setError('Bitte einen Kunden auswählen.')
      return
    }
    if (!name.trim()) {
      setError('Bitte den Namen des Tieres eintragen.')
      return
    }
    if (!sex.trim()) {
      setError('Bitte das Geschlecht auswählen.')
      return
    }

    setSaving(true)
    setError(null)

    const birthYearParsed = parseBirthYear(birthYear)
    const weight = weightKg.trim() ? Number(weightKg.replace(',', '.')) : null
    const weightParsed = weight != null && Number.isFinite(weight) ? weight : null

    const neuteredForSave = animalType === 'horse' ? 'unknown' : neutered

    const mainComplaintParts = clinical.anamnesis.mainComplaint
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const prevIntake: Record<string, unknown> =
      mode === 'edit' &&
      initialData?.rawIntake &&
      typeof initialData.rawIntake === 'object' &&
      initialData.rawIntake !== null &&
      !Array.isArray(initialData.rawIntake)
        ? { ...(initialData.rawIntake as Record<string, unknown>) }
        : {}

    const nowIso = new Date().toISOString()
    const hasClin = clinicalFirstContextHasContent(clinical)
    const prevCreated =
      typeof prevIntake.clinicalFirstContextCreatedAt === 'string'
        ? prevIntake.clinicalFirstContextCreatedAt
        : undefined
    const prevUpdated =
      typeof prevIntake.clinicalFirstContextUpdatedAt === 'string'
        ? prevIntake.clinicalFirstContextUpdatedAt
        : undefined

    const clinicalTimeFields: Record<string, string> = {}
    if (hasClin) {
      clinicalTimeFields.clinicalFirstContextUpdatedAt = nowIso
      clinicalTimeFields.clinicalFirstContextCreatedAt = prevCreated ?? nowIso
    } else {
      if (prevCreated) clinicalTimeFields.clinicalFirstContextCreatedAt = prevCreated
      if (prevUpdated) clinicalTimeFields.clinicalFirstContextUpdatedAt = prevUpdated
    }

    const intake = {
      ...prevIntake,
      profilePhotoPath: photoFile ? null : committedPhotoPath,
      clinicalFirstContext: clinical,
      ...clinicalTimeFields,
      neutered: neuteredForSave,
      weightKg: weightParsed,
      coatColor: animalType === 'horse' ? null : coatColor.trim() || null,
      chipId: chipId.trim() || null,
      health: {
        diagnoses: clinical.anamnesis.knownConditions.trim() || null,
        medication: clinical.anamnesis.currentMeds.trim() || null,
        allergies: clinical.anamnesis.more.allergiesDetail.trim() || null,
        reason: mainComplaintParts.length ? mainComplaintParts : null,
        vetName: null,
        vetPhone: null,
        vaccination: clinical.anamnesis.more.vaccination.trim() || null,
      },
      husbandry: {
        housing: null,
        feeding: clinical.anamnesis.more.feedingNotes.trim() || null,
        activity: clinical.locomotion.trainingLevel.trim() || null,
        supplements: null,
      },
      behavior: {
        treatmentBehavior: clinical.anamnesis.more.behaviorStress.trim() || null,
        compatibility: clinical.anamnesis.more.compatibility.trim() || null,
        notes: clinical.anamnesis.more.ownerObservations.trim() || null,
      },
      internalNotes: internalNotes.trim() || null,
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError('Nicht angemeldet.')
      return
    }

    const stablePayload =
      animalType === 'horse' && stableDiffersFromCustomer
        ? {
            stable_name: stableName.trim() || null,
            stable_street: stableStreet.trim() || null,
            stable_zip: stableZip.trim() || null,
            stable_city: stableCity.trim() || null,
            stable_country: stableCountry || null,
            stable_contact: stableContact.trim() || null,
            stable_phone: stablePhone.trim() || null,
            stable_directions: stableDirections.trim() || null,
            stable_drive_time: stableDistanceText || null,
          }
        : {
            stable_name: null,
            stable_street: null,
            stable_zip: null,
            stable_city: null,
            stable_country: null,
            stable_contact: null,
            stable_phone: null,
            stable_directions: null,
            stable_drive_time: null,
          }

    const payload = {
      customer_id: customerId,
      animal_type: animalType,
      name: name.trim(),
      breed: breed.trim() || null,
      sex: sex.trim(),
      birth_year: birthYearParsed,
      neutered: neuteredForSave,
      weight_kg: weightParsed,
      coat_color: animalType === 'horse' ? null : coatColor.trim() || null,
      chip_id: chipId.trim() || null,
      special_notes: clinical.anamnesis.more.ownerObservations.trim() || null,
      notes: internalNotes.trim() || null,
      intake,
      ...stablePayload,
    }

    const res =
      mode === 'edit' && initialData?.id
        ? await supabase
            .from('horses')
            .update(payload)
            .eq('id', initialData.id)
            .eq('user_id', user.id)
            .select('id')
            .single()
        : await supabase
            .from('horses')
            .insert({
              user_id: user.id,
              ...payload,
            })
            .select('id')
            .single()

    if (res.error || !res.data) {
      setSaving(false)
      const msg = res.error?.message ?? 'Tier konnte nicht gespeichert werden.'
      if (
        msg.includes("Could not find the 'animal_type' column") ||
        msg.includes("Could not find the 'intake' column") ||
        msg.includes('schema cache')
      ) {
        setError(
          "Deine Supabase-Datenbank kennt die neuen Tier-Spalten noch nicht. Bitte Migration `20250327000000_animals_intake_fields.sql` ausführen (und danach den PostgREST Schema-Cache neu laden)."
        )
      } else {
        setError(msg)
      }
      return
    }

    const horseId = res.data.id

    if (photoFile) {
      try {
        const { blob } = await processWholeBodyImage(photoFile)
        const path = await uploadAnimalProfilePhoto(user.id, horseId, blob)
        const { error: photoErr } = await supabase
          .from('horses')
          .update({
            intake: { ...intake, profilePhotoPath: path },
          })
          .eq('id', horseId)
          .eq('user_id', user.id)
        if (photoErr) {
          setError(`Tier gespeichert, aber Foto-Upload fehlgeschlagen: ${photoErr.message}`)
          setSaving(false)
          router.push(`/animals/${horseId}`)
          return
        }
        setCommittedPhotoPath(path)
        setPhotoFile(null)
      } catch (e) {
        setError(
          e instanceof Error
            ? `Tier gespeichert, aber Foto: ${e.message}`
            : 'Tier gespeichert, aber Foto-Upload fehlgeschlagen.'
        )
        setSaving(false)
        router.push(`/animals/${horseId}`)
        return
      }
    }

    setSaving(false)
    router.push(`/animals/${horseId}`)
  }

  const TierCard = ({
    t,
    icon,
    label,
  }: {
    t: AnimalType
    icon: Parameters<typeof FontAwesomeIcon>[0]['icon']
    label: string
  }) => {
    const selected = animalType === t
    return (
      <button
        type="button"
        onClick={() => setAnimalType(t)}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-center transition',
          selected
            ? 'border-[#006d6d] bg-[rgba(0,109,109,0.06)] ring-4 ring-[rgba(0,109,109,0.10)]'
            : 'border-[#E5E2DC] bg-white hover:border-[#9CA3AF]',
        ].join(' ')}
      >
        <div className="text-[22px] leading-none">
          <FontAwesomeIcon icon={icon} />
        </div>
        <div className={['text-[12px] font-semibold', selected ? 'text-[#006d6d]' : 'text-[#6B7280]'].join(' ')}>
          {label}
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-7">
      <Section title="Besitzer / Kunde zuordnen" icon={<i className="bi bi-person-fill-check" />}>
        <div className="space-y-4">
          <Field label="Kunde" required>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="huf-input"
            >
              <option value="">Bitte wählen</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_number != null ? `${formatCustomerNumber(c.customer_number)} · ` : ''}{c.name || '-'}
                </option>
              ))}
            </select>
          </Field>

          {selectedCustomer && (
            <div className="flex items-center gap-4 rounded-[10px] border-2 border-[#006d6d] bg-[rgba(0,109,109,0.04)] px-[18px] py-[14px]">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#006d6d] text-[14px] font-semibold text-white">
                {customerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[#1B1F23]">
                  {selectedCustomer.customer_number != null ? `${formatCustomerNumber(selectedCustomer.customer_number)} · ` : ''}{selectedCustomer.name || 'Kunde'}
                </div>
                <div className="text-[12px] text-[#6B7280]">
                  Kunde ist zugeordnet.
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#9CA3AF]">
            Wird aus dem Kundenkontext übernommen oder kann hier manuell gewählt werden.
          </div>
        </div>
      </Section>

      <CollapsibleSection title="Tierart" icon={<i className="bi bi-tag-fill" />} opt="Die Auswahl passt das Formular an">
        <div className="grid grid-cols-5 gap-2 max-[900px]:grid-cols-3">
          <TierCard t="dog" icon={faDog} label="Hund" />
          <TierCard t="cat" icon={faCat} label="Katze" />
          <TierCard t="horse" icon={faHorse} label="Pferd" />
          <TierCard t="small" icon={faPaw} label="Kleintier" />
          <TierCard t="other" icon={faWandMagicSparkles} label="Sonstiges" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Stammdaten" icon={<i className="bi bi-heart-fill" />}>
        <div
          className={
            animalType === 'horse'
              ? 'grid gap-4 md:grid-cols-3'
              : 'grid gap-4 md:grid-cols-4'
          }
        >
          <Field label={animalNameFieldLabel} required>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={animalNamePlaceholder}
            />
          </Field>
          <Field
            label="Rasse"
            hint={
              animalType === 'horse'
                ? 'Tippe und wähle aus der Liste oder gib frei ein'
                : 'Optional'
            }
          >
            {animalType === 'horse' ? (
              <>
                <input
                  className={inputClass}
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  type="text"
                  list={HORSE_BREED_DATALIST_ID}
                  placeholder="z. B. Haflinger"
                />
                <datalist id={HORSE_BREED_DATALIST_ID}>
                  {HORSE_BREED_OPTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </>
            ) : (
              <input
                className={inputClass}
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder={
                  animalType === 'dog'
                    ? 'z. B. Labrador'
                    : animalType === 'cat'
                      ? 'z. B. Britisch Kurzhaar'
                      : 'z. B. Rasse'
                }
              />
            )}
          </Field>
          <Field label="Geschlecht" required>
            <select
              className="huf-input"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option value="">Bitte wählen…</option>
              {animalType === 'horse' ? (
                <>
                  <option value="Hengst">Hengst</option>
                  <option value="Stute">Stute</option>
                  <option value="Wallach">Wallach</option>
                </>
              ) : (
                <>
                  <option value="männlich">männlich</option>
                  <option value="weiblich">weiblich</option>
                </>
              )}
            </select>
          </Field>
          {animalType !== 'horse' && (
            <Field label="Kastriert?">
              <select
                className="huf-input"
                value={neutered}
                onChange={(e) => setNeutered(e.target.value as 'unknown' | 'yes' | 'no')}
              >
                <option value="unknown">Unbekannt</option>
                <option value="yes">Ja</option>
                <option value="no">Nein</option>
              </select>
            </Field>
          )}
        </div>

        <div
          className={
            animalType === 'horse'
              ? 'grid gap-4 md:grid-cols-3'
              : 'grid gap-4 md:grid-cols-4'
          }
        >
          <Field label="Geburtsjahr">
            <input
              className={inputClass}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              type="text"
              placeholder="z. B. 2018"
            />
          </Field>
          <Field label="Gewicht (kg)">
            <input className={inputClass} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="z. B. 32" inputMode="decimal" />
          </Field>
          {animalType !== 'horse' && (
            <Field label="Fellfarbe">
              <input className={inputClass} value={coatColor} onChange={(e) => setCoatColor(e.target.value)} placeholder="z. B. Gold" />
            </Field>
          )}
          <Field label="Chip-Nr. / Tätowierung">
            <input className={inputClass} value={chipId} onChange={(e) => setChipId(e.target.value)} placeholder="z. B. 276098…" />
          </Field>
        </div>

        <Field
          label="Allgemeines Tierfoto"
          hint="Ein Übersichtsbild fürs Akten- und Listen-Handling (JPEG, wird auf 4:3 skaliert)"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {(photoPreviewUrl || photoRemoteUrl) && (
              <div className="relative h-32 w-44 shrink-0 overflow-hidden rounded-lg border border-[#E5E2DC] bg-[#f4f4f2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreviewUrl || photoRemoteUrl || ''}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="text-[13px] text-[#374151] file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf5f5] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#015555]"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setPhotoFile(f ?? null)
                }}
              />
              {photoFile && (
                <button
                  type="button"
                  className="self-start text-[12px] font-medium text-[#6B7280] underline"
                  onClick={() => setPhotoFile(null)}
                >
                  Auswahl zurücksetzen
                </button>
              )}
            </div>
          </div>
        </Field>

        {animalType === 'horse' && (
          <div className="rounded-xl border border-[#E5E2DC] bg-[#fafaf9] px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[#1B1F23]">
                  Steht das Pferd an einem anderen Standort als die Kundenadresse?
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6B7280]">
                  Die Rechnungsanschrift des Kunden gilt als Standard. Nur aktivieren, wenn du Stall, Anfahrt oder Kontakt vor Ort separat brauchst.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={stableDiffersFromCustomer}
                aria-label="Pferd steht an anderem Standort als die Kundenadresse"
                title={stableDiffersFromCustomer ? 'Anderer Standort: ein' : 'Anderer Standort: aus'}
                onClick={() => {
                  setStableDiffersFromCustomer((prev) => {
                    const next = !prev
                    if (!next) resetStableFields()
                    return next
                  })
                }}
                className={`mhf-toggle-switch${stableDiffersFromCustomer ? ' on' : ''}`}
              />
            </div>
          </div>
        )}
      </CollapsibleSection>

      {animalType === 'horse' && stableDiffersFromCustomer && (
        <CollapsibleSection
          title="Stall / Standort"
          icon={<i className="bi bi-pin-map-fill" />}
          badge="Arbeitsort"
          opt="Dieses Pferd"
        >
          <Field label="Stalladresse suchen" hint="Ort, Adresse oder Name des Stalls/Hofs – Vorschläge füllen die Felder darunter">
            <AddressAutocomplete
              placeholder="z. B. Am Waldrand 7, 53567 Asbach"
              onSelect={(a: AddressSuggestion) => {
                setStableStreet(a.street)
                setStableZip(a.zip)
                setStableCity(a.city)
                if (a.country) setStableCountry(a.country)
                setStableDistanceText(null)
                if (a.lat != null && a.lon != null) {
                  void fetchDistanceFromOrigin(a.lat, a.lon).then(setStableDistanceText)
                }
              }}
            />
          </Field>
          {stableDistanceText && (
            <p className="text-[13px] text-[#006d6d]">Entfernung von deinem Betrieb: {stableDistanceText}</p>
          )}
          <Field label="Name des Stalls / Hofs" hint="So findest du den Standort schnell wieder">
            <input
              className={inputClass}
              value={stableName}
              onChange={(e) => setStableName(e.target.value)}
              type="text"
              placeholder="z. B. Reiterhof Sonnental"
            />
          </Field>
          <Field label="Straße & Hausnummer">
            <input
              className={inputClass}
              value={stableStreet}
              onChange={(e) => setStableStreet(e.target.value)}
              type="text"
              placeholder="z. B. Am Waldrand 7"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            <Field label="Ort">
              <input
                className={inputClass}
                value={stableCity}
                onChange={(e) => setStableCity(e.target.value)}
                type="text"
                placeholder="z. B. Asbach"
              />
            </Field>
            <Field label="PLZ">
              <input
                className={inputClass}
                value={stableZip}
                onChange={(e) => setStableZip(e.target.value)}
                type="text"
                placeholder="z. B. 53567"
              />
            </Field>
            <Field label="Land">
              <select
                className="huf-input"
                value={stableCountry}
                onChange={(e) => setStableCountry(e.target.value)}
              >
                {countryOptions.map((country) => (
                  <option key={country}>{country}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Ansprechpartner vor Ort" hint="Optional">
              <input
                className={inputClass}
                value={stableContact}
                onChange={(e) => setStableContact(e.target.value)}
                type="text"
                placeholder="z. B. Stallbesitzer Hans Müller"
              />
            </Field>
            <Field label="Telefon vor Ort" hint="Stalltelefon oder Ansprechpartner-Handy">
              <input
                className={inputClass}
                value={stablePhone}
                onChange={(e) => setStablePhone(e.target.value)}
                type="tel"
                placeholder="z. B. 02683 1234"
              />
            </Field>
          </div>
          <Field label="Anfahrtshinweis" hint="Besondere Hinweise zur Anfahrt zum Standort">
            <input
              className={inputClass}
              value={stableDirections}
              onChange={(e) => setStableDirections(e.target.value)}
              type="text"
              placeholder="z. B. Hofeinfahrt links, hinter Scheune"
            />
          </Field>
        </CollapsibleSection>
      )}

      {clinicalBlockIds.length > 0 && (
        <>
          <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-5 py-3.5 text-[13px] text-[#1E40AF]">
            <strong className="font-semibold">Fachlicher Erstkontext</strong> — modulare Blöcke (nicht nach
            Berufsbezeichnung). Sichtbarkeit steuert dein Profil; den detaillierten Befund erfasst du beim ersten Termin in
            der Dokumentation.
          </div>
          {clinicalBlockIds.includes('anamnesis') && (
            <CollapsibleSection
              title="Allgemeine Anamnese"
              icon={<i className="bi bi-clipboard2-pulse" />}
              badge="Anamnese"
              defaultOpen
            >
              <ClinicalBlockAnamnesis value={clinical} onChange={setClinical} />
            </CollapsibleSection>
          )}
          {clinicalBlockIds.includes('locomotion') && (
            <CollapsibleSection
              title="Bewegungsapparat / Funktion"
              icon={<i className="bi bi-activity" />}
              badge="Bewegung"
              defaultOpen={false}
            >
              <ClinicalBlockLocomotion value={clinical} onChange={setClinical} />
            </CollapsibleSection>
          )}
          {clinicalBlockIds.includes('history') && (
            <CollapsibleSection
              title="Vorgeschichte / strukturelle Auffälligkeiten"
              icon={<i className="bi bi-clock-history" />}
              badge="Vorgeschichte"
              defaultOpen={false}
            >
              <ClinicalBlockHistory value={clinical} onChange={setClinical} />
            </CollapsibleSection>
          )}
        </>
      )}

      <CollapsibleSection
        title="Interne Notizen"
        icon={<i className="bi bi-chat-dots-fill" />}
        opt="Optional"
        defaultOpen={false}
      >
        <Field label="Notizen zum Tier" hint="Nur für dich sichtbar — nicht auf Berichten oder Dokumentationen">
          <textarea className={textareaClass} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="z. B. Kollegin überwiesen…" />
        </Field>
      </CollapsibleSection>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E2DC] pt-6">
        <Link href="/animals" className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#6B7280] hover:bg-black/5">
          ← Abbrechen
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {mode === 'edit' && initialData?.id && deleteAction ? (
            <DeleteHorseForm
              action={deleteAction}
              label={deleteLabel ?? `${animalSingularLabel(profile.terminology)} löschen`}
              confirmText={
                deleteConfirmText ??
                `Willst du dieses ${animalSingularLabel(profile.terminology).toLowerCase()} wirklich löschen? Alle zugehörigen Dokumentationen und Fotos werden ebenfalls entfernt.`
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-[15px] font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
            />
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#006d6d] px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#015555] disabled:opacity-50"
          >
            <i className="bi bi-check-lg" />{' '}
            {saving ? 'Speichere…' : mode === 'edit' ? 'Änderungen speichern' : 'Tier speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

