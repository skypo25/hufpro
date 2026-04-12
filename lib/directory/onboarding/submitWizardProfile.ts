import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { canAccessApp, getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'
import { baseSlugFromRow } from '@/lib/directory/import/slug'
import {
  normalizeOpeningHoursJson,
  type DirectoryOpeningHoursJson,
} from '@/lib/directory/openingHours'
import { sendDirectoryProductEmail } from '@/lib/directory/onboarding/sendDirectoryProductEmails.server'
import { directorySpecialtyDisplayName } from '@/lib/directory/public/labels'
import { syncDirectoryProfilePlanFromEntitlements } from '@/lib/directory/product/syncDirectoryProfilePlanFromEntitlements.server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

function trimToNull(s: string | undefined | null): string | null {
  const t = (s ?? '').trim()
  return t.length ? t : null
}

function normalizeWebsiteUrl(raw: string | null): string | null {
  const t = trimToNull(raw)
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function buildDirectorySocialLinkRows(
  profileId: string,
  p: WizardSubmitPayload
): { directory_profile_id: string; platform: string; url: string; sort_order: number }[] {
  const rows: { directory_profile_id: string; platform: string; url: string; sort_order: number }[] = []
  let sort = 0
  const web = normalizeWebsiteUrl(p.website)
  if (web) {
    rows.push({ directory_profile_id: profileId, platform: 'website', url: web, sort_order: sort++ })
  }
  for (const sl of p.socialLinks) {
    const u = normalizeWebsiteUrl(sl.url)
    if (!u) continue
    rows.push({ directory_profile_id: profileId, platform: sl.platform, url: u, sort_order: sort++ })
  }
  return rows
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

function normalizeDachCountry(raw: unknown): 'DE' | 'AT' | 'CH' {
  const c = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  if (c === 'AT' || c === 'CH') return c
  return 'DE'
}

function isValidDachPostalCode(plz: string, country: 'DE' | 'AT' | 'CH'): boolean {
  const t = plz.trim()
  if (country === 'DE') return /^\d{5}$/.test(t)
  if (country === 'AT' || country === 'CH') return /^\d{4}$/.test(t)
  return false
}

const ALLOWED_SALUTATIONS = new Set(['', 'herr', 'frau', 'divers'])

/** Öffentlicher Anzeigename: Titel + Vor- + Nachname (ohne Anrede). */
function buildDisplayNameFromParts(nameTitle: string, firstName: string, lastName: string): string {
  const parts = [nameTitle.trim(), firstName.trim(), lastName.trim()].filter((x) => x.length > 0)
  return parts.join(' ')
}

async function allocateUniqueSlug(supabase: ReturnType<typeof createSupabaseServiceRoleClient>, base: string): Promise<string> {
  const safeBase = (base || 'eintrag').slice(0, 120)
  const { data } = await supabase.from('directory_profiles').select('id').eq('slug', safeBase).maybeSingle()
  if (!data) return safeBase
  for (let n = 2; n < 1000; n++) {
    const candidate = `${safeBase}-${n}`.slice(0, 120)
    const { data: d2 } = await supabase.from('directory_profiles').select('id').eq('slug', candidate).maybeSingle()
    if (!d2) return candidate
  }
  throw new Error('Kein freier Slug')
}

/** Social außer Website (Website bleibt eigenes Feld im Formular). */
export type WizardSubmitSocialLink = {
  platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'other'
  url: string
}

export type WizardSubmitPayload = {
  practiceName: string
  nameSalutation: string
  nameTitle: string
  firstName: string
  lastName: string
  shortDesc: string
  streetLine: string
  plz: string
  city: string
  phone: string
  email: string
  website: string
  /** Zusätzliche Social-Profile (je Plattform höchstens einer — DB-Constraint). */
  socialLinks: WizardSubmitSocialLink[]
  specialtyIds: string[]
  subcategoryIds: string[]
  methodIds: string[]
  customSpecs: string[]
  customMethods: string[]
  /** Optional: eigene Spezialisierungen je Fachrichtungs-ID (UUID). */
  customSpecsBySpecialtyId?: Record<string, string[]>
  /** Optional: eigene Methoden je Fachrichtungs-ID. */
  customMethodsBySpecialtyId?: Record<string, string[]>
  /** Wizard: pro Fachrichtung eigene Felder — serverseitige Validierung & Beschreibungsblöcke. */
  wizardUsesPerSpecialtyCustomBlocks?: boolean
  animalTypeIds: string[]
  serviceType: 'mobile' | 'stationary' | 'both'
  radiusKm: number
  areaText: string
  qualiItems: string[]
  /** D-A-CH; Standard DE */
  country?: 'DE' | 'AT' | 'CH'
  /** Aus Adressvorschlag (Photon); optional */
  latitude?: number | null
  longitude?: number | null
  /** Strukturierte Wochenzeiten; null/leer = keine Angabe */
  openingHours?: DirectoryOpeningHoursJson | null
  /** Freitext: telefonische Erreichbarkeit, Feiertage … */
  openingHoursNote?: string
  /** Onboarding: gewähltes Paket (fehlend = neutral, z. B. Bearbeitung unter „Mein Profil“). */
  onboardingProductChoice?: 'free' | 'directory_premium' | 'app' | null
}

function extendedDescriptionForWizard(
  p: WizardSubmitPayload,
  specs: { id: string; name: string; code: string }[],
): string | null {
  const nameById = new Map(
    specs.map((s) => [s.id, directorySpecialtyDisplayName(s.code, s.name)]),
  )
  const usePer = Boolean(p.wizardUsesPerSpecialtyCustomBlocks)
  const hasSpecBy = usePer && p.customSpecsBySpecialtyId && Object.keys(p.customSpecsBySpecialtyId).length > 0
  const hasMethodBy = usePer && p.customMethodsBySpecialtyId && Object.keys(p.customMethodsBySpecialtyId).length > 0

  const blocks: string[] = []
  if (p.qualiItems.length) {
    blocks.push(['Qualifikationen:', ...p.qualiItems.map((q) => `- ${q}`)].join('\n'))
  }
  if (hasSpecBy) {
    for (const sid of p.specialtyIds) {
      const items = (p.customSpecsBySpecialtyId?.[sid] ?? []).filter(Boolean)
      if (items.length === 0) continue
      const label = nameById.get(sid) ?? 'Fachrichtung'
      blocks.push([`Eigene Spezialisierungen (${label}):`, ...items.map((q) => `- ${q}`)].join('\n'))
    }
  } else if (p.customSpecs.length) {
    blocks.push(['Eigene Spezialisierungen:', ...p.customSpecs.map((q) => `- ${q}`)].join('\n'))
  }
  if (hasMethodBy) {
    for (const sid of p.specialtyIds) {
      const items = (p.customMethodsBySpecialtyId?.[sid] ?? []).filter(Boolean)
      if (items.length === 0) continue
      const label = nameById.get(sid) ?? 'Fachrichtung'
      blocks.push([`Eigene Leistungen / Methoden (${label}):`, ...items.map((q) => `- ${q}`)].join('\n'))
    }
  } else if (p.customMethods.length) {
    blocks.push(['Eigene Leistungen / Methoden:', ...p.customMethods.map((q) => `- ${q}`)].join('\n'))
  }
  return blocks.length ? blocks.join('\n\n') : null
}

export type WizardSubmitResult =
  | { ok: true; slug: string; profileId: string; postProfileCheckout?: 'app' }
  | { ok: false; error: string }

function parsePayload(raw: unknown): WizardSubmitPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Ungültige Anfrage.' }
  const o = raw as Record<string, unknown>

  const practiceName = typeof o.practiceName === 'string' ? o.practiceName : ''
  const nameSalutation = typeof o.nameSalutation === 'string' ? o.nameSalutation.trim().toLowerCase() : ''
  const nameTitle = typeof o.nameTitle === 'string' ? o.nameTitle.trim() : ''
  const firstName = typeof o.firstName === 'string' ? o.firstName.trim() : ''
  const lastName = typeof o.lastName === 'string' ? o.lastName.trim() : ''
  const shortDesc = typeof o.shortDesc === 'string' ? o.shortDesc : ''
  const streetLine = typeof o.streetLine === 'string' ? o.streetLine : ''
  const plz = typeof o.plz === 'string' ? o.plz : ''
  const city = typeof o.city === 'string' ? o.city : ''
  const phone = typeof o.phone === 'string' ? o.phone : ''
  const email = typeof o.email === 'string' ? o.email : ''
  const website = typeof o.website === 'string' ? o.website : ''
  const serviceType = o.serviceType
  const radiusKm = typeof o.radiusKm === 'number' && Number.isFinite(o.radiusKm) ? o.radiusKm : NaN
  const areaText = typeof o.areaText === 'string' ? o.areaText : ''

  if (!practiceName.trim() || practiceName.length > 200) return { error: 'Praxisname fehlt oder ist zu lang.' }
  if (!ALLOWED_SALUTATIONS.has(nameSalutation)) return { error: 'Anrede ungültig.' }
  if (nameTitle.length > 60) return { error: 'Titel zu lang.' }
  if (!firstName || firstName.length > 80) return { error: 'Vorname fehlt oder ist zu lang.' }
  if (!lastName || lastName.length > 80) return { error: 'Nachname fehlt oder ist zu lang.' }
  const displayName = buildDisplayNameFromParts(nameTitle, firstName, lastName)
  if (!displayName || displayName.length > 200) return { error: 'Name (Titel/Vor-/Nachname) zu lang oder leer.' }
  if (shortDesc.length > 1000) return { error: 'Kurzbeschreibung zu lang.' }
  if (streetLine.length > 300) return { error: 'Adresse zu lang.' }
  const plzT = plz.trim()
  const country = normalizeDachCountry(o.country)
  if (!isValidDachPostalCode(plzT, country)) {
    return {
      error:
        country === 'DE'
          ? 'Bitte eine gültige PLZ angeben (5 Ziffern für Deutschland).'
          : 'Bitte eine gültige PLZ angeben (4 Ziffern für Österreich/Schweiz).',
    }
  }
  if (!city.trim() || city.length > 120) return { error: 'Ort fehlt oder ist zu lang.' }

  let latitude: number | null = null
  let longitude: number | null = null
  const latRaw = o.latitude
  const lngRaw = o.longitude
  if (typeof latRaw === 'number' && Number.isFinite(latRaw) && typeof lngRaw === 'number' && Number.isFinite(lngRaw)) {
    if (latRaw >= -90 && latRaw <= 90 && lngRaw >= -180 && lngRaw <= 180) {
      latitude = latRaw
      longitude = lngRaw
    }
  }
  if (!phone.trim() || phone.length > 80) return { error: 'Telefon fehlt oder ist zu lang.' }
  if (!looksLikeEmail(email)) return { error: 'Bitte eine gültige E-Mail angeben.' }
  if (website.length > 500) return { error: 'Website zu lang.' }

  const ALLOWED_SOCIAL_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok', 'other'] as const
  function isWizardSocialPlatform(p: string): p is WizardSubmitSocialLink['platform'] {
    return (ALLOWED_SOCIAL_PLATFORMS as readonly string[]).includes(p)
  }

  const socialRaw = o.socialLinks
  const socialLinks: WizardSubmitSocialLink[] = []
  if (socialRaw != null) {
    if (!Array.isArray(socialRaw)) return { error: 'Social-Links ungültig.' }
    const seen = new Set<string>()
    for (const item of socialRaw) {
      if (item == null || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const pl = typeof rec.platform === 'string' ? rec.platform.trim().toLowerCase() : ''
      const u = typeof rec.url === 'string' ? rec.url.trim() : ''
      if (!pl && !u) continue
      if (!pl || !isWizardSocialPlatform(pl)) {
        return { error: 'Ungültige oder fehlende Social-Plattform.' }
      }
      if (!u) return { error: `Bitte eine URL für ${pl} angeben oder die Zeile entfernen.` }
      if (u.length > 500) return { error: 'Social-Link zu lang.' }
      if (seen.has(pl)) return { error: 'Jede Social-Plattform nur einmal.' }
      seen.add(pl)
      socialLinks.push({ platform: pl, url: u })
    }
  }

  if (serviceType !== 'mobile' && serviceType !== 'stationary' && serviceType !== 'both') {
    return { error: 'Arbeitsweise ungültig.' }
  }
  if (!Number.isFinite(radiusKm) || radiusKm < 5 || radiusKm > 150) return { error: 'Radius ungültig.' }
  if (areaText.length > 300) return { error: 'Einsatzgebiet-Text zu lang.' }

  const specialtyIds = Array.isArray(o.specialtyIds) ? o.specialtyIds.filter((x): x is string => typeof x === 'string') : []
  const subcategoryIds = Array.isArray(o.subcategoryIds)
    ? o.subcategoryIds.filter((x): x is string => typeof x === 'string')
    : []
  const methodIds = Array.isArray(o.methodIds) ? o.methodIds.filter((x): x is string => typeof x === 'string') : []
  const customSpecs = Array.isArray(o.customSpecs) ? o.customSpecs.filter((x): x is string => typeof x === 'string') : []
  const customMethods = Array.isArray(o.customMethods)
    ? o.customMethods.filter((x): x is string => typeof x === 'string')
    : []
  const animalTypeIds = Array.isArray(o.animalTypeIds)
    ? o.animalTypeIds.filter((x): x is string => typeof x === 'string')
    : []
  const qualiItems = Array.isArray(o.qualiItems) ? o.qualiItems.filter((x): x is string => typeof x === 'string') : []

  const specIdsDedup = [...new Set(specialtyIds)].filter(isUuid)
  const subIdsDedup = [...new Set(subcategoryIds)].filter(isUuid)
  const methodIdsDedup = [...new Set(methodIds)].filter(isUuid)
  const animalDedup = [...new Set(animalTypeIds)].filter(isUuid)
  const wizardUsesPerSpecialtyCustomBlocks = o.wizardUsesPerSpecialtyCustomBlocks === true

  const customSpecsBySpecialtyId: Record<string, string[]> = {}
  const rawCsBy = o.customSpecsBySpecialtyId
  if (rawCsBy != null && typeof rawCsBy === 'object' && !Array.isArray(rawCsBy)) {
    for (const [k, v] of Object.entries(rawCsBy)) {
      if (!isUuid(k)) return { error: 'Ungültige Fachrichtungs-ID (eigene Spezialisierungen).' }
      if (!specIdsDedup.includes(k)) return { error: 'Eigene Spezialisierungen: Fachrichtung passt nicht zur Auswahl.' }
      if (!Array.isArray(v)) return { error: 'Eigene Spezialisierungen je Fachrichtung: ungültiges Format.' }
      const arr = [...new Set(v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean))].slice(
        0,
        24,
      )
      for (const c of arr) {
        if (c.length > 120) return { error: 'Eigene Spezialisierung zu lang.' }
      }
      if (arr.length) customSpecsBySpecialtyId[k] = arr
    }
  }

  const customMethodsBySpecialtyId: Record<string, string[]> = {}
  const rawCmBy = o.customMethodsBySpecialtyId
  if (rawCmBy != null && typeof rawCmBy === 'object' && !Array.isArray(rawCmBy)) {
    for (const [k, v] of Object.entries(rawCmBy)) {
      if (!isUuid(k)) return { error: 'Ungültige Fachrichtungs-ID (eigene Methoden).' }
      if (!specIdsDedup.includes(k)) return { error: 'Eigene Methoden: Fachrichtung passt nicht zur Auswahl.' }
      if (!Array.isArray(v)) return { error: 'Eigene Methoden je Fachrichtung: ungültiges Format.' }
      const arr = [...new Set(v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean))].slice(
        0,
        24,
      )
      for (const c of arr) {
        if (c.length > 120) return { error: 'Eigene Methode zu lang.' }
      }
      if (arr.length) customMethodsBySpecialtyId[k] = arr
    }
  }

  const flatSpecClean = [...new Set(customSpecs.map((s) => s.trim()).filter(Boolean))].slice(0, 30)
  const flatMethodClean = [...new Set(customMethods.map((s) => s.trim()).filter(Boolean))].slice(0, 30)
  const fromSpecBy = Object.values(customSpecsBySpecialtyId).flat()
  const fromMethodBy = Object.values(customMethodsBySpecialtyId).flat()
  const customSpecClean = [...new Set([...flatSpecClean, ...fromSpecBy])].slice(0, 60)
  const customMethodClean = [...new Set([...flatMethodClean, ...fromMethodBy])].slice(0, 60)
  const qualiClean = [...new Set(qualiItems.map((s) => s.trim()).filter(Boolean))].slice(0, 40)

  for (const c of qualiClean) {
    if (c.length > 200) return { error: 'Qualifikation zu lang.' }
  }

  if (specIdsDedup.length === 0) return { error: 'Mindestens eine Fachrichtung wählen.' }
  if (animalDedup.length === 0) return { error: 'Mindestens eine Tierart wählen.' }
  if (!wizardUsesPerSpecialtyCustomBlocks) {
    if (subIdsDedup.length === 0 && customSpecClean.length === 0) {
      return { error: 'Mindestens eine Spezialisierung oder eigene Eintragung.' }
    }
  }
  if (methodIdsDedup.length === 0 && customMethodClean.length === 0) {
    return { error: 'Mindestens eine Methode/Leistung oder eigene Eintragung.' }
  }

  const openingHoursNoteRaw = typeof o.openingHoursNote === 'string' ? o.openingHoursNote : ''
  if (openingHoursNoteRaw.length > 800) return { error: 'Hinweis zu Öffnungszeiten zu lang (max. 800 Zeichen).' }
  const openingHoursNormalized = normalizeOpeningHoursJson(o.openingHours)

  const rawOnb = typeof o.onboardingProductChoice === 'string' ? o.onboardingProductChoice.trim() : ''
  let onboardingProductChoice: 'free' | 'directory_premium' | 'app' | null = null
  if (rawOnb === 'free' || rawOnb === 'directory_premium' || rawOnb === 'app') {
    onboardingProductChoice = rawOnb
  }

  return {
    practiceName: practiceName.trim(),
    nameSalutation,
    nameTitle,
    firstName,
    lastName,
    shortDesc: shortDesc.trim(),
    streetLine: streetLine.trim(),
    plz: plzT,
    city: city.trim(),
    phone: phone.trim(),
    email: email.trim().toLowerCase(),
    website,
    socialLinks,
    specialtyIds: specIdsDedup,
    subcategoryIds: subIdsDedup,
    methodIds: methodIdsDedup,
    customSpecs: customSpecClean,
    customMethods: customMethodClean,
    customSpecsBySpecialtyId:
      Object.keys(customSpecsBySpecialtyId).length > 0 ? customSpecsBySpecialtyId : undefined,
    customMethodsBySpecialtyId:
      Object.keys(customMethodsBySpecialtyId).length > 0 ? customMethodsBySpecialtyId : undefined,
    wizardUsesPerSpecialtyCustomBlocks: wizardUsesPerSpecialtyCustomBlocks ? true : undefined,
    animalTypeIds: animalDedup,
    serviceType,
    radiusKm: Math.round(radiusKm),
    areaText: areaText.trim(),
    qualiItems: qualiClean,
    country,
    latitude,
    longitude,
    openingHours: openingHoursNormalized,
    openingHoursNote: openingHoursNoteRaw.trim(),
    onboardingProductChoice,
  }
}

export async function submitDirectoryProfileWizard(raw: unknown): Promise<WizardSubmitResult> {
  let supabase: ReturnType<typeof createSupabaseServiceRoleClient>
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch {
    return { ok: false, error: 'Server-Konfiguration unvollständig (SUPABASE_SERVICE_ROLE_KEY).' }
  }

  const parsed = parsePayload(raw)
  if ('error' in parsed) {
    return { ok: false, error: parsed.error }
  }
  const p = parsed

  const { data: specRows, error: specErr } = await supabase
    .from('directory_specialties')
    .select('id, name, code')
    .in('id', p.specialtyIds)
    .eq('is_active', true)
  if (specErr) return { ok: false, error: `Fachrichtungen: ${specErr.message}` }
  if ((specRows ?? []).length !== p.specialtyIds.length) {
    return { ok: false, error: 'Ungültige Fachrichtung ausgewählt.' }
  }

  let subRows: { id: string; directory_specialty_id: string }[] = []
  if (p.subcategoryIds.length > 0) {
    const { data: subData, error: subErr } = await supabase
      .from('directory_subcategories')
      .select('id, directory_specialty_id')
      .in('id', p.subcategoryIds)
      .eq('is_active', true)
    if (subErr) return { ok: false, error: `Spezialisierungen: ${subErr.message}` }
    if ((subData ?? []).length !== p.subcategoryIds.length) {
      return { ok: false, error: 'Ungültige Spezialisierung ausgewählt.' }
    }
    for (const row of subData ?? []) {
      const sid = (row as { directory_specialty_id: string }).directory_specialty_id
      if (!p.specialtyIds.includes(sid)) {
        return { ok: false, error: 'Spezialisierung passt nicht zu den gewählten Fachrichtungen.' }
      }
    }
    subRows = (subData ?? []) as { id: string; directory_specialty_id: string }[]
  }

  if (p.wizardUsesPerSpecialtyCustomBlocks) {
    const subCountBySpec = new Map<string, number>()
    for (const r of subRows) {
      subCountBySpec.set(r.directory_specialty_id, (subCountBySpec.get(r.directory_specialty_id) ?? 0) + 1)
    }
    for (const sid of p.specialtyIds) {
      const nSub = subCountBySpec.get(sid) ?? 0
      const nCust = (p.customSpecsBySpecialtyId?.[sid] ?? []).length
      if (nSub === 0 && nCust === 0) {
        return {
          ok: false,
          error:
            'Pro gewählter Fachrichtung mindestens eine Spezialisierung aus der Liste oder eine eigene Eintragung.',
        }
      }
    }
  }

  const { data: animalRows, error: aniErr } = await supabase
    .from('directory_animal_types')
    .select('id')
    .in('id', p.animalTypeIds)
    .eq('is_active', true)
  if (aniErr) return { ok: false, error: `Tierarten: ${aniErr.message}` }
  if ((animalRows ?? []).length !== p.animalTypeIds.length) {
    return { ok: false, error: 'Ungültige Tierart ausgewählt.' }
  }

  if (p.methodIds.length > 0) {
    const { data: methRows, error: methErr } = await supabase
      .from('directory_methods')
      .select('id, directory_specialty_id')
      .in('id', p.methodIds)
      .eq('is_active', true)
    if (methErr) return { ok: false, error: `Methoden: ${methErr.message}` }
    if ((methRows ?? []).length !== p.methodIds.length) {
      return { ok: false, error: 'Ungültige Methode ausgewählt.' }
    }
    for (const row of methRows ?? []) {
      const sid = (row as { directory_specialty_id: string | null }).directory_specialty_id
      if (sid != null && !p.specialtyIds.includes(sid)) {
        return { ok: false, error: 'Methode passt nicht zu den gewählten Fachrichtungen.' }
      }
    }
  }

  const slugBase = baseSlugFromRow(p.practiceName, p.plz)
  let slug: string
  try {
    slug = await allocateUniqueSlug(supabase, slugBase)
  } catch {
    return { ok: false, error: 'Kein freier Profil-Slug verfügbar.' }
  }

  const streetFull = trimToNull(p.streetLine)
  const extendedDesc = extendedDescriptionForWizard(
    p,
    (specRows ?? []) as { id: string; name: string; code: string }[],
  )
  const shortDescNull = trimToNull(p.shortDesc)

  const displayName = buildDisplayNameFromParts(p.nameTitle, p.firstName, p.lastName)
  const salutationDb = p.nameSalutation.length ? p.nameSalutation : null
  const titleDb = p.nameTitle.length ? p.nameTitle : null

  const profileRow = {
    slug,
    display_name: displayName,
    name_salutation: salutationDb,
    name_title: titleDb,
    first_name: p.firstName,
    last_name: p.lastName,
    practice_name: p.practiceName,
    short_description: shortDescNull,
    description: extendedDesc,
    street: streetFull,
    house_number: null as string | null,
    postal_code: p.plz,
    city: p.city,
    state: null as string | null,
    country: p.country,
    latitude: p.latitude,
    longitude: p.longitude,
    service_type: p.serviceType,
    service_area_text: trimToNull(p.areaText),
    service_radius_km: p.radiusKm,
    phone_public: p.phone,
    email_public: p.email,
    listing_status: 'draft' as const,
    claim_state: 'unclaimed' as const,
    verification_state: 'none' as const,
    data_origin: 'manual' as const,
    opening_hours: p.openingHours,
    opening_hours_note: trimToNull(p.openingHoursNote),
  }

  const { data: inserted, error: insErr } = await supabase.from('directory_profiles').insert(profileRow).select('id').single()

  if (insErr || !inserted) {
    return { ok: false, error: insErr?.message ?? 'Profil konnte nicht angelegt werden.' }
  }

  const profileId = (inserted as { id: string }).id

  const specInserts = p.specialtyIds.map((directory_specialty_id, i) => ({
    directory_profile_id: profileId,
    directory_specialty_id,
    is_primary: i === 0,
  }))
  const { error: specLinkErr } = await supabase.from('directory_profile_specialties').insert(specInserts)
  if (specLinkErr) {
    await supabase.from('directory_profiles').delete().eq('id', profileId)
    return { ok: false, error: specLinkErr.message }
  }

  if (p.subcategoryIds.length) {
    const { error: subLinkErr } = await supabase.from('directory_profile_subcategories').insert(
      p.subcategoryIds.map((directory_subcategory_id) => ({ directory_profile_id: profileId, directory_subcategory_id }))
    )
    if (subLinkErr) {
      await supabase.from('directory_profiles').delete().eq('id', profileId)
      return { ok: false, error: subLinkErr.message }
    }
  }

  if (p.methodIds.length) {
    const { error: methLinkErr } = await supabase.from('directory_profile_methods').insert(
      p.methodIds.map((directory_method_id) => ({ directory_profile_id: profileId, directory_method_id }))
    )
    if (methLinkErr) {
      await supabase.from('directory_profiles').delete().eq('id', profileId)
      return { ok: false, error: methLinkErr.message }
    }
  }

  const { error: aniLinkErr } = await supabase.from('directory_profile_animal_types').insert(
    p.animalTypeIds.map((directory_animal_type_id) => ({ directory_profile_id: profileId, directory_animal_type_id }))
  )
  if (aniLinkErr) {
    await supabase.from('directory_profiles').delete().eq('id', profileId)
    return { ok: false, error: aniLinkErr.message }
  }

  const socialRows = buildDirectorySocialLinkRows(profileId, p)
  if (socialRows.length) {
    const { error: socErr } = await supabase.from('directory_profile_social_links').insert(socialRows)
    if (socErr) {
      await supabase.from('directory_profiles').delete().eq('id', profileId)
      return { ok: false, error: socErr.message }
    }
  }

  await supabase.from('directory_profile_sources').insert({
    directory_profile_id: profileId,
    directory_import_batch_id: null,
    external_key: `wizard:${profileId}`,
    primary_source_url: null,
    secondary_source_url: null,
    source_type: 'user_submission',
    data_quality: 'raw',
    raw_reference: null,
  })

  return { ok: true, slug, profileId }
}

export async function upsertOwnedDirectoryProfileFromWizard(args: {
  userId: string
  raw: unknown
}): Promise<WizardSubmitResult> {
  let supabase: ReturnType<typeof createSupabaseServiceRoleClient>
  try {
    supabase = createSupabaseServiceRoleClient()
  } catch {
    return { ok: false, error: 'Server-Konfiguration unvollständig (SUPABASE_SERVICE_ROLE_KEY).' }
  }

  const parsed = parsePayload(args.raw)
  if ('error' in parsed) {
    return { ok: false, error: parsed.error }
  }
  const p = parsed

  // Reuse the same validation of reference IDs (active rows, coherence).
  const { data: specRows, error: specErr } = await supabase
    .from('directory_specialties')
    .select('id, name, code')
    .in('id', p.specialtyIds)
    .eq('is_active', true)
  if (specErr) return { ok: false, error: `Fachrichtungen: ${specErr.message}` }
  if ((specRows ?? []).length !== p.specialtyIds.length) {
    return { ok: false, error: 'Ungültige Fachrichtung ausgewählt.' }
  }

  let subRows: { id: string; directory_specialty_id: string }[] = []
  if (p.subcategoryIds.length > 0) {
    const { data: subData, error: subErr } = await supabase
      .from('directory_subcategories')
      .select('id, directory_specialty_id')
      .in('id', p.subcategoryIds)
      .eq('is_active', true)
    if (subErr) return { ok: false, error: `Spezialisierungen: ${subErr.message}` }
    if ((subData ?? []).length !== p.subcategoryIds.length) {
      return { ok: false, error: 'Ungültige Spezialisierung ausgewählt.' }
    }
    for (const row of subData ?? []) {
      const sid = (row as { directory_specialty_id: string }).directory_specialty_id
      if (!p.specialtyIds.includes(sid)) {
        return { ok: false, error: 'Spezialisierung passt nicht zu den gewählten Fachrichtungen.' }
      }
    }
    subRows = (subData ?? []) as { id: string; directory_specialty_id: string }[]
  }

  if (p.wizardUsesPerSpecialtyCustomBlocks) {
    const subCountBySpec = new Map<string, number>()
    for (const r of subRows) {
      subCountBySpec.set(r.directory_specialty_id, (subCountBySpec.get(r.directory_specialty_id) ?? 0) + 1)
    }
    for (const sid of p.specialtyIds) {
      const nSub = subCountBySpec.get(sid) ?? 0
      const nCust = (p.customSpecsBySpecialtyId?.[sid] ?? []).length
      if (nSub === 0 && nCust === 0) {
        return {
          ok: false,
          error:
            'Pro gewählter Fachrichtung mindestens eine Spezialisierung aus der Liste oder eine eigene Eintragung.',
        }
      }
    }
  }

  const { data: animalRows, error: aniErr } = await supabase
    .from('directory_animal_types')
    .select('id')
    .in('id', p.animalTypeIds)
    .eq('is_active', true)
  if (aniErr) return { ok: false, error: `Tierarten: ${aniErr.message}` }
  if ((animalRows ?? []).length !== p.animalTypeIds.length) {
    return { ok: false, error: 'Ungültige Tierart ausgewählt.' }
  }

  if (p.methodIds.length > 0) {
    const { data: methRows, error: methErr } = await supabase
      .from('directory_methods')
      .select('id, directory_specialty_id')
      .in('id', p.methodIds)
      .eq('is_active', true)
    if (methErr) return { ok: false, error: `Methoden: ${methErr.message}` }
    if ((methRows ?? []).length !== p.methodIds.length) {
      return { ok: false, error: 'Ungültige Methode ausgewählt.' }
    }
    for (const row of methRows ?? []) {
      const sid = (row as { directory_specialty_id: string | null }).directory_specialty_id
      if (sid != null && !p.specialtyIds.includes(sid)) {
        return { ok: false, error: 'Methode passt nicht zu den gewählten Fachrichtungen.' }
      }
    }
  }

  const { data: existing } = await supabase
    .from('directory_profiles')
    .select('id, slug')
    .eq('claimed_by_user_id', args.userId)
    .maybeSingle()

  const isNewInsert = !existing?.id

  const streetFull = trimToNull(p.streetLine)
  const extendedDesc = extendedDescriptionForWizard(
    p,
    (specRows ?? []) as { id: string; name: string; code: string }[],
  )
  const shortDescNull = trimToNull(p.shortDesc)

  const displayName = buildDisplayNameFromParts(p.nameTitle, p.firstName, p.lastName)
  const salutationDb = p.nameSalutation.length ? p.nameSalutation : null
  const titleDb = p.nameTitle.length ? p.nameTitle : null

  let profileId: string
  let slug: string

  if (existing?.id) {
    profileId = (existing as { id: string }).id
    slug = (existing as { slug: string }).slug
    const { error: upErr } = await supabase
      .from('directory_profiles')
      .update({
        display_name: displayName,
        name_salutation: salutationDb,
        name_title: titleDb,
        first_name: p.firstName,
        last_name: p.lastName,
        practice_name: p.practiceName,
        short_description: shortDescNull,
        description: extendedDesc,
        street: streetFull,
        postal_code: p.plz,
        city: p.city,
        country: p.country,
        latitude: p.latitude,
        longitude: p.longitude,
        service_type: p.serviceType,
        service_area_text: trimToNull(p.areaText),
        service_radius_km: p.radiusKm,
        phone_public: p.phone,
        email_public: p.email,
        data_origin: 'manual' as const,
        updated_at: new Date().toISOString(),
        opening_hours: p.openingHours,
        opening_hours_note: trimToNull(p.openingHoursNote),
      })
      .eq('id', profileId)
    if (upErr) return { ok: false, error: upErr.message }
  } else {
    const slugBase = baseSlugFromRow(p.practiceName, p.plz)
    try {
      slug = await allocateUniqueSlug(supabase, slugBase)
    } catch {
      return { ok: false, error: 'Kein freier Profil-Slug verfügbar.' }
    }

    const { data: inserted, error: insErr } = await supabase
      .from('directory_profiles')
      .insert({
        slug,
        display_name: displayName,
        name_salutation: salutationDb,
        name_title: titleDb,
        first_name: p.firstName,
        last_name: p.lastName,
        practice_name: p.practiceName,
        short_description: shortDescNull,
        description: extendedDesc,
        street: streetFull,
        house_number: null,
        postal_code: p.plz,
        city: p.city,
        state: null,
        country: p.country,
        latitude: p.latitude,
        longitude: p.longitude,
        service_type: p.serviceType,
        service_area_text: trimToNull(p.areaText),
        service_radius_km: p.radiusKm,
        phone_public: p.phone,
        email_public: p.email,
        listing_status: 'draft' as const,
        claim_state: 'claimed' as const,
        claimed_by_user_id: args.userId,
        verification_state: 'none' as const,
        data_origin: 'manual' as const,
        opening_hours: p.openingHours,
        opening_hours_note: trimToNull(p.openingHoursNote),
      })
      .select('id')
      .single()
    if (insErr || !inserted) return { ok: false, error: insErr?.message ?? 'Profil konnte nicht angelegt werden.' }
    profileId = (inserted as { id: string }).id
  }

  // Replace all junction links with the submitted set.
  await supabase.from('directory_profile_specialties').delete().eq('directory_profile_id', profileId)
  await supabase.from('directory_profile_subcategories').delete().eq('directory_profile_id', profileId)
  await supabase.from('directory_profile_methods').delete().eq('directory_profile_id', profileId)
  await supabase.from('directory_profile_animal_types').delete().eq('directory_profile_id', profileId)
  await supabase.from('directory_profile_social_links').delete().eq('directory_profile_id', profileId)

  const specInserts = p.specialtyIds.map((directory_specialty_id, i) => ({
    directory_profile_id: profileId,
    directory_specialty_id,
    is_primary: i === 0,
  }))
  const { error: specLinkErr } = await supabase.from('directory_profile_specialties').insert(specInserts)
  if (specLinkErr) return { ok: false, error: specLinkErr.message }

  if (p.subcategoryIds.length) {
    const { error: subLinkErr } = await supabase.from('directory_profile_subcategories').insert(
      p.subcategoryIds.map((directory_subcategory_id) => ({ directory_profile_id: profileId, directory_subcategory_id }))
    )
    if (subLinkErr) return { ok: false, error: subLinkErr.message }
  }

  if (p.methodIds.length) {
    const { error: methLinkErr } = await supabase.from('directory_profile_methods').insert(
      p.methodIds.map((directory_method_id) => ({ directory_profile_id: profileId, directory_method_id }))
    )
    if (methLinkErr) return { ok: false, error: methLinkErr.message }
  }

  const { error: aniLinkErr } = await supabase.from('directory_profile_animal_types').insert(
    p.animalTypeIds.map((directory_animal_type_id) => ({ directory_profile_id: profileId, directory_animal_type_id }))
  )
  if (aniLinkErr) return { ok: false, error: aniLinkErr.message }

  const socialRowsOwned = buildDirectorySocialLinkRows(profileId, p)
  if (socialRowsOwned.length) {
    const { error: socErr } = await supabase.from('directory_profile_social_links').insert(socialRowsOwned)
    if (socErr) return { ok: false, error: socErr.message }
  }

  // Best-effort source row.
  await supabase.from('directory_profile_sources').upsert(
    {
      directory_profile_id: profileId,
      directory_import_batch_id: null,
      external_key: `owner-wizard:${profileId}`,
      primary_source_url: null,
      secondary_source_url: null,
      source_type: 'user_submission',
      data_quality: 'raw',
      raw_reference: null,
    },
    { onConflict: 'directory_profile_id,external_key' }
  )

  await syncDirectoryProfilePlanFromEntitlements(supabase, profileId)

  const { data: planRow } = await supabase
    .from('directory_profiles')
    .select('directory_plan, display_name')
    .eq('id', profileId)
    .maybeSingle()

  const { data: billingRow } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', args.userId)
    .maybeSingle()

  const billingState = getBillingState({
    account: (billingRow ?? null) as BillingAccountRow | null,
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
  })
  const appLive = canAccessApp(billingState)
  const hasPremium = (planRow as { directory_plan?: string } | null)?.directory_plan === 'premium'
  const choice = p.onboardingProductChoice ?? null

  let postProfileCheckout: 'app' | undefined
  if (choice === 'app' && !appLive) {
    postProfileCheckout = 'app'
  }
  // Verzeichnis-Premium: Checkout läuft im Wizard (Zwischenschritt nach Kernangaben), nicht automatisch hier.

  if (isNewInsert && postProfileCheckout) {
    await sendDirectoryProductEmail({
      db: supabase,
      userId: args.userId,
      profileSlug: slug,
      displayName: (planRow as { display_name?: string } | null)?.display_name ?? displayName,
      kind: 'profile_saved_checkout_next',
    })
  } else if (
    isNewInsert &&
    !postProfileCheckout &&
    !hasPremium &&
    !appLive &&
    (choice === 'free' || choice === null)
  ) {
    await sendDirectoryProductEmail({
      db: supabase,
      userId: args.userId,
      profileSlug: slug,
      displayName: (planRow as { display_name?: string } | null)?.display_name ?? displayName,
      kind: 'free_profile_created',
    })
  }

  return {
    ok: true,
    slug,
    profileId,
    ...(postProfileCheckout ? { postProfileCheckout } : {}),
  }
}
