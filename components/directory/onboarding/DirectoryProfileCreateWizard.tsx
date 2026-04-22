'use client'

import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react'

import AddressAutocomplete, {
  formatAddressSuggestionForLocationQuery,
  type AddressSuggestion,
} from '@/components/customers/AddressAutocomplete'
import { submitDirectoryProfileWizardForOwnerAction } from '@/app/(app)/directory/mein-profil/actions'
import { compressGalleryImageForUpload } from '@/lib/directory/onboarding/compressGalleryImageForUpload'
import { uploadDirectoryProfileMediaAction } from '@/lib/directory/onboarding/uploadDirectoryProfileMediaAction'
import { DirectoryCategoryCardIcon } from '@/components/directory/public/listing/DirectoryCategoryCardIcon'
import type {
  DirectoryPublicAnimalTypeRow,
  DirectoryPublicMethodRow,
  DirectoryPublicSpecialtyRow,
  DirectoryPublicSubcategoryRow,
} from '@/lib/directory/public/types'
import {
  DIRECTORY_WEEKDAY_KEYS,
  DIRECTORY_WEEKDAY_LABEL_DE,
  defaultDayHoursFormState,
  openingHoursFormStateFromJson,
  openingHoursJsonFromFormState,
  type DayHoursFormState,
  type DirectoryOpeningHoursJson,
  type DirectoryWeekdayKey,
} from '@/lib/directory/openingHours'
import type {
  WizardSubmitPayload,
  WizardSubmitResult,
  WizardSubmitSocialLink,
} from '@/lib/directory/onboarding/submitWizardProfile'
import { directorySpecialtyDisplayName } from '@/lib/directory/public/labels'
import { DIRECTORY_AUTOCOMPLETE_COUNTRY_CODES, DIRECTORY_PHOTON_DACH_BBOX } from '@/lib/directory/public/listingParams'
import { DirectoryWizardMapPreview } from '@/components/directory/onboarding/DirectoryWizardMapPreview'
import TimePicker from '@/components/form/TimePicker'

const TOTAL_STEPS = 8
const MAX_GALLERY_PHOTOS = 6

const STEP_NAMES = [
  '',
  'Stammdaten',
  'Fachrichtungen',
  'Spezialisierungen',
  'Methoden',
  'Tierarten & Arbeitsweise',
  'Einsatzgebiet',
  'Logo & Bilder',
  'Vorschau',
]

const STEPS = [
  { id: 1, name: 'Stammdaten', sub: 'Name, Adresse, Kontakt, Social Media' },
  { id: 2, name: 'Fachrichtungen', sub: 'Deine Schwerpunkte' },
  { id: 3, name: 'Spezialisierungen', sub: 'Deine Fachgebiete' },
  { id: 4, name: 'Methoden', sub: 'Leistungen & Therapien' },
  { id: 5, name: 'Tierarten & Arbeitsweise', sub: 'Tiere & Praxisform' },
  { id: 6, name: 'Einsatzgebiet', sub: 'Radius & Qualifikationen' },
  { id: 7, name: 'Logo & Bilder', sub: 'Logo und Galerie' },
  { id: 8, name: 'Vorschau', sub: 'Profil überprüfen' },
] as const

/** Haupt-Fachrichtungen im Wizard — gleiche Icon-Logik wie Verzeichnis-Kategoriekarten (`categoryCardBiIconClass`). */
const WIZARD_PROFILE_SPECIALTY_CODES = new Set([
  'tierphysiotherapie',
  'tierosteopathie',
  'tierheilpraktik',
  'hufschmied',
  'barhufbearbeitung',
  'pferdedentist',
])

const ANIMAL_EMOJI: Partial<Record<string, string>> = {
  pferd: '🐴',
  hund: '🐕',
  katze: '🐈',
  kleintiere: '🐇',
  nutztiere: '🐄',
}

const WORK_MODES = [
  { code: 'mobile' as const, emoji: '🚗', name: 'Mobil', desc: 'Ich komme zum Kunden' },
  { code: 'stationary' as const, emoji: '🏠', name: 'Praxis', desc: 'Kunden kommen zu mir' },
  { code: 'both' as const, emoji: '🚗🏠', name: 'Beides', desc: 'Mobil und Praxis' },
]

const WIZARD_SOCIAL_PLATFORM_OPTIONS: { value: WizardSubmitSocialLink['platform']; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Sonstiges' },
]

const MAX_WIZARD_SOCIAL_ROWS = WIZARD_SOCIAL_PLATFORM_OPTIONS.length

const WIZARD_SOCIAL_PLATFORM_SET = new Set<string>(WIZARD_SOCIAL_PLATFORM_OPTIONS.map((o) => o.value))

const ALLOWED_WIZARD_SALUTATIONS = new Set(['', 'herr', 'frau', 'divers'])

function looksLikeEmailWizard(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function isValidDachPostalWizard(plz: string, country: 'DE' | 'AT' | 'CH'): boolean {
  const t = plz.trim()
  if (country === 'DE') return /^\d{5}$/.test(t)
  if (country === 'AT' || country === 'CH') return /^\d{4}$/.test(t)
  return false
}

function validateWizardSocialRows(rows: { platform: string; url: string }[]): {
  error: string | null
  firstBadRow: number | null
} {
  const seen = new Set<string>()
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx]!
    const pl = r.platform.trim().toLowerCase()
    const u = r.url.trim()
    if (!pl && !u) continue
    if (!pl || !WIZARD_SOCIAL_PLATFORM_SET.has(pl)) {
      return {
        error: 'Bitte bei Social Media eine Plattform wählen oder leere Zeilen entfernen.',
        firstBadRow: idx,
      }
    }
    if (!u) {
      return {
        error: 'Bitte für jede gewählte Social-Plattform eine URL angeben oder die Zeile entfernen.',
        firstBadRow: idx,
      }
    }
    if (u.length > 500) {
      return { error: 'Social-Link ist zu lang (max. 500 Zeichen).', firstBadRow: idx }
    }
    if (seen.has(pl)) {
      return { error: 'Jede Social-Plattform nur einmal.', firstBadRow: idx }
    }
    seen.add(pl)
  }
  return { error: null, firstBadRow: null }
}

/** Zeile noch fehlerhaft (leer = ok), inkl. doppelter Plattform mit ausgefüllter URL. */
function wizardSocialRowStillInvalid(rows: { platform: string; url: string }[], idx: number): boolean {
  const r = rows[idx]
  if (!r) return false
  const pl = r.platform.trim().toLowerCase()
  const u = r.url.trim()
  if (!pl && !u) return false
  if (!pl || !WIZARD_SOCIAL_PLATFORM_SET.has(pl)) return true
  if (!u || u.length > 500) return true
  const withSame = rows.filter((x) => x.platform.trim().toLowerCase() === pl && x.url.trim())
  if (withSame.length > 1) return true
  return false
}

type WizardStepValidation = { ok: true } | { ok: false; error: string; fields: string[] }

function wizardCombineValidationMessages(messages: string[]): string {
  const unique = [...new Set(messages.map((m) => m.trim()).filter(Boolean))]
  if (unique.length === 0) return 'Bitte Eingaben prüfen.'
  if (unique.length === 1) return unique[0]!
  return `Bitte alle rot markierten Felder ausfüllen bzw. korrigieren. (${unique.slice(0, 3).join(' · ')}${unique.length > 3 ? ' …' : ''})`
}

function initialPerSpecialtyCustomMap(
  kind: 'spec' | 'method',
  init: Partial<WizardSubmitPayload> | null,
): Record<string, string[]> {
  if (!init) return {}
  const from =
    kind === 'spec' ? init.customSpecsBySpecialtyId : init.customMethodsBySpecialtyId
  if (from && typeof from === 'object' && Object.keys(from).length > 0) {
    return { ...from }
  }
  const flat = kind === 'spec' ? (init.customSpecs ?? []) : (init.customMethods ?? [])
  const firstId = (init.specialtyIds ?? [])[0]
  if (flat.length > 0 && firstId) {
    return { [firstId]: [...flat] }
  }
  return {}
}

function normalizeInitSocialRows(raw: Partial<WizardSubmitPayload>['socialLinks']): { platform: string; url: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw
    .filter(
      (x): x is WizardSubmitSocialLink =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as WizardSubmitSocialLink).platform === 'string' &&
        typeof (x as WizardSubmitSocialLink).url === 'string',
    )
    .map((x) => ({ platform: x.platform, url: x.url }))
}

const NAME_SALUTATION_OPTIONS = [
  { value: '', label: 'Keine Angabe' },
  { value: 'herr', label: 'Herr' },
  { value: 'frau', label: 'Frau' },
  { value: 'divers', label: 'Divers' },
] as const

const NAME_TITLE_CUSTOM = '__custom__'

const NAME_TITLE_PRESETS = [
  { value: '', label: 'Kein Titel' },
  { value: 'Dr.', label: 'Dr.' },
  { value: 'Prof.', label: 'Prof.' },
  { value: 'Prof. Dr.', label: 'Prof. Dr.' },
  { value: 'Dr. med. vet.', label: 'Dr. med. vet.' },
  { value: 'Dr. rer. nat.', label: 'Dr. rer. nat.' },
  { value: 'Dipl.-THP', label: 'Dipl.-THP' },
  { value: 'Dipl.-Bth. Tierosteopathie', label: 'Dipl.-Bth. Tierosteopathie' },
  { value: NAME_TITLE_CUSTOM, label: 'Sonstiges …' },
] as const

function buildPersonDisplayName(title: string, first: string, last: string): string {
  const parts = [title.trim(), first.trim(), last.trim()].filter((x) => x.length > 0)
  return parts.join(' ')
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase()
  return (p[0]![0] + p[p.length - 1]![0]).toUpperCase()
}

function serviceLabel(code: string | null): string {
  if (code === 'mobile') return 'Mobil'
  if (code === 'stationary') return 'Praxis'
  if (code === 'both') return 'Mobil & Praxis'
  return '—'
}

function filterRowsBySearch<T extends { name: string }>(q: string, rows: T[]): T[] {
  const s = q.trim().toLowerCase()
  if (!s) return rows
  return rows.filter((r) => r.name.toLowerCase().includes(s))
}

export type DirectoryProfileCreateWizardInitialMedia = {
  logoUrl: string | null
  photos: { id: string; url: string }[]
}

export type DirectoryProfileCreateWizardProps = {
  specialties: DirectoryPublicSpecialtyRow[]
  subcategories: DirectoryPublicSubcategoryRow[]
  methods: DirectoryPublicMethodRow[]
  animals: DirectoryPublicAnimalTypeRow[]
  /** Im App-Bereich (z. B. mein-profil): kein grauer Wizard-Flächenhintergrund (#f9f9f9). */
  embeddedInApp?: boolean
  /** Bestehendes Logo / Galerie (nur eingebetteter Owner-Editor). */
  initialMedia?: DirectoryProfileCreateWizardInitialMedia | null
  /** Top-/Premium-Profil: Galerie-Uploads erlaubt (sonst nur Logo). */
  premiumGalleryEnabled?: boolean
  /** Öffentliches Onboarding: gewähltes Paket (wird mit dem Profil mitgesendet). */
  directoryOnboardingProduct?: 'free' | 'directory_premium' | 'app'
  /** Öffentlicher Wizard: Query `paket` (für Redirect nach Stripe). */
  publicPaket?: 'gratis' | 'premium'
  /** Gespeichertes Profil des Nutzers (Resume nach Stripe / für Checkout). */
  wizardResumeProfileId?: string | null
  /** Query `premium_sub` nach Rückkehr von Stripe (nur öffentlicher Premium-Wizard). */
  wizardResumePremiumSub?: 'success' | 'canceled' | null
  initial?: Partial<WizardSubmitPayload> | null
  submitAction?: (payload: unknown) => Promise<WizardSubmitResult>
  successRedirectTo?: string | null
}

export function DirectoryProfileCreateWizard({
  specialties,
  subcategories,
  methods,
  animals,
  embeddedInApp = false,
  initialMedia = null,
  premiumGalleryEnabled = false,
  directoryOnboardingProduct,
  publicPaket,
  wizardResumeProfileId = null,
  wizardResumePremiumSub = null,
  initial = null,
  submitAction,
  successRedirectTo,
}: DirectoryProfileCreateWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [current, setCurrent] = useState(1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  /** Öffentliches Premium: nach Kernspeichern / nach Stripe — Galerie frei. „Mit Gratis weiter“ setzt Override auf free. */
  const [productChoiceOverride, setProductChoiceOverride] = useState<'free' | 'directory_premium' | 'app' | null>(null)
  const [passedPremiumGate, setPassedPremiumGate] = useState(false)
  const [premiumCoreSaved, setPremiumCoreSaved] = useState(false)
  const [premiumCoreSaving, setPremiumCoreSaving] = useState(false)
  const [savedProfileIdForGate, setSavedProfileIdForGate] = useState<string | null>(null)
  const [premiumCheckoutLoading, setPremiumCheckoutLoading] = useState(false)
  /** Nach „Mit Gratis weiter“: Zurück von Schritt 7 setzt das Premium-Gate wieder her (erneuter Checkout möglich). */
  const [premiumChoseGratisContinue, setPremiumChoseGratisContinue] = useState(false)
  const effectiveOnboardingChoice = useMemo(
    () => productChoiceOverride ?? directoryOnboardingProduct ?? null,
    [productChoiceOverride, directoryOnboardingProduct],
  )
  const galleryEnabled = useMemo(() => {
    if (embeddedInApp) return premiumGalleryEnabled
    if (directoryOnboardingProduct !== 'directory_premium') return false
    if (!passedPremiumGate) return false
    if (effectiveOnboardingChoice === 'free') return false
    return true
  }, [
    embeddedInApp,
    premiumGalleryEnabled,
    directoryOnboardingProduct,
    passedPremiumGate,
    effectiveOnboardingChoice,
  ])
  const atPremiumActivateGate =
    !embeddedInApp &&
    current === 7 &&
    directoryOnboardingProduct === 'directory_premium' &&
    !passedPremiumGate &&
    premiumCoreSaved
  /** Keys wie `practiceName`, `social-row-0`, `spec-block-{uuid}` — Markierung + Scroll bei Validierung. */
  const [wizardInvalidFields, setWizardInvalidFields] = useState<string[]>([])

  const wizardSpecialties = useMemo(() => {
    return [...specialties]
      .filter((s) => WIZARD_PROFILE_SPECIALTY_CODES.has(s.code))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [specialties])

  const subcatById = useMemo(() => new Map(subcategories.map((s) => [s.id, s])), [subcategories])
  const methodById = useMemo(() => new Map(methods.map((m) => [m.id, m])), [methods])

  const init = initial ?? {}

  const [practiceName, setPracticeName] = useState(init.practiceName ?? '')
  const [nameSalutation, setNameSalutation] = useState(init.nameSalutation ?? '')
  const [nameTitlePreset, setNameTitlePreset] = useState('')
  const [nameTitleCustom, setNameTitleCustom] = useState('')
  const [firstName, setFirstName] = useState(init.firstName ?? '')
  const [lastName, setLastName] = useState(init.lastName ?? '')
  const [shortDesc, setShortDesc] = useState(init.shortDesc ?? '')
  const [street, setStreet] = useState(init.streetLine ?? '')
  const [plz, setPlz] = useState(init.plz ?? '')
  const [city, setCity] = useState(init.city ?? '')
  const [country, setCountry] = useState<'DE' | 'AT' | 'CH'>(() =>
    init.country === 'AT' || init.country === 'CH' ? init.country : 'DE'
  )
  const [latitude, setLatitude] = useState<number | null>(() =>
    typeof init.latitude === 'number' && Number.isFinite(init.latitude) ? init.latitude : null
  )
  const [longitude, setLongitude] = useState<number | null>(() =>
    typeof init.longitude === 'number' && Number.isFinite(init.longitude) ? init.longitude : null
  )
  const [addressSearch, setAddressSearch] = useState(() => {
    const s = (init.streetLine ?? '').trim()
    const z = (init.plz ?? '').trim()
    const c = (init.city ?? '').trim()
    if (!s && !z && !c) return ''
    return formatAddressSuggestionForLocationQuery({
      street: init.streetLine ?? '',
      zip: init.plz ?? '',
      city: init.city ?? '',
      country: '',
    })
  })

  const [socialRows, setSocialRows] = useState<{ platform: string; url: string }[]>(() =>
    normalizeInitSocialRows(init.socialLinks),
  )

  const clearGeo = useCallback(() => {
    setLatitude(null)
    setLongitude(null)
  }, [])

  const addSocialRow = useCallback(() => {
    setSocialRows((prev) => {
      if (prev.length >= MAX_WIZARD_SOCIAL_ROWS) return prev
      return [...prev, { platform: '', url: '' }]
    })
  }, [])

  const removeSocialRow = useCallback((index: number) => {
    setSocialRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateSocialRow = useCallback((index: number, patch: Partial<{ platform: string; url: string }>) => {
    setSocialRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }, [])

  const onAddressSuggestion = useCallback((a: AddressSuggestion) => {
    setStreet(a.street.trim())
    const rawZip = (a.zip || '').replace(/\D/g, '')
    const cc = a.countryCode?.toUpperCase()
    const nextCountry: 'DE' | 'AT' | 'CH' = cc === 'AT' || cc === 'CH' ? cc : 'DE'
    setCountry(nextCountry)
    setPlz(rawZip.slice(0, nextCountry === 'DE' ? 5 : 4))
    setCity(a.city.trim())
    if (
      typeof a.lat === 'number' &&
      typeof a.lon === 'number' &&
      Number.isFinite(a.lat) &&
      Number.isFinite(a.lon)
    ) {
      setLatitude(a.lat)
      setLongitude(a.lon)
    } else {
      clearGeo()
    }
  }, [clearGeo])

  useEffect(() => {
    if (latitude != null && longitude != null) return
    const q = [street.trim(), plz.trim(), city.trim()].filter(Boolean).join(', ')
    if (q.length < 4) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: '1', lang: 'de' })
        params.set('bbox', DIRECTORY_PHOTON_DACH_BBOX)
        const res = await fetch(`https://photon.komoot.io/api?${params}`)
        const data = await res.json()
        const coords = data?.features?.[0]?.geometry?.coordinates as [number, number] | undefined
        if (!coords || cancelled) return
        const [lon, lat] = coords
        if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
          setLatitude(lat)
          setLongitude(lon)
        }
      } catch {
        /* ignore */
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [latitude, longitude, street, plz, city])

  const [phone, setPhone] = useState(init.phone ?? '')
  const [email, setEmail] = useState(init.email ?? '')
  const [website, setWebsite] = useState(init.website ?? '')

  const [hoursByDay, setHoursByDay] = useState<Record<DirectoryWeekdayKey, DayHoursFormState>>(() =>
    openingHoursFormStateFromJson((init.openingHours ?? null) as DirectoryOpeningHoursJson | null),
  )
  const [openingHoursNote, setOpeningHoursNote] = useState(init.openingHoursNote ?? '')

  const patchHoursDay = useCallback((key: DirectoryWeekdayKey, patch: Partial<DayHoursFormState>) => {
    setHoursByDay((prev) => ({ ...prev, [key]: { ...(prev[key] ?? defaultDayHoursFormState()), ...patch } }))
  }, [])

  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<Set<string>>(new Set(init.specialtyIds ?? []))
  const [specSearch, setSpecSearch] = useState('')

  useEffect(() => {
    const byId = new Map(specialties.map((s) => [s.id, s]))
    setSelectedSpecialtyIds((prev) => {
      const next = new Set(
        [...prev].filter((id) => {
          const row = byId.get(id)
          return row != null && WIZARD_PROFILE_SPECIALTY_CODES.has(row.code)
        })
      )
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev
      return next
    })
  }, [specialties])
  const [methodSearch, setMethodSearch] = useState('')
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<Set<string>>(new Set(init.subcategoryIds ?? []))
  const [selectedMethodIds, setSelectedMethodIds] = useState<Set<string>>(new Set(init.methodIds ?? []))
  const [customSpecsBySpecId, setCustomSpecsBySpecId] = useState<Record<string, string[]>>(() =>
    initialPerSpecialtyCustomMap('spec', initial),
  )
  const [customMethodsBySpecId, setCustomMethodsBySpecId] = useState<Record<string, string[]>>(() =>
    initialPerSpecialtyCustomMap('method', initial),
  )
  const [customSpecDraftBySpec, setCustomSpecDraftBySpec] = useState<Record<string, string>>({})
  const [customMethodDraftBySpec, setCustomMethodDraftBySpec] = useState<Record<string, string>>({})

  const allCustomSpecsFlat = useMemo(
    () => [...new Set(Object.values(customSpecsBySpecId).flat())],
    [customSpecsBySpecId],
  )
  const allCustomMethodsFlat = useMemo(
    () => [...new Set(Object.values(customMethodsBySpecId).flat())],
    [customMethodsBySpecId],
  )

  const [selectedAnimalIds, setSelectedAnimalIds] = useState<Set<string>>(new Set(init.animalTypeIds ?? []))
  const [serviceType, setServiceType] = useState<'mobile' | 'stationary' | 'both' | null>(
    (init.serviceType as 'mobile' | 'stationary' | 'both' | null | undefined) ?? null
  )

  const [radiusKm, setRadiusKm] = useState(typeof init.radiusKm === 'number' ? init.radiusKm : 30)
  const [areaText, setAreaText] = useState(init.areaText ?? '')
  const [qualiDraft, setQualiDraft] = useState('')
  const [qualiItems, setQualiItems] = useState<string[]>(init.qualiItems ?? [])

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [serverPhotoRows, setServerPhotoRows] = useState<{ id: string; url: string }[]>(() =>
    embeddedInApp ? [...(initialMedia?.photos ?? [])] : [],
  )
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    if (!embeddedInApp || premiumGalleryEnabled) return
    setServerPhotoRows([])
    setPhotoFiles([])
  }, [embeddedInApp, premiumGalleryEnabled])

  useEffect(() => {
    if (embeddedInApp) return
    if (!galleryEnabled) {
      setPhotoFiles([])
    }
  }, [embeddedInApp, galleryEnabled])

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f))
    setPhotoPreviewUrls(urls)
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [photoFiles])

  const resolvedNameTitle = useMemo(() => {
    if (nameTitlePreset === NAME_TITLE_CUSTOM) return nameTitleCustom.trim()
    if (nameTitlePreset.length) return nameTitlePreset.trim()
    return (init.nameTitle ?? '').trim()
  }, [init.nameTitle, nameTitlePreset, nameTitleCustom])

  const personDisplayName = useMemo(
    () => buildPersonDisplayName(resolvedNameTitle, firstName, lastName),
    [resolvedNameTitle, firstName, lastName]
  )

  const [previewTab, setPreviewTab] = useState<'card' | 'page'>('card')

  /** Codes der gewählten Fachrichtungen — stabile Zuordnung zu Subcategories/Methods (nicht nur UUID-Vergleich). */
  const selectedSpecCodes = useMemo(() => {
    const byId = new Map(specialties.map((s) => [s.id, s]))
    return new Set(
      [...selectedSpecialtyIds].map((id) => byId.get(id)?.code).filter((c): c is string => Boolean(c))
    )
  }, [specialties, selectedSpecialtyIds])

  useEffect(() => {
    setSelectedSubcategoryIds((prev) => {
      const next = new Set(
        [...prev].filter((id) => {
          const r = subcatById.get(id)
          if (!r) return false
          return selectedSpecCodes.has(r.directory_specialty_code)
        })
      )
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev
      return next
    })
    setSelectedMethodIds((prev) => {
      const next = new Set(
        [...prev].filter((id) => {
          const r = methodById.get(id)
          if (!r) return false
          if (r.directory_specialty_id == null) return selectedSpecialtyIds.size > 0
          if (r.directory_specialty_code) return selectedSpecCodes.has(r.directory_specialty_code)
          return selectedSpecialtyIds.has(r.directory_specialty_id)
        })
      )
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev
      return next
    })
  }, [selectedSpecialtyIds, selectedSpecCodes, subcatById, methodById])

  const orderedSelectedSpecialties = useMemo(() => {
    const byId = new Map(specialties.map((s) => [s.id, s]))
    const picked = [...selectedSpecialtyIds]
      .map((id) => byId.get(id))
      .filter(
        (s): s is DirectoryPublicSpecialtyRow =>
          s != null && WIZARD_PROFILE_SPECIALTY_CODES.has(s.code)
      )
    picked.sort((a, b) => a.sort_order - b.sort_order)
    return picked
  }, [specialties, selectedSpecialtyIds])

  const getStepValidation = useCallback(
    (step: number): WizardStepValidation => {
      const fail = (error: string, fields: string[]): WizardStepValidation => ({ ok: false, error, fields })
      switch (step) {
        case 1: {
          const fieldSet = new Set<string>()
          const errs: string[] = []
          const add = (msg: string, keys: readonly string[]) => {
            errs.push(msg)
            for (const k of keys) fieldSet.add(k)
          }
          if (!ALLOWED_WIZARD_SALUTATIONS.has(nameSalutation.trim().toLowerCase())) {
            add('Bitte eine gültige Anrede wählen.', ['nameSalutation'])
          }
          if (!practiceName.trim()) add('Bitte einen Praxisnamen angeben.', ['practiceName'])
          else if (practiceName.length > 200) add('Praxisname ist zu lang (max. 200 Zeichen).', ['practiceName'])
          if (!firstName.trim()) add('Bitte den Vornamen angeben.', ['firstName'])
          else if (firstName.length > 80) add('Vorname ist zu lang (max. 80 Zeichen).', ['firstName'])
          if (!lastName.trim()) add('Bitte den Nachnamen angeben.', ['lastName'])
          else if (lastName.length > 80) add('Nachname ist zu lang (max. 80 Zeichen).', ['lastName'])
          if (resolvedNameTitle.length > 60) add('Titel ist zu lang (max. 60 Zeichen).', ['nameTitle'])
          const plzT = plz.trim()
          if (!isValidDachPostalWizard(plzT, country)) {
            add(
              country === 'DE'
                ? 'Bitte eine gültige PLZ angeben (5 Ziffern für Deutschland).'
                : 'Bitte eine gültige PLZ angeben (4 Ziffern für Österreich/Schweiz).',
              ['plz'],
            )
          }
          if (!city.trim()) add('Bitte den Ort angeben.', ['city'])
          else if (city.length > 120) add('Ort ist zu lang (max. 120 Zeichen).', ['city'])
          if (street.trim().length > 300) add('Adresse ist zu lang (max. 300 Zeichen).', ['street'])
          if (!phone.trim()) add('Bitte eine Telefonnummer angeben.', ['phone'])
          else if (phone.length > 80) add('Telefonnummer ist zu lang (max. 80 Zeichen).', ['phone'])
          if (!email.trim()) add('Bitte eine E-Mail-Adresse angeben.', ['email'])
          else if (!looksLikeEmailWizard(email)) add('Bitte eine gültige E-Mail angeben.', ['email'])
          const disp = buildPersonDisplayName(resolvedNameTitle, firstName, lastName)
          if (!disp.trim()) {
            add('Bitte Name (Titel/Vor-/Nachname) ergänzen.', ['firstName', 'lastName', 'nameTitle'])
          } else if (disp.length > 200) {
            add('Der aus Titel, Vor- und Nachname gebildete Name ist zu lang (max. 200 Zeichen).', [
              'nameTitle',
              'firstName',
              'lastName',
            ])
          }
          if (shortDesc.length > 1000) add('Kurzbeschreibung ist zu lang (max. 1000 Zeichen).', ['shortDesc'])
          if (website.length > 500) add('Website ist zu lang (max. 500 Zeichen).', ['website'])
          const socialRes = validateWizardSocialRows(socialRows)
          if (socialRes.error) {
            errs.push(socialRes.error)
            for (let i = 0; i < socialRows.length; i++) {
              if (wizardSocialRowStillInvalid(socialRows, i)) fieldSet.add(`social-row-${i}`)
            }
          }
          const ser = openingHoursJsonFromFormState(hoursByDay)
          if (!ser.ok) add(ser.error, ['opening-hours'])
          if (openingHoursNote.length > 800) {
            add('Hinweis zu Öffnungszeiten ist zu lang (max. 800 Zeichen).', ['openingHoursNote'])
          }
          if (fieldSet.size === 0) return { ok: true }
          return fail(wizardCombineValidationMessages(errs), [...fieldSet])
        }
        case 2:
          if (orderedSelectedSpecialties.length === 0) {
            return fail('Bitte wähle mindestens eine Fachrichtung.', ['specialties'])
          }
          return { ok: true }
        case 3: {
          if (orderedSelectedSpecialties.length === 0) {
            return fail('Bitte zuerst mindestens eine Fachrichtung wählen (Schritt 2).', ['specialties'])
          }
          const subCountBySpec = new Map<string, number>()
          for (const id of selectedSubcategoryIds) {
            const r = subcatById.get(id)
            if (!r) continue
            const sid = r.directory_specialty_id
            subCountBySpec.set(sid, (subCountBySpec.get(sid) ?? 0) + 1)
          }
          const specFields: string[] = []
          const specErrs: string[] = []
          for (const spec of orderedSelectedSpecialties) {
            const nSub = subCountBySpec.get(spec.id) ?? 0
            const nCust = (customSpecsBySpecId[spec.id] ?? []).length
            if (nSub === 0 && nCust === 0) {
              specFields.push(`spec-block-${spec.id}`)
              specErrs.push(
                `„${directorySpecialtyDisplayName(spec.code, spec.name)}“: Spezialisierung oder eigene Eintragung fehlt.`,
              )
            }
          }
          if (specFields.length === 0) return { ok: true }
          return fail(wizardCombineValidationMessages(specErrs), specFields)
        }
        case 4: {
          const f: string[] = []
          const e: string[] = []
          if (orderedSelectedSpecialties.length === 0) {
            e.push('Bitte zuerst mindestens eine Fachrichtung wählen (Schritt 2).')
            f.push('specialties')
          }
          if (selectedMethodIds.size === 0 && allCustomMethodsFlat.length === 0) {
            e.push('Bitte mindestens eine Methode/Leistung auswählen oder eine eigene ergänzen.')
            f.push('methods')
          }
          if (f.length === 0) return { ok: true }
          return fail(wizardCombineValidationMessages(e), f)
        }
        case 5: {
          const f: string[] = []
          const e: string[] = []
          if (selectedAnimalIds.size === 0) {
            e.push('Bitte mindestens eine Tierart wählen.')
            f.push('animals')
          }
          if (!serviceType) {
            e.push('Bitte eine Arbeitsweise wählen (Praxis, mobil oder beides).')
            f.push('serviceType')
          }
          if (f.length === 0) return { ok: true }
          return fail(wizardCombineValidationMessages(e), f)
        }
        case 6: {
          const f = new Set<string>()
          const e: string[] = []
          if (!areaText.trim()) {
            e.push('Bitte das Einsatzgebiet kurz beschreiben (z. B. Regionen oder Orte).')
            f.add('areaText')
          } else if (areaText.length > 300) {
            e.push('Einsatzgebiet ist zu lang (max. 300 Zeichen).')
            f.add('areaText')
          }
          if (qualiItems.length > 40) {
            e.push('Zu viele Qualifikationen (max. 40).')
            f.add('quali')
          }
          if (qualiItems.some((q) => q.length > 200)) {
            e.push('Eine Qualifikationszeile ist zu lang (max. 200 Zeichen).')
            f.add('quali')
          }
          if (f.size === 0) return { ok: true }
          return fail(wizardCombineValidationMessages(e), [...f])
        }
        case 7:
        case 8:
          return { ok: true }
        default:
          return { ok: true }
      }
    },
    [
      nameSalutation,
      practiceName,
      firstName,
      lastName,
      resolvedNameTitle,
      plz,
      country,
      city,
      street,
      phone,
      email,
      shortDesc,
      website,
      socialRows,
      hoursByDay,
      openingHoursNote,
      orderedSelectedSpecialties,
      selectedSubcategoryIds,
      subcatById,
      customSpecsBySpecId,
      selectedMethodIds,
      allCustomMethodsFlat,
      selectedAnimalIds,
      serviceType,
      areaText,
      qualiItems,
    ],
  )

  const wizardInvalidKeyStillBroken = useCallback(
    (key: string): boolean => {
      const disp = buildPersonDisplayName(resolvedNameTitle, firstName, lastName)
      if (key === 'practiceName') return !practiceName.trim() || practiceName.length > 200
      if (key === 'nameSalutation') return !ALLOWED_WIZARD_SALUTATIONS.has(nameSalutation.trim().toLowerCase())
      if (key === 'nameTitle') return resolvedNameTitle.length > 60 || disp.length > 200
      if (key === 'firstName') {
        return !firstName.trim() || firstName.length > 80 || !disp.trim() || disp.length > 200
      }
      if (key === 'lastName') {
        return !lastName.trim() || lastName.length > 80 || !disp.trim() || disp.length > 200
      }
      if (key === 'shortDesc') return shortDesc.length > 1000
      if (key === 'street') return street.trim().length > 300
      if (key === 'plz') return !isValidDachPostalWizard(plz.trim(), country)
      if (key === 'city') return !city.trim() || city.length > 120
      if (key === 'phone') return !phone.trim() || phone.length > 80
      if (key === 'email') return !email.trim() || !looksLikeEmailWizard(email)
      if (key === 'website') return website.length > 500
      if (key.startsWith('social-row-')) {
        const i = Number.parseInt(key.slice('social-row-'.length), 10)
        if (!Number.isFinite(i)) return false
        return wizardSocialRowStillInvalid(socialRows, i)
      }
      if (key === 'opening-hours') {
        const ser = openingHoursJsonFromFormState(hoursByDay)
        return !ser.ok
      }
      if (key === 'openingHoursNote') return openingHoursNote.length > 800
      if (key === 'specialties') return orderedSelectedSpecialties.length === 0
      if (key.startsWith('spec-block-')) {
        const specId = key.slice('spec-block-'.length)
        if (!specId) return false
        let nSub = 0
        for (const sid of selectedSubcategoryIds) {
          const row = subcatById.get(sid)
          if (row?.directory_specialty_id === specId) nSub++
        }
        const nCust = (customSpecsBySpecId[specId] ?? []).length
        return nSub === 0 && nCust === 0
      }
      if (key === 'methods') {
        return (
          orderedSelectedSpecialties.length === 0 ||
          (selectedMethodIds.size === 0 && allCustomMethodsFlat.length === 0)
        )
      }
      if (key === 'animals') return selectedAnimalIds.size === 0
      if (key === 'serviceType') return !serviceType
      if (key === 'areaText') return !areaText.trim() || areaText.length > 300
      if (key === 'quali') {
        if (qualiItems.length > 40) return true
        return qualiItems.some((q) => q.length > 200)
      }
      return false
    },
    [
      practiceName,
      nameSalutation,
      resolvedNameTitle,
      firstName,
      lastName,
      shortDesc,
      street,
      plz,
      country,
      city,
      phone,
      email,
      website,
      socialRows,
      hoursByDay,
      openingHoursNote,
      orderedSelectedSpecialties,
      selectedSubcategoryIds,
      subcatById,
      customSpecsBySpecId,
      selectedMethodIds,
      allCustomMethodsFlat,
      selectedAnimalIds,
      serviceType,
      areaText,
      qualiItems,
    ],
  )

  useEffect(() => {
    setWizardInvalidFields((prev) => {
      if (prev.length === 0) return prev
      const next = prev.filter((k) => wizardInvalidKeyStillBroken(k))
      if (next.length === prev.length && next.every((k, i) => k === prev[i])) return prev
      return next
    })
  }, [wizardInvalidKeyStillBroken])

  const wizardInvalidPrevCount = useRef(0)
  useEffect(() => {
    const n = wizardInvalidFields.length
    if (wizardInvalidPrevCount.current > 0 && n === 0) {
      setSubmitError(null)
    }
    wizardInvalidPrevCount.current = n
  }, [wizardInvalidFields.length])

  const goStep = useCallback(
    (n: number, opts?: { preserveMessages?: boolean }) => {
      if (n < 1 || n > TOTAL_STEPS) return
      if (n === current) return
      const preserve = opts?.preserveMessages === true
      if (n > current) {
        for (let s = current; s < n; s++) {
          const r = getStepValidation(s)
          if (!r.ok) {
            setSubmitError(r.error)
            setWizardInvalidFields(r.fields)
            setCurrent(s)
            requestAnimationFrame(() => {
              const anchor = r.fields[0]
              if (anchor) {
                document.querySelector(`[data-wiz-field="${anchor}"]`)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                })
              }
            })
            return
          }
        }
      }
      setCurrent(n)
      if (!preserve) {
        setSubmitError(null)
        setSaveSuccessMessage(null)
        setWizardInvalidFields([])
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [current, getStepValidation],
  )

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  const onLogoFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setLogoRemoved(false)
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return f ? URL.createObjectURL(f) : null
    })
    setLogoFile(f ?? null)
  }, [])

  const clearLogo = useCallback(() => {
    if (logoFile) {
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setLogoFile(null)
      return
    }
    setLogoRemoved(true)
  }, [logoFile])

  const onGalleryFilesChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (!galleryEnabled) return
    const list = e.target.files
    if (!list?.length) return
    const incoming = Array.from(list)
    e.target.value = ''
    void (async () => {
      const compressed = await Promise.all(incoming.map((f) => compressGalleryImageForUpload(f)))
      setPhotoFiles((prev) => {
        const cap = Math.max(0, MAX_GALLERY_PHOTOS - serverPhotoRows.length)
        return [...prev, ...compressed].slice(0, cap)
      })
    })()
  }, [galleryEnabled, serverPhotoRows.length])

  const removeGalleryAt = useCallback((index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const submitPayload = useCallback(() => {
    if (!serviceType) return null
    const ser = openingHoursJsonFromFormState(hoursByDay)
    if (!ser.ok) return null
    return {
      practiceName,
      nameSalutation,
      nameTitle: resolvedNameTitle,
      firstName,
      lastName,
      shortDesc,
      streetLine: street,
      plz,
      city,
      phone,
      email,
      website,
      socialLinks: socialRows
        .filter((r) => r.platform && r.url.trim())
        .map((r) => ({
          platform: r.platform as WizardSubmitSocialLink['platform'],
          url: r.url.trim(),
        })),
      specialtyIds: orderedSelectedSpecialties.map((s) => s.id),
      subcategoryIds: [...selectedSubcategoryIds],
      methodIds: [...selectedMethodIds],
      customSpecs: [],
      customMethods: [],
      customSpecsBySpecialtyId: Object.fromEntries(
        orderedSelectedSpecialties.map((s) => [s.id, customSpecsBySpecId[s.id] ?? []]),
      ),
      customMethodsBySpecialtyId: Object.fromEntries(
        orderedSelectedSpecialties.map((s) => [s.id, customMethodsBySpecId[s.id] ?? []]),
      ),
      wizardUsesPerSpecialtyCustomBlocks: true,
      animalTypeIds: [...selectedAnimalIds],
      serviceType,
      radiusKm,
      areaText,
      qualiItems,
      country,
      latitude,
      longitude,
      openingHours: ser.json,
      openingHoursNote: openingHoursNote.trim(),
      ...(effectiveOnboardingChoice != null ? { onboardingProductChoice: effectiveOnboardingChoice } : {}),
    }
  }, [
    practiceName,
    nameSalutation,
    resolvedNameTitle,
    firstName,
    lastName,
    shortDesc,
    street,
    plz,
    city,
    country,
    latitude,
    longitude,
    phone,
    email,
    website,
    socialRows,
    orderedSelectedSpecialties,
    selectedSubcategoryIds,
    selectedMethodIds,
    customSpecsBySpecId,
    customMethodsBySpecId,
    selectedAnimalIds,
    serviceType,
    radiusKm,
    areaText,
    qualiItems,
    hoursByDay,
    openingHoursNote,
    effectiveOnboardingChoice,
  ])

  const saveCoreBeforePremiumGate = useCallback(async (): Promise<boolean> => {
    for (let step = 1; step <= 6; step++) {
      const r = getStepValidation(step)
      if (!r.ok) {
        setSubmitError(r.error)
        setWizardInvalidFields(r.fields)
        goStep(step, { preserveMessages: true })
        requestAnimationFrame(() => {
          const anchor = r.fields[0]
          if (anchor) {
            document.querySelector(`[data-wiz-field="${anchor}"]`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          }
        })
        return false
      }
    }
    const payload = submitPayload()
    if (!payload) {
      setSubmitError('Profil konnte nicht zusammengestellt werden. Bitte Eingaben prüfen.')
      return false
    }
    const fn = submitAction ?? submitDirectoryProfileWizardForOwnerAction
    const result = await fn(payload)
    if (!result.ok) {
      setSubmitError(result.error)
      return false
    }
    setSavedProfileIdForGate(result.profileId)
    setPremiumCoreSaved(true)
    setCurrent(7)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }, [getStepValidation, goStep, submitPayload, submitAction])

  const resumePremiumHandledRef = useRef(false)
  useEffect(() => {
    if (resumePremiumHandledRef.current) return
    if (!wizardResumePremiumSub) return
    resumePremiumHandledRef.current = true
    const pk = publicPaket === 'premium' ? 'premium' : 'gratis'
    const cleanPath = `/directory/mein-profil?paket=${pk}`
    if (wizardResumePremiumSub === 'success' && directoryOnboardingProduct === 'directory_premium') {
      setPassedPremiumGate(true)
      setPremiumCoreSaved(true)
      if (wizardResumeProfileId) setSavedProfileIdForGate(wizardResumeProfileId)
      setCurrent(7)
      setSaveSuccessMessage(
        'Premium ist jetzt aktiv. Ergänze optional Logo und Galerie — danach kannst du den Assistenten abschließen.',
      )
      router.replace(cleanPath)
      return
    }
    if (wizardResumePremiumSub === 'canceled' && directoryOnboardingProduct === 'directory_premium') {
      setPremiumCoreSaved(true)
      if (wizardResumeProfileId) setSavedProfileIdForGate(wizardResumeProfileId)
      setCurrent(7)
      setSaveSuccessMessage(
        'Zahlung wurde nicht abgeschlossen. Du kannst Premium erneut aktivieren oder mit Gratis weitermachen.',
      )
      router.replace(cleanPath)
    }
  }, [wizardResumePremiumSub, wizardResumeProfileId, directoryOnboardingProduct, publicPaket, router])

  const startDirectoryPremiumCheckout = useCallback(async () => {
    const pid = savedProfileIdForGate?.trim()
    if (!pid) {
      setSubmitError('Profil-ID fehlt. Bitte Seite neu laden oder Schritt 6 mit „Weiter“ erneut speichern.')
      return
    }
    setPremiumCheckoutLoading(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/stripe/directory/premium-subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryProfileId: pid, successReturnToWizard: true }),
        credentials: 'include',
        cache: 'no-store',
      })
      const raw = await res.text()
      let data: unknown = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }
      const stripeUrl =
        data &&
        typeof data === 'object' &&
        'url' in data &&
        typeof (data as { url: unknown }).url === 'string'
          ? (data as { url: string }).url.trim()
          : null
      if (stripeUrl) {
        window.location.assign(stripeUrl)
        return
      }
      const apiErr =
        data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof (data as { error: unknown }).error === 'string'
          ? (data as { error: string }).error
          : null
      setSubmitError(
        apiErr ||
          (res.status === 401
            ? 'Du bist nicht angemeldet. Bitte melde dich an und versuche es erneut.'
            : !res.ok
              ? `Checkout konnte nicht gestartet werden (HTTP ${res.status}).`
              : 'Checkout konnte nicht gestartet werden. Bitte unter „Mein Profil“ erneut versuchen.'),
      )
    } catch (e) {
      setSubmitError(
        e instanceof Error && e.message
          ? `Netzwerkfehler: ${e.message}`
          : 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.',
      )
    } finally {
      setPremiumCheckoutLoading(false)
    }
  }, [savedProfileIdForGate])

  const onMitGratisWeiter = useCallback(async () => {
    setSubmitError(null)
    const base = submitPayload()
    if (!base) {
      setSubmitError('Profil konnte nicht zusammengestellt werden. Bitte Eingaben prüfen.')
      return
    }
    const payload = { ...base, onboardingProductChoice: 'free' as const }
    const fn = submitAction ?? submitDirectoryProfileWizardForOwnerAction
    const result = await fn(payload)
    if (!result.ok) {
      setSubmitError(result.error)
      return
    }
    setProductChoiceOverride('free')
    setPassedPremiumGate(true)
    setPremiumChoseGratisContinue(true)
  }, [submitPayload, submitAction])

  const finishWizard = useCallback(() => {
    for (let step = 1; step <= 7; step++) {
      const r = getStepValidation(step)
      if (!r.ok) {
        setSubmitError(r.error)
        setWizardInvalidFields(r.fields)
        goStep(step, { preserveMessages: true })
        requestAnimationFrame(() => {
          const anchor = r.fields[0]
          if (anchor) {
            document.querySelector(`[data-wiz-field="${anchor}"]`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          }
        })
        return
      }
    }
    const payload = submitPayload()
    if (!payload) {
      setSubmitError('Profil konnte nicht zusammengestellt werden. Bitte Eingaben prüfen.')
      return
    }
    setSubmitError(null)
    setSaveSuccessMessage(null)
    setWizardInvalidFields([])
    startTransition(async () => {
      const fn = submitAction ?? submitDirectoryProfileWizardForOwnerAction
      const result = await fn(payload)
      if (result.ok) {
        if (embeddedInApp && result.profileId) {
          const fd = new FormData()
          fd.append('profileId', result.profileId)
          fd.append('keepPhotoMediaIds', JSON.stringify(serverPhotoRows.map((r) => r.id)))
          if (logoRemoved) fd.append('removeLogo', '1')
          if (logoFile) fd.append('logo', logoFile)
          for (const p of photoFiles) {
            fd.append('photos', p)
          }
          const up = await uploadDirectoryProfileMediaAction(fd)
          if (!up.ok) {
            setSubmitError(up.error)
            return
          }
        } else if (!embeddedInApp && result.profileId && (logoFile || (galleryEnabled && photoFiles.length > 0))) {
          const fd = new FormData()
          fd.append('profileId', result.profileId)
          fd.append('keepPhotoMediaIds', JSON.stringify([]))
          if (logoRemoved) fd.append('removeLogo', '1')
          if (logoFile) fd.append('logo', logoFile)
          for (const p of photoFiles) {
            fd.append('photos', p)
          }
          const up = await uploadDirectoryProfileMediaAction(fd)
          if (!up.ok) {
            setSubmitError(up.error)
            return
          }
        }
        if (result.ok && result.postProfileCheckout === 'app') {
          const urlPath = '/api/stripe/directory/app-subscription/checkout'
          const res = await fetch(urlPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directoryProfileId: result.profileId }),
          })
          const checkoutJson: unknown = await res.json().catch(() => null)
          let nextUrl: string | null = null
          if (checkoutJson && typeof checkoutJson === 'object' && checkoutJson !== null) {
            const o = checkoutJson as { upgraded?: unknown; redirect?: unknown; url?: unknown }
            if (o.upgraded === true && typeof o.redirect === 'string' && o.redirect.trim()) {
              nextUrl = o.redirect.trim()
            } else if (typeof o.url === 'string' && o.url.trim()) {
              nextUrl = o.url.trim()
            }
          }
          if (nextUrl) {
            window.location.href = nextUrl
            return
          }
          setSubmitError(
            res.ok
              ? 'Checkout konnte nicht gestartet werden. Bitte unter „Mein Profil“ erneut versuchen.'
              : 'Checkout konnte nicht gestartet werden. Bitte später erneut versuchen.',
          )
          return
        }
        const redirectTarget =
          successRedirectTo === null ? null : (successRedirectTo ?? '/behandler?entwurf=1')
        if (redirectTarget) {
          router.push(redirectTarget)
        } else {
          setSubmitError(null)
          setSaveSuccessMessage(
            'Dein Eintrag wurde gespeichert. Er ist zunächst ein Entwurf und erscheint unter /behandler erst, wenn er veröffentlicht wurde (Freigabe).',
          )
          setCurrent(8)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        return
      }
      setSubmitError(result.error)
    })
  }, [
    router,
    submitPayload,
    submitAction,
    successRedirectTo,
    embeddedInApp,
    logoFile,
    photoFiles,
    logoRemoved,
    serverPhotoRows,
    getStepValidation,
    goStep,
    galleryEnabled,
    logoRemoved,
  ])

  const removeServerPhoto = useCallback((id: string) => {
    setServerPhotoRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const persistedLogoUrl =
    embeddedInApp &&
    !logoRemoved &&
    initialMedia?.logoUrl &&
    initialMedia.logoUrl.trim().length > 0
      ? initialMedia.logoUrl.trim()
      : null

  const gallerySlotsUsed = serverPhotoRows.length + photoFiles.length
  const gallerySlotsLeft = Math.max(0, MAX_GALLERY_PHOTOS - gallerySlotsUsed)

  const hasMediaForPreview = useMemo(() => {
    if (logoFile || (galleryEnabled && photoFiles.length > 0)) return true
    if (!embeddedInApp) return false
    if (persistedLogoUrl) return true
    if (galleryEnabled && serverPhotoRows.length > 0) return true
    return false
  }, [embeddedInApp, logoFile, photoFiles.length, persistedLogoUrl, galleryEnabled, serverPhotoRows.length])

  const wizInvalid = useCallback(
    (key: string) => wizardInvalidFields.includes(key),
    [wizardInvalidFields],
  )

  const nextStep = useCallback(() => {
    if (current < TOTAL_STEPS) {
      if (
        current === 6 &&
        !embeddedInApp &&
        directoryOnboardingProduct === 'directory_premium' &&
        !passedPremiumGate
      ) {
        if (premiumCoreSaved) {
          goStep(7)
          return
        }
        setPremiumCoreSaving(true)
        setSubmitError(null)
        void (async () => {
          try {
            const ok = await saveCoreBeforePremiumGate()
            if (!ok) return
          } finally {
            setPremiumCoreSaving(false)
          }
        })()
        return
      }
      goStep(current + 1)
      return
    }
    finishWizard()
  }, [
    current,
    finishWizard,
    goStep,
    embeddedInApp,
    directoryOnboardingProduct,
    passedPremiumGate,
    premiumCoreSaved,
    saveCoreBeforePremiumGate,
  ])

  const prevStep = useCallback(() => {
    if (current > 1) {
      if (atPremiumActivateGate) {
        setCurrent(6)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (
        current === 7 &&
        !embeddedInApp &&
        directoryOnboardingProduct === 'directory_premium' &&
        premiumChoseGratisContinue
      ) {
        setPremiumChoseGratisContinue(false)
        setPassedPremiumGate(false)
        setProductChoiceOverride(null)
        goStep(6)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      goStep(current - 1)
    }
  }, [
    current,
    goStep,
    atPremiumActivateGate,
    embeddedInApp,
    directoryOnboardingProduct,
    premiumChoseGratisContinue,
  ])

  const toggleSpecialty = useCallback((id: string) => {
    setSelectedSpecialtyIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const removeSpecialty = useCallback((id: string) => {
    setSelectedSpecialtyIds((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }, [])

  const toggleIdInSet = useCallback((setFn: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setFn((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const addCustomSpecFor = useCallback((specId: string) => {
    const t = (customSpecDraftBySpec[specId] ?? '').trim()
    if (!t || t.length > 120) return
    setCustomSpecsBySpecId((prev) => {
      const cur = prev[specId] ?? []
      if (cur.includes(t)) return prev
      return { ...prev, [specId]: [...cur, t] }
    })
    setCustomSpecDraftBySpec((d) => ({ ...d, [specId]: '' }))
  }, [customSpecDraftBySpec])

  const addCustomMethodFor = useCallback((specId: string) => {
    const t = (customMethodDraftBySpec[specId] ?? '').trim()
    if (!t || t.length > 120) return
    setCustomMethodsBySpecId((prev) => {
      const cur = prev[specId] ?? []
      if (cur.includes(t)) return prev
      return { ...prev, [specId]: [...cur, t] }
    })
    setCustomMethodDraftBySpec((d) => ({ ...d, [specId]: '' }))
  }, [customMethodDraftBySpec])

  const completenessPct = useMemo(() => {
    let ok = 0
    const total = 7
    if (
      practiceName.trim() &&
      firstName.trim() &&
      lastName.trim() &&
      plz.trim() &&
      city.trim() &&
      phone.trim() &&
      email.trim()
    )
      ok++
    if (selectedSpecialtyIds.size > 0) ok++
    if (selectedSubcategoryIds.size > 0 || allCustomSpecsFlat.length > 0) ok++
    if (selectedMethodIds.size > 0 || allCustomMethodsFlat.length > 0) ok++
    if (selectedAnimalIds.size > 0 && serviceType) ok++
    if (areaText.trim().length > 0) ok++
    return Math.min(100, Math.round((ok / total) * 100))
  }, [
    practiceName,
    firstName,
    lastName,
    plz,
    city,
    phone,
    email,
    selectedSpecialtyIds,
    selectedSubcategoryIds,
    allCustomSpecsFlat,
    selectedMethodIds,
    allCustomMethodsFlat,
    selectedAnimalIds,
    serviceType,
    areaText,
  ])

  const fachLine = useMemo(() => {
    const parts = orderedSelectedSpecialties.map((s) => directorySpecialtyDisplayName(s.code, s.name))
    return parts.length ? parts.join(' · ') : 'Noch keine Fachrichtung'
  }, [orderedSelectedSpecialties])

  const previewSpecTags = useMemo(() => {
    const fromDb = [...selectedSubcategoryIds]
      .map((id) => subcatById.get(id)?.name)
      .filter(Boolean) as string[]
    return [...fromDb, ...allCustomSpecsFlat]
  }, [selectedSubcategoryIds, subcatById, allCustomSpecsFlat])

  const methodsGeneral = useMemo(
    () => filterRowsBySearch(methodSearch, methods.filter((m) => m.directory_specialty_id == null)),
    [methods, methodSearch],
  )

  const mobileStepTitle = useMemo(() => {
    if (current === 7 && atPremiumActivateGate) return 'Premium aktivieren'
    return STEP_NAMES[current] ?? ''
  }, [current, atPremiumActivateGate])

  return (
    <div
      className={
        embeddedInApp ? 'dir-profile-onb-root dir-profile-onb-root--embedded-app' : 'dir-profile-onb-root'
      }
    >
      <div className="mobile-progress" aria-hidden={false}>
        <div className="mp-label">
          Schritt <b>{current}</b> von {TOTAL_STEPS} · <b>{mobileStepTitle}</b>
        </div>
        <div className="mp-bar">
          <div className="mp-fill" style={{ width: `${(current / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <div className="onb-layout">
        <div className="stepper">
          <div className="step-list">
            {STEPS.map((step, i) => {
              const s = step.id
              const isDone = s < current
              const isActive = s === current
              const allowPremiumStep7From6 =
                current === 6 &&
                s === 7 &&
                premiumCoreSaved &&
                directoryOnboardingProduct === 'directory_premium' &&
                !passedPremiumGate
              const isDisabled =
                !embeddedInApp && s > current && !allowPremiumStep7From6
              const lineClass = isDone ? 'step-line done' : 'step-line pending'
              return (
                <div
                  key={step.id}
                  className={`step-item${isActive ? ' active-step' : ''}${isDone ? ' done-step' : ''}${isDisabled ? ' disabled' : ''}`}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  onClick={() => !isDisabled && goStep(s)}
                  onKeyDown={(e) => {
                    if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      goStep(s)
                    }
                  }}
                >
                  <div className="step-dot-col">
                    <div
                      className={`step-dot${isDone ? ' done' : ''}${isActive ? ' active' : ''}${!isDone && !isActive ? ' pending' : ''}`}
                    >
                      {isDone ? <i className="bi bi-check-lg" style={{ fontSize: 13 }} /> : s}
                    </div>
                    {i < STEPS.length - 1 ? <div className={lineClass} /> : null}
                  </div>
                  <div className="step-info">
                    <div className="step-name">
                      {step.id === 7 && atPremiumActivateGate ? 'Premium aktivieren' : step.name}
                    </div>
                    <div className="step-sub">
                      {step.id === 7 && atPremiumActivateGate
                        ? 'Freischalten & weiter'
                        : step.sub}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="step-content">
          <div className={`step-panel${current === 1 ? ' active' : ''}`} id="panel1" role="tabpanel">
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-person-fill" /> Schritt 1
              </div>
              <h2>Stammdaten</h2>
              <p>Los geht&apos;s! Erzähl uns etwas über dich und deine Praxis.</p>
            </div>

            <div className="form-section-title">Praxis-Info</div>
            <div
              className={`form-group${wizInvalid('practiceName') ? ' form-group--invalid' : ''}`}
              data-wiz-field="practiceName"
            >
              <label className="form-label">
                Praxisname<span className="req">*</span>
              </label>
              <input
                className="form-input"
                placeholder="z.B. Tierphysiotherapie Sandra Koch"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                aria-invalid={wizInvalid('practiceName')}
              />
            </div>
            <div className="form-section-title">Ansprechpartner</div>
            <div className="form-row">
              <div
                className={`form-group${wizInvalid('nameSalutation') ? ' form-group--invalid' : ''}`}
                data-wiz-field="nameSalutation"
              >
                <label className="form-label">Anrede</label>
                <select
                  className="form-input"
                  value={nameSalutation}
                  onChange={(e) => setNameSalutation(e.target.value)}
                  aria-label="Anrede"
                  aria-invalid={wizInvalid('nameSalutation')}
                >
                  {NAME_SALUTATION_OPTIONS.map((o) => (
                    <option key={o.value || 'none'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={`form-group${wizInvalid('nameTitle') ? ' form-group--invalid' : ''}`}
                data-wiz-field="nameTitle"
              >
                <label className="form-label">Titel</label>
                <select
                  className="form-input"
                  value={nameTitlePreset}
                  onChange={(e) => setNameTitlePreset(e.target.value)}
                  aria-label="Titel"
                  aria-invalid={wizInvalid('nameTitle')}
                >
                  {NAME_TITLE_PRESETS.map((o) => (
                    <option key={o.value || 'none'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {nameTitlePreset === NAME_TITLE_CUSTOM ? (
              <div className={`form-group${wizInvalid('nameTitle') ? ' form-group--invalid' : ''}`}>
                <label className="form-label">Eigener Titel</label>
                <input
                  className="form-input"
                  placeholder="z. B. Dipl.-Ing."
                  maxLength={60}
                  value={nameTitleCustom}
                  onChange={(e) => setNameTitleCustom(e.target.value)}
                  aria-invalid={wizInvalid('nameTitle')}
                />
                <div className="form-hint">Wird wie gewohnt vor deinem Namen angezeigt (max. 60 Zeichen).</div>
              </div>
            ) : null}
            <div className="form-row">
              <div
                className={`form-group${wizInvalid('firstName') ? ' form-group--invalid' : ''}`}
                data-wiz-field="firstName"
              >
                <label className="form-label">
                  Vorname<span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="Vorname"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  aria-invalid={wizInvalid('firstName')}
                />
              </div>
              <div
                className={`form-group${wizInvalid('lastName') ? ' form-group--invalid' : ''}`}
                data-wiz-field="lastName"
              >
                <label className="form-label">
                  Nachname<span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="Nachname"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  aria-invalid={wizInvalid('lastName')}
                />
              </div>
            </div>
            <p className="form-hint" style={{ marginTop: -4, marginBottom: 16 }}>
              In der öffentlichen Anzeige erscheint <strong>Titel + Vor- und Nachname</strong> (ohne Anrede).
            </p>
            <div
              className={`form-group${wizInvalid('shortDesc') ? ' form-group--invalid' : ''}`}
              data-wiz-field="shortDesc"
            >
              <label className="form-label">Kurzbeschreibung</label>
              <textarea
                className="form-input"
                placeholder="Beschreibe in 2-3 Sätzen, was du machst und was dich auszeichnet..."
                maxLength={1000}
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                aria-invalid={wizInvalid('shortDesc')}
              />
              <div className="form-counter">{shortDesc.length} / 1000</div>
            </div>

            <div className="form-section-title">Adresse</div>
            <div className="form-group">
              <label className="form-label">Adresse suchen</label>
              <AddressAutocomplete
                className="form-input"
                placeholder="Straße, PLZ oder Ort eingeben (Vorschläge aus D-A-CH)"
                ariaLabel="Adresse suchen"
                value={addressSearch}
                onValueChange={setAddressSearch}
                onSelect={onAddressSuggestion}
                persistQueryOnSelect
                bbox={DIRECTORY_PHOTON_DACH_BBOX}
                allowedCountryCodes={DIRECTORY_AUTOCOMPLETE_COUNTRY_CODES}
              />
              <div className="form-hint">
                Wähle einen Vorschlag: Straße, PLZ und Ort werden übernommen, der Standort für Karte und Umkreissuche gespeichert.
                Du kannst die Felder darunter bei Bedarf noch anpassen (dann bitte Adresse erneut per Suche wählen, wenn der Pin
                passen soll).
              </div>
            </div>
            {latitude != null && longitude != null ? (
              <p className="form-hint" style={{ marginTop: -8, color: '#166534' }}>
                <i className="bi bi-geo-alt-fill" aria-hidden /> Standort für Karte gespeichert (Koordinaten übernommen).
              </p>
            ) : null}
            <div className="form-row form-row--address">
              <div
                className={`form-group${wizInvalid('street') ? ' form-group--invalid' : ''}`}
                data-wiz-field="street"
              >
                <label className="form-label">Straße + Hausnummer</label>
                <input
                  className="form-input"
                  placeholder="Hauptstr. 12"
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value)
                    clearGeo()
                  }}
                  aria-invalid={wizInvalid('street')}
                />
              </div>
              <div
                className={`form-group${wizInvalid('plz') ? ' form-group--invalid' : ''}`}
                data-wiz-field="plz"
              >
                <label className="form-label">
                  PLZ<span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder={country === 'DE' ? '53567' : '4020'}
                  maxLength={country === 'DE' ? 5 : 4}
                  inputMode="numeric"
                  value={plz}
                  onChange={(e) => {
                    const max = country === 'DE' ? 5 : 4
                    setPlz(e.target.value.replace(/\D/g, '').slice(0, max))
                    clearGeo()
                  }}
                  aria-invalid={wizInvalid('plz')}
                />
              </div>
              <div
                className={`form-group${wizInvalid('city') ? ' form-group--invalid' : ''}`}
                data-wiz-field="city"
              >
                <label className="form-label">
                  Ort<span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="Ort"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value)
                    clearGeo()
                  }}
                  aria-invalid={wizInvalid('city')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Land</label>
                <select
                  className="form-input"
                  value={country}
                  onChange={(e) => {
                    const nc = e.target.value as 'DE' | 'AT' | 'CH'
                    setCountry(nc)
                    setPlz((prev) => (nc === 'DE' ? prev.replace(/\D/g, '').slice(0, 5) : prev.replace(/\D/g, '').slice(0, 4)))
                    clearGeo()
                  }}
                  aria-label="Land"
                >
                  <option value="DE">Deutschland</option>
                  <option value="AT">Österreich</option>
                  <option value="CH">Schweiz</option>
                </select>
              </div>
            </div>

            <div className="form-section-title">Kontakt</div>
            <div className="form-row">
              <div
                className={`form-group${wizInvalid('phone') ? ' form-group--invalid' : ''}`}
                data-wiz-field="phone"
              >
                <label className="form-label">
                  Telefon<span className="req">*</span>
                </label>
                <div className="form-icon-input">
                  <i className="bi bi-telephone-fill" />
                  <input
                    className="form-input"
                    placeholder="0170 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={wizInvalid('phone')}
                  />
                </div>
              </div>
              <div
                className={`form-group${wizInvalid('email') ? ' form-group--invalid' : ''}`}
                data-wiz-field="email"
              >
                <label className="form-label">
                  E-Mail<span className="req">*</span>
                </label>
                <div className="form-icon-input">
                  <i className="bi bi-envelope-fill" />
                  <input
                    className="form-input"
                    type="email"
                    placeholder="email@beispiel.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-describedby="dir-wiz-email-public-hint"
                    aria-invalid={wizInvalid('email')}
                  />
                </div>
                <p id="dir-wiz-email-public-hint" className="form-hint" style={{ marginTop: 6 }}>
                  Wird <strong>nicht</strong> im öffentlichen Profil angezeigt. Mit aktivem Top-Profil nutzen wir diese
                  Adresse, um dir Anfragen aus dem <strong>Kontaktformular</strong> per E-Mail zuzustellen.
                </p>
              </div>
            </div>
            <div
              className={`form-group${wizInvalid('website') ? ' form-group--invalid' : ''}`}
              data-wiz-field="website"
            >
              <label className="form-label">Website</label>
              <div className="form-icon-input">
                <i className="bi bi-globe2" />
                <input
                  className="form-input"
                  placeholder="https://www.deine-seite.de"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  aria-invalid={wizInvalid('website')}
                />
              </div>
            </div>

            <div className="form-section-title">Social Media</div>
            <p className="form-hint" style={{ marginTop: -4, marginBottom: 12 }}>
              Zusätzliche Profile (Instagram, Facebook …). Pro Plattform ein Link — mit &quot;+&quot; weitere Zeilen
              hinzufügen.
            </p>
            {socialRows.map((row, idx) => {
              const platformOptions = WIZARD_SOCIAL_PLATFORM_OPTIONS.filter(
                (opt) =>
                  opt.value === row.platform ||
                  !socialRows.some((r, j) => j !== idx && r.platform === opt.value),
              )
              return (
                <div
                  className={`form-row form-row--social dir-wiz-social-row${wizInvalid(`social-row-${idx}`) ? ' dir-wiz-social-row--invalid' : ''}`}
                  key={`social-${idx}`}
                  data-wiz-field={`social-row-${idx}`}
                >
                  <div className="form-group dir-wiz-social-platform">
                    <label className="form-label">Plattform</label>
                    <select
                      className="form-input"
                      value={row.platform}
                      onChange={(e) => updateSocialRow(idx, { platform: e.target.value })}
                      aria-label={`Social-Plattform ${idx + 1}`}
                    >
                      <option value="">— wählen —</option>
                      {platformOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group dir-wiz-social-url">
                    <label className="form-label">Profil-URL</label>
                    <div className="form-icon-input">
                      <i className="bi bi-link-45deg" aria-hidden />
                      <input
                        className="form-input"
                        placeholder="https://…"
                        value={row.url}
                        onChange={(e) => updateSocialRow(idx, { url: e.target.value })}
                        autoComplete="url"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dir-wiz-social-remove"
                    onClick={() => removeSocialRow(idx)}
                    aria-label="Social-Zeile entfernen"
                  >
                    <i className="bi bi-trash" aria-hidden />
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              className="dir-wiz-social-add"
              onClick={addSocialRow}
              disabled={socialRows.length >= MAX_WIZARD_SOCIAL_ROWS}
            >
              <i className="bi bi-plus-lg" aria-hidden />
              Social-Medien-Link hinzufügen
            </button>

            <div className="form-section-title">Öffnungszeiten &amp; Erreichbarkeit</div>
            <p className="form-hint" style={{ marginTop: -4, marginBottom: 12 }}>
              Optional. Pro Wochentag wie bei Karten-Profilen: geschlossen oder eine/zwei Zeitspannen (z.&nbsp;B.
              Mittagspause). Ergänzungen zu telefonischer Erreichbarkeit oder Feiertagen unten im Freitextfeld.
            </p>
            <div
              className={`dir-wiz-hours${wizInvalid('opening-hours') ? ' dir-wiz-hours--invalid' : ''}`}
              data-wiz-field="opening-hours"
            >
              {DIRECTORY_WEEKDAY_KEYS.map((dk) => {
                const row = hoursByDay[dk] ?? defaultDayHoursFormState()
                return (
                  <div key={dk} className="dir-wiz-hours-day">
                    <div className="dir-wiz-hours-day-label">{DIRECTORY_WEEKDAY_LABEL_DE[dk]}</div>
                    <label className="dir-wiz-hours-closed">
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={(e) => patchHoursDay(dk, { closed: e.target.checked })}
                      />
                      Geschlossen
                    </label>
                    {!row.closed ? (
                      <div className="dir-wiz-hours-slots">
                        <div className="dir-wiz-hours-slot">
                          <TimePicker
                            className="dir-wiz-hours-time"
                            value={row.open1}
                            onChange={(v) => patchHoursDay(dk, { open1: v })}
                          />
                          <span className="dir-wiz-hours-sep">–</span>
                          <TimePicker
                            className="dir-wiz-hours-time"
                            value={row.close1}
                            onChange={(v) => patchHoursDay(dk, { close1: v })}
                          />
                        </div>
                        <label className="dir-wiz-hours-split-toggle">
                          <input
                            type="checkbox"
                            checked={row.useSecondPeriod}
                            onChange={(e) => patchHoursDay(dk, { useSecondPeriod: e.target.checked })}
                          />
                          Zweite Zeitspanne
                        </label>
                        {row.useSecondPeriod ? (
                          <div className="dir-wiz-hours-slot dir-wiz-hours-slot--2">
                            <TimePicker
                              className="dir-wiz-hours-time"
                              value={row.open2}
                              onChange={(v) => patchHoursDay(dk, { open2: v })}
                            />
                            <span className="dir-wiz-hours-sep">–</span>
                            <TimePicker
                              className="dir-wiz-hours-time"
                              value={row.close2}
                              onChange={(v) => patchHoursDay(dk, { close2: v })}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div
              className={`form-group${wizInvalid('openingHoursNote') ? ' form-group--invalid' : ''}`}
              style={{ marginTop: 16 }}
              data-wiz-field="openingHoursNote"
            >
              <label className="form-label">Hinweis (Erreichbarkeit, Feiertage, Abweichungen)</label>
              <textarea
                className="form-input"
                placeholder="z.&nbsp;B. Telefonisch Mo–Fr 9–12 Uhr · Termine auch abends nach Vereinbarung …"
                maxLength={800}
                value={openingHoursNote}
                onChange={(e) => setOpeningHoursNote(e.target.value)}
                rows={3}
                aria-invalid={wizInvalid('openingHoursNote')}
              />
              <div className="form-counter">{openingHoursNote.length} / 800</div>
            </div>

          </div>

          <div className={`step-panel${current === 2 ? ' active' : ''}`} id="panel2" role="tabpanel">
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-heart-pulse-fill" /> Schritt 2
              </div>
              <h2>Fachrichtungen</h2>
              <p>Was ist dein Fachgebiet? Du kannst mehrere wählen.</p>
            </div>
            {specialties.length === 0 ? (
              <p className="form-hint" role="status">
                Keine Fachrichtungen geladen. Prüfe: (1) <code>.env.local</code> zeigt auf das richtige Supabase-Projekt,
                (2) Migrationen sind angewendet (<code>supabase db push</code> oder Dashboard SQL), (3) in{' '}
                <code>directory_specialties</code> existieren Zeilen mit <code>is_active = true</code>.
              </p>
            ) : (
              <div
                className={`sel-grid${wizInvalid('specialties') ? ' dir-wiz-sel--invalid' : ''}`}
                data-wiz-field="specialties"
              >
                {wizardSpecialties.map((card) => {
                  const desc = (card.description ?? '').trim() || '—'
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`sel-card${selectedSpecialtyIds.has(card.id) ? ' selected' : ''}`}
                      onClick={() => toggleSpecialty(card.id)}
                    >
                      <span className="sel-check">
                        <i className="bi bi-check-lg" />
                      </span>
                      <div className="sel-icon">
                        <DirectoryCategoryCardIcon
                          code={card.code}
                          imgClassName="cat-icon-img onb-wizard-sel-cat-icon-img"
                        />
                      </div>
                      <div className="sel-name">{directorySpecialtyDisplayName(card.code, card.name)}</div>
                      <div className="sel-desc">{desc}</div>
                    </button>
                  )
                })}
              </div>
            )}
            {selectedSpecialtyIds.size > 0 ? (
              <div className="selected-summary">
                <span className="ss-label">Gewählt:</span>
                {orderedSelectedSpecialties.map((c) => (
                  <span key={c.id} className="ss-chip">
                    {directorySpecialtyDisplayName(c.code, c.name)}
                    <i
                      className="bi bi-x-lg"
                      role="button"
                      tabIndex={0}
                      aria-label={`${c.name} entfernen`}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSpecialty(c.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          removeSpecialty(c.id)
                        }
                      }}
                    />
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className={`step-panel${current === 3 ? ' active' : ''}`} id="panel3" role="tabpanel">
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-mortarboard-fill" /> Schritt 3
              </div>
              <h2>Spezialisierungen</h2>
              <p>Worauf hast du dich spezialisiert? Es erscheinen nur Einträge zu deinen gewählten Fachrichtungen.</p>
            </div>
            {orderedSelectedSpecialties.length === 0 ? (
              <p className="form-hint">Bitte wähle zuerst mindestens eine Fachrichtung (Schritt 2).</p>
            ) : (
              <>
                <div className="chip-search">
                  <i className="bi bi-search" />
                  <input
                    placeholder="Spezialisierung suchen..."
                    value={specSearch}
                    onChange={(e) => setSpecSearch(e.target.value)}
                  />
                </div>
                {orderedSelectedSpecialties.map((spec) => {
                  const rows = filterRowsBySearch(
                    specSearch,
                    subcategories.filter((sc) => sc.directory_specialty_code === spec.code),
                  )
                  const specLabel = directorySpecialtyDisplayName(spec.code, spec.name)
                  const own = customSpecsBySpecId[spec.id] ?? []
                  const specBlockKey = `spec-block-${spec.id}`
                  return (
                    <div
                      key={spec.id}
                      className={`dir-wiz-spec-block${wizInvalid(specBlockKey) ? ' dir-wiz-block--invalid' : ''}`}
                      data-wiz-field={specBlockKey}
                    >
                      <div className="dir-wiz-spec-block-title">
                        <DirectoryCategoryCardIcon
                          code={spec.code}
                          imgClassName="cat-icon-img onb-wizard-chip-cat-icon-img"
                        />
                        {specLabel}
                      </div>
                      <div className="chip-wrap">
                        {rows.length === 0 ? (
                          <span className="form-hint" style={{ display: 'block', marginBottom: 8 }}>
                            {subcategories.length === 0
                              ? 'Keine Spezialisierungen aus der API geladen — Migrationen (directory_subcategories + View directory_public_subcategories) prüfen.'
                              : 'Für diese Fachrichtung sind keine Spezialisierungen hinterlegt — nutze unten „Eigene hinzufügen“.'}
                          </span>
                        ) : (
                          rows.map((row) => (
                            <button
                              key={row.id}
                              type="button"
                              className={`chip${selectedSubcategoryIds.has(row.id) ? ' selected' : ''}`}
                              onClick={() => toggleIdInSet(setSelectedSubcategoryIds, row.id)}
                            >
                              {row.name}
                            </button>
                          ))
                        )}
                      </div>
                      <div className="dir-wiz-own-label">Eigene Spezialisierungen ({specLabel})</div>
                      <p className="form-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                        Ergänzt fehlende Einträge — erscheint im Profil unter dieser Fachrichtung.
                      </p>
                      <div className="quali-input-wrap">
                        <input
                          className="form-input"
                          placeholder="z.B. Sportmedizin Pferd"
                          maxLength={120}
                          value={customSpecDraftBySpec[spec.id] ?? ''}
                          onChange={(e) =>
                            setCustomSpecDraftBySpec((d) => ({ ...d, [spec.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addCustomSpecFor(spec.id)
                            }
                          }}
                        />
                        <button type="button" onClick={() => addCustomSpecFor(spec.id)}>
                          Hinzufügen
                        </button>
                      </div>
                      <div className="chip-wrap" style={{ marginTop: 10 }}>
                        {own.map((label) => (
                          <button
                            key={`${spec.id}-${label}`}
                            type="button"
                            className="chip selected"
                            onClick={() =>
                              setCustomSpecsBySpecId((prev) => ({
                                ...prev,
                                [spec.id]: (prev[spec.id] ?? []).filter((x) => x !== label),
                              }))
                            }
                          >
                            {label}
                            <i className="bi bi-x-lg" style={{ marginLeft: 6 }} aria-hidden />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div className={`step-panel${current === 4 ? ' active' : ''}`} id="panel4" role="tabpanel">
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-clipboard2-pulse-fill" /> Schritt 4
              </div>
              <h2>Methoden & Leistungen</h2>
              <p>Methoden aus der Datenbank — gefiltert nach deinen Fachrichtungen — plus eigene Einträge.</p>
            </div>
            {orderedSelectedSpecialties.length === 0 ? (
              <p className="form-hint">Bitte wähle zuerst mindestens eine Fachrichtung (Schritt 2).</p>
            ) : (
              <div
                className={wizInvalid('methods') ? 'dir-wiz-methods-scope dir-wiz-methods-scope--invalid' : 'dir-wiz-methods-scope'}
                data-wiz-field="methods"
              >
                <div className="chip-search">
                  <i className="bi bi-search" />
                  <input
                    placeholder="Methode suchen..."
                    value={methodSearch}
                    onChange={(e) => setMethodSearch(e.target.value)}
                  />
                </div>
                {methodsGeneral.length > 0 ? (
                  <div className="dir-wiz-spec-block">
                    <div className="dir-wiz-spec-block-title">
                      <i className="bi bi-stars" />
                      Allgemein
                    </div>
                    <div className="chip-wrap">
                      {methodsGeneral.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          className={`chip${selectedMethodIds.has(row.id) ? ' selected' : ''}`}
                          onClick={() => toggleIdInSet(setSelectedMethodIds, row.id)}
                        >
                          {row.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {orderedSelectedSpecialties.map((spec) => {
                  const rows = filterRowsBySearch(
                    methodSearch,
                    methods.filter((m) => m.directory_specialty_code === spec.code),
                  )
                  const specLabel = directorySpecialtyDisplayName(spec.code, spec.name)
                  const ownM = customMethodsBySpecId[spec.id] ?? []
                  return (
                    <div key={spec.id} className="dir-wiz-spec-block">
                      <div className="dir-wiz-spec-block-title">
                        <DirectoryCategoryCardIcon
                          code={spec.code}
                          imgClassName="cat-icon-img onb-wizard-chip-cat-icon-img"
                        />
                        {specLabel}
                      </div>
                      <div className="chip-wrap">
                        {rows.length === 0 ? (
                          <span className="form-hint" style={{ display: 'block', marginBottom: 8 }}>
                            Für diese Fachrichtung sind keine Methoden hinterlegt — nutze unten „Eigene hinzufügen“.
                          </span>
                        ) : (
                          rows.map((row) => (
                            <button
                              key={row.id}
                              type="button"
                              className={`chip${selectedMethodIds.has(row.id) ? ' selected' : ''}`}
                              onClick={() => toggleIdInSet(setSelectedMethodIds, row.id)}
                            >
                              {row.name}
                            </button>
                          ))
                        )}
                      </div>
                      <div className="dir-wiz-own-label">Eigene Methoden / Leistungen ({specLabel})</div>
                      <div className="quali-input-wrap">
                        <input
                          className="form-input"
                          placeholder="z.B. Hausbesuche am Wochenende"
                          maxLength={120}
                          value={customMethodDraftBySpec[spec.id] ?? ''}
                          onChange={(e) =>
                            setCustomMethodDraftBySpec((d) => ({ ...d, [spec.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addCustomMethodFor(spec.id)
                            }
                          }}
                        />
                        <button type="button" onClick={() => addCustomMethodFor(spec.id)}>
                          Hinzufügen
                        </button>
                      </div>
                      <div className="chip-wrap" style={{ marginTop: 10 }}>
                        {ownM.map((label) => (
                          <button
                            key={`${spec.id}-m-${label}`}
                            type="button"
                            className="chip selected"
                            onClick={() =>
                              setCustomMethodsBySpecId((prev) => ({
                                ...prev,
                                [spec.id]: (prev[spec.id] ?? []).filter((x) => x !== label),
                              }))
                            }
                          >
                            {label}
                            <i className="bi bi-x-lg" style={{ marginLeft: 6 }} aria-hidden />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className={`step-panel${current === 5 ? ' active' : ''}`} id="panel5" role="tabpanel">
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-feather2" /> Schritt 5
              </div>
              <h2>Tierarten & Arbeitsweise</h2>
              <p>Welche Tiere behandelst du und wie arbeitest du?</p>
            </div>
            <div className="form-section-title" style={{ border: 'none', marginTop: 0, paddingTop: 0 }}>
              Tierarten
            </div>
            <div
              className={`sel-grid-sm${wizInvalid('animals') ? ' dir-wiz-sel--invalid' : ''}`}
              data-wiz-field="animals"
            >
              {animals.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`sel-card-sm${selectedAnimalIds.has(a.id) ? ' selected' : ''}`}
                  onClick={() => toggleIdInSet(setSelectedAnimalIds, a.id)}
                >
                  <span className="sel-emoji">{ANIMAL_EMOJI[a.code] ?? '🐾'}</span>
                  <div className="sel-name">{a.name}</div>
                </button>
              ))}
            </div>
            <div className="form-section-title">Arbeitsweise</div>
            <div
              className={`sel-grid-work${wizInvalid('serviceType') ? ' dir-wiz-sel--invalid' : ''}`}
              data-wiz-field="serviceType"
            >
              {WORK_MODES.map((w) => (
                <button
                  key={w.code}
                  type="button"
                  className={`sel-card-work${serviceType === w.code ? ' selected' : ''}`}
                  onClick={() => setServiceType(w.code)}
                >
                  <span className="sel-emoji">{w.emoji}</span>
                  <div className="sel-name">{w.name}</div>
                  <div className="sel-desc">{w.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className={`step-panel${current === 6 ? ' active' : ''}`} id="panel6" role="tabpanel">
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-geo-alt-fill" /> Schritt 6
              </div>
              <h2>Einsatzgebiet</h2>
              <p>Wo bist du unterwegs? Definiere dein Einsatzgebiet.</p>
            </div>
            <div className="form-section-title" style={{ border: 'none', marginTop: 0, paddingTop: 0 }}>
              Einsatzradius
            </div>
            <div className="range-wrap">
              <div className="range-display">
                <div className="range-val">{radiusKm}</div>
                <div className="range-unit">km um deinen Standort</div>
              </div>
              <input type="range" min={5} max={150} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
              <div className="range-labels">
                <span>5 km</span>
                <span>50 km</span>
                <span>100 km</span>
                <span>150 km</span>
              </div>
            </div>
            <DirectoryWizardMapPreview
              latitude={latitude}
              longitude={longitude}
              radiusKm={radiusKm}
              title={personDisplayName || practiceName}
              cityLine={[plz, city].filter(Boolean).join(' ')}
            />
            <div className="form-section-title">Einsatzgebiet beschreiben</div>
            <div
              className={`form-group${wizInvalid('areaText') ? ' form-group--invalid' : ''}`}
              data-wiz-field="areaText"
            >
              <textarea
                className="form-input"
                placeholder='z.B. "Westerwald, Raum Neuwied, Altenkirchen, Dierdorf. Auch gerne weiter nach Absprache."'
                maxLength={300}
                value={areaText}
                onChange={(e) => setAreaText(e.target.value)}
                aria-invalid={wizInvalid('areaText')}
              />
              <div className="form-counter">{areaText.length} / 300</div>
            </div>
            <div className="form-section-title">Qualifikationen & Zertifikate</div>
            <div
              className={wizInvalid('quali') ? 'dir-wiz-quali-wrap dir-wiz-quali-wrap--invalid' : 'dir-wiz-quali-wrap'}
              data-wiz-field="quali"
            >
            <div className="quali-input-wrap">
              <input
                className="form-input"
                placeholder="z.B. BPHC zertifiziert, §11 TierSchG..."
                value={qualiDraft}
                onChange={(e) => setQualiDraft(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  const t = qualiDraft.trim()
                  if (!t) return
                  setQualiItems((q) => (q.includes(t) ? q : [...q, t]))
                  setQualiDraft('')
                }}
              >
                Hinzufügen
              </button>
            </div>
            <div className="quali-list">
              {qualiItems.map((q, idx) => (
                <div key={`${q}-${idx}`} className="quali-item">
                  <i className="bi bi-patch-check-fill qi-icon" />
                  {q}
                  <button
                    type="button"
                    className="qi-remove"
                    aria-label="Eintrag entfernen"
                    onClick={() => setQualiItems((items) => items.filter((_, i) => i !== idx))}
                  >
                    <i className="bi bi-x-lg" aria-hidden />
                    <span className="qi-remove-label">Entfernen</span>
                  </button>
                </div>
              ))}
            </div>
            </div>
          </div>

          <div className={`step-panel${current === 7 ? ' active' : ''}`} id="panel7" role="tabpanel">
            {atPremiumActivateGate ? (
              <div className="dir-wiz-premium-gate">
                <div className="step-header">
                  <div className="hero-tag">
                    <i className="bi bi-gem" aria-hidden /> Schritt 7
                  </div>
                  <h2>Premium aktivieren</h2>
                  <p>
                    Dein Profil ist bereits gespeichert. Mit Premium schaltest du jetzt Bildergalerie, Kontaktformular
                    und die hochwertigere Profildarstellung frei.
                  </p>
                </div>
                <div
                  className="dir-wiz-premium-gate-actions"
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}
                >
                  <button
                    type="button"
                    className="step-footer-primary"
                    style={{ justifyContent: 'center' }}
                    disabled={premiumCheckoutLoading}
                    onClick={() => void startDirectoryPremiumCheckout()}
                  >
                    {premiumCheckoutLoading ? 'Weiterleitung…' : 'Premium jetzt aktivieren'}
                  </button>
                  <button
                    type="button"
                    className="step-footer-back"
                    style={{ justifyContent: 'center' }}
                    disabled={premiumCheckoutLoading}
                    onClick={() => void onMitGratisWeiter()}
                  >
                    Mit Gratis weiter
                  </button>
                </div>
                {submitError ? (
                  <div
                    className="form-hint app-info-callout"
                    role="alert"
                    style={{
                      marginTop: 14,
                      padding: 12,
                    }}
                  >
                    {submitError}
                  </div>
                ) : null}
                <p className="form-hint" style={{ marginTop: 20 }}>
                  Du kannst Premium später jederzeit unter „Mein Profil“ aktivieren.
                </p>
              </div>
            ) : (
              <>
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-images" /> Schritt 7
              </div>
              <h2>Logo &amp; Galerie</h2>
              <p>
                Optional: Ein <strong>Logo</strong> für die Kurzinfo
                {galleryEnabled
                  ? ` und bis zu ${MAX_GALLERY_PHOTOS} Galeriebilder für dein öffentliches Profil (JPG, PNG, WebP oder GIF, je max. 5 MB). Galeriefotos werden vor dem Upload auf 800×450 bzw. 450×800 zugeschnitten.`
                  : '. Die Bildergalerie ist Teil des Top-/Premium-Profils und erscheint nur bei aktivem Top-Profil.'}
              </p>
            </div>
            {embeddedInApp ? (
              <div className="dir-wiz-media">
                <div className="form-section-title" style={{ border: 'none', marginTop: 0, paddingTop: 0 }}>
                  Logo
                </div>
                <p className="form-hint" style={{ marginBottom: 12 }}>
                  Wird in der Kurzinfo-Karte und als Hero-Motiv genutzt, wenn du kein Galeriefoto setzt.
                </p>
                <div className="dir-wiz-media-logo">
                  {logoPreviewUrl ? (
                    <div className="dir-wiz-media-preview dir-wiz-media-preview--logo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreviewUrl} alt="Logo-Vorschau" />
                      <button type="button" className="dir-wiz-media-remove" onClick={clearLogo} aria-label="Logo entfernen">
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  ) : persistedLogoUrl ? (
                    <div className="dir-wiz-media-preview dir-wiz-media-preview--logo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={persistedLogoUrl} alt="Aktuelles Logo" />
                      <button type="button" className="dir-wiz-media-remove" onClick={clearLogo} aria-label="Logo entfernen">
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  ) : (
                    <label className="dir-wiz-media-drop">
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onLogoFileChange} />
                      <i className="bi bi-image" aria-hidden />
                      <span>Logo auswählen</span>
                    </label>
                  )}
                </div>
                {galleryEnabled ? (
                  <>
                    <div className="form-section-title">Galerie (max. {MAX_GALLERY_PHOTOS} Bilder)</div>
                    <div className="dir-wiz-media-grid">
                      {serverPhotoRows.map((row) => (
                        <div key={row.id} className="dir-wiz-media-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.url} alt="Galeriebild" />
                          <button
                            type="button"
                            className="dir-wiz-media-remove"
                            onClick={() => removeServerPhoto(row.id)}
                            aria-label="Galeriebild entfernen"
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>
                      ))}
                      {photoPreviewUrls.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="dir-wiz-media-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Neues Bild ${idx + 1}`} />
                          <button
                            type="button"
                            className="dir-wiz-media-remove"
                            onClick={() => removeGalleryAt(idx)}
                            aria-label={`Neues Bild ${idx + 1} entfernen`}
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>
                      ))}
                      {gallerySlotsLeft > 0 ? (
                        <label className="dir-wiz-media-drop dir-wiz-media-drop--tile">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            onChange={onGalleryFilesChange}
                          />
                          <i className="bi bi-plus-lg" aria-hidden />
                          <span>
                            {gallerySlotsUsed === 0 ? 'Bilder hinzufügen' : 'Weitere wählen'} ({gallerySlotsLeft} frei)
                          </span>
                        </label>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="form-hint" style={{ marginTop: 16 }}>
                    <strong>Galerie &amp; Kontaktformular</strong> gehören zum <strong>Premium-Verzeichnisprofil</strong>{' '}
                    bzw. zur <strong>AniDocs App</strong> (Premium-Verzeichnis inklusive). Mit dem Gratis-Paket bleibt
                    dein Eintrag mit Logo, Text und Links sichtbar.
                  </p>
                )}
              </div>
            ) : (
              <div className="dir-wiz-media">
                <div className="form-section-title" style={{ border: 'none', marginTop: 0, paddingTop: 0 }}>
                  Logo
                </div>
                <p className="form-hint" style={{ marginBottom: 12 }}>
                  {galleryEnabled
                    ? 'Wird in der Kurzinfo-Karte genutzt. Mit Premium kannst du zusätzlich eine Galerie hochladen.'
                    : 'Optional — wird in der Kurzinfo-Karte genutzt. Mit dem Gratis-Paket bleibt dein Eintrag mit Logo, Text und Links sichtbar.'}
                </p>
                <div className="dir-wiz-media-logo">
                  {logoPreviewUrl ? (
                    <div className="dir-wiz-media-preview dir-wiz-media-preview--logo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreviewUrl} alt="Logo-Vorschau" />
                      <button type="button" className="dir-wiz-media-remove" onClick={clearLogo} aria-label="Logo entfernen">
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  ) : (
                    <label className="dir-wiz-media-drop">
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onLogoFileChange} />
                      <i className="bi bi-image" aria-hidden />
                      <span>Logo auswählen</span>
                    </label>
                  )}
                </div>
                {galleryEnabled ? (
                  <>
                    <div className="form-section-title">Galerie (max. {MAX_GALLERY_PHOTOS} Bilder)</div>
                    <div className="dir-wiz-media-grid">
                      {photoPreviewUrls.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="dir-wiz-media-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Neues Bild ${idx + 1}`} />
                          <button
                            type="button"
                            className="dir-wiz-media-remove"
                            onClick={() => removeGalleryAt(idx)}
                            aria-label={`Neues Bild ${idx + 1} entfernen`}
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>
                      ))}
                      {gallerySlotsLeft > 0 ? (
                        <label className="dir-wiz-media-drop dir-wiz-media-drop--tile">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            onChange={onGalleryFilesChange}
                          />
                          <i className="bi bi-plus-lg" aria-hidden />
                          <span>
                            {gallerySlotsUsed === 0 ? 'Bilder hinzufügen' : 'Weitere wählen'} ({gallerySlotsLeft} frei)
                          </span>
                        </label>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="form-hint" style={{ marginTop: 16 }}>
                    <strong>Galerie &amp; Kontaktformular</strong> gehören zum <strong>Premium-Verzeichnisprofil</strong>{' '}
                    bzw. zur <strong>AniDocs App</strong>. Mit dem Gratis-Paket bleibt dein Eintrag mit Logo, Text und
                    Links sichtbar.
                  </p>
                )}
              </div>
            )}
              </>
            )}
          </div>

          <div className={`step-panel${current === 8 ? ' active' : ''}`} id="panel8" role="tabpanel">
            <div className="step-header">
              <div className="hero-tag">
                <i className="bi bi-eye-fill" /> Schritt 8
              </div>
              <h2>Vorschau</h2>
              <p>
                Überprüfe deine Angaben. Mit „Fertig“ wird ein <strong>Entwurfsprofil</strong> gespeichert — die öffentliche
                Veröffentlichung erfolgt später nach Freigabe.
              </p>
            </div>
            {isPending ? (
              <div
                className="form-hint"
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(82, 183, 136, 0.12)',
                  color: '#154226',
                }}
                role="status"
                aria-live="polite"
              >
                Daten werden gespeichert …
              </div>
            ) : null}
            {saveSuccessMessage ? (
              <div
                className="form-hint directory-success-callout"
                style={{
                  marginBottom: 16,
                  padding: 12,
                }}
                role="status"
              >
                {saveSuccessMessage}
              </div>
            ) : null}
            {submitError ? (
              <div
                className="form-hint app-info-callout"
                style={{ marginBottom: 16, padding: 12 }}
                role="alert"
              >
                {submitError}
              </div>
            ) : null}
            <div className="preview-tabs">
              <button
                type="button"
                className={`preview-tab${previewTab === 'card' ? ' active' : ''}`}
                onClick={() => setPreviewTab('card')}
              >
                Kartenansicht
              </button>
              <button
                type="button"
                className={`preview-tab${previewTab === 'page' ? ' active' : ''}`}
                onClick={() => setPreviewTab('page')}
              >
                Profilseite
              </button>
            </div>
            <div className="preview-card">
              <div className="prev-header">
                <div className="prev-avatar">{initials(personDisplayName || practiceName)}</div>
                <div>
                  <div className="prev-name">
                    {personDisplayName || 'Dein Name'}{' '}
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <i className="bi bi-check-lg" style={{ fontSize: 8, color: '#fff' }} />
                    </span>
                  </div>
                  <div className="prev-fach">{fachLine}</div>
                  <div className="prev-loc">
                    <i className="bi bi-geo-alt-fill" />
                    {city || 'Ort'} · {serviceLabel(serviceType)} · {radiusKm} km
                  </div>
                </div>
              </div>
              <div className="prev-tags">
                {previewSpecTags.slice(0, 4).map((t) => (
                  <span key={t} className="prev-tag green">
                    {t}
                  </span>
                ))}
                {[...selectedAnimalIds].map((id) => {
                  const a = animals.find((x) => x.id === id)
                  return a ? (
                    <span key={id} className="prev-tag blue">
                      {a.name}
                    </span>
                  ) : null
                })}
                {serviceType ? <span className="prev-tag orange">{serviceLabel(serviceType)}</span> : null}
              </div>
              <div className="prev-desc">
                {shortDesc.trim() ||
                  'Hier erscheint deine Kurzbeschreibung, sobald du sie in Schritt 1 einträgst.'}
              </div>
              <div className="prev-footer">
                <div className="prev-rating">
                  <i className="bi bi-star-fill" style={{ color: 'var(--warn)' }} />
                  Noch keine Bewertungen
                </div>
                <button type="button" className="prev-edit" onClick={() => goStep(1)}>
                  <i className="bi bi-pencil-fill" />
                  Bearbeiten
                </button>
              </div>
            </div>
            {previewTab === 'page' ? (
              <p className="form-hint" style={{ marginTop: 16 }}>
                Die Vollansicht der Profilseite orientiert sich später an der öffentlichen Behandler-Detailseite.
              </p>
            ) : null}

            <div className="completeness">
              <div className="comp-header">
                <span className="comp-title">Profil-Vollständigkeit</span>
                <span className="comp-pct">{completenessPct}%</span>
              </div>
              <div className="comp-bar">
                <div className="comp-fill" style={{ width: `${completenessPct}%` }} />
              </div>
              <div className="comp-items">
                <div className="comp-item">
                  <i
                    className={`bi ${
                      practiceName && firstName.trim() && lastName.trim() ? 'bi-check-circle-fill done' : 'bi-circle miss'
                    }`}
                  />
                  Stammdaten ausgefüllt
                </div>
                <div className="comp-item">
                  <i className={`bi ${selectedSpecialtyIds.size ? 'bi-check-circle-fill done' : 'bi-circle miss'}`} />
                  Fachrichtungen gewählt
                </div>
                <div className="comp-item">
                  <i
                    className={`bi ${
                      selectedSubcategoryIds.size || allCustomSpecsFlat.length ? 'bi-check-circle-fill done' : 'bi-circle miss'
                    }`}
                  />
                  Spezialisierungen gewählt
                </div>
                <div className="comp-item">
                  <i
                    className={`bi ${
                      selectedMethodIds.size || allCustomMethodsFlat.length ? 'bi-check-circle-fill done' : 'bi-circle miss'
                    }`}
                  />
                  Methoden hinzugefügt
                </div>
                <div className="comp-item">
                  <i
                    className={`bi ${selectedAnimalIds.size && serviceType ? 'bi-check-circle-fill done' : 'bi-circle miss'}`}
                  />
                  Tierarten & Arbeitsweise
                </div>
                <div className="comp-item">
                  <i
                    className={`bi ${hasMediaForPreview ? 'bi-check-circle-fill done' : 'bi-circle miss'}`}
                  />
                  Logo / Galerie
                </div>
              </div>
              <div className="comp-tip">
                <i className="bi bi-lightbulb-fill" />
                Profile mit Bildern werden häufiger angeklickt — Schritt 7: Logo und bis zu sechs Fotos hochladen.
              </div>
            </div>
          </div>

        <div className="step-footer">
          <div className="step-footer-inner">
            <div className="step-footer-start">
              {current > 1 ? (
                <button type="button" className="step-footer-back" onClick={prevStep}>
                  <i className="bi bi-arrow-left" aria-hidden />
                  Zurück
                </button>
              ) : null}
            </div>
            <span className="footer-saved">
              <i className="bi bi-cloud-check-fill" aria-hidden />
              Automatisch gespeichert (lokal)
            </span>
            <div className="step-footer-actions">
              {current === TOTAL_STEPS ? (
                <button
                  type="button"
                  className="step-footer-primary"
                  disabled={isPending}
                  onClick={nextStep}
                >
                  <i className="bi bi-check-lg" aria-hidden />
                  {isPending ? 'Speichern…' : 'Fertig & speichern'}
                </button>
              ) : atPremiumActivateGate ? null : (
                <button
                  type="button"
                  className="step-footer-primary"
                  disabled={isPending || (current === 6 && premiumCoreSaving)}
                  onClick={nextStep}
                >
                  {current === 6 && premiumCoreSaving ? (
                    'Profil speichern…'
                  ) : (
                    <>
                      Weiter
                      <i className="bi bi-arrow-right" aria-hidden />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
