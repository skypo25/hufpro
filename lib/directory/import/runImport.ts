import type { SupabaseClient } from '@supabase/supabase-js'
import { buildExternalKey } from './externalKey'
import {
  buildDescriptionParts,
  mapDataQuality,
  mapListingStatus,
  mapServiceType,
  mapSourceType,
  mapVerificationState,
  parseTruthy,
  trimToNull,
  upperCountry,
} from './normalize'
import { resolveAnimalTypeCodes, resolveSpecialtyCodes } from './resolveTaxonomy'
import { baseSlugFromRow } from './slug'
import type { DirectoryImportOptions, DirectoryImportRawRow } from './types'

type IdMap = Map<string, string>

async function loadCodeIdMap(
  supabase: SupabaseClient,
  table: 'directory_specialties' | 'directory_animal_types'
): Promise<IdMap> {
  const { data, error } = await supabase.from(table).select('id, code').eq('is_active', true)
  if (error) throw new Error(`${table}: ${error.message}`)
  const m = new Map<string, string>()
  for (const row of data ?? []) {
    const r = row as { id: string; code: string }
    m.set(r.code, r.id)
  }
  return m
}

async function findProfileIdByExternalKey(
  supabase: SupabaseClient,
  externalKey: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('directory_profile_sources')
    .select('directory_profile_id')
    .eq('external_key', externalKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`directory_profile_sources lookup: ${error.message}`)
  const row = data as { directory_profile_id: string } | null
  return row?.directory_profile_id ?? null
}

async function slugExists(supabase: SupabaseClient, slug: string): Promise<boolean> {
  const { data, error } = await supabase.from('directory_profiles').select('id').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`slug check: ${error.message}`)
  return data != null
}

async function allocateUniqueSlug(supabase: SupabaseClient, base: string): Promise<string> {
  if (!(await slugExists(supabase, base))) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`.slice(0, 120)
    if (!(await slugExists(supabase, candidate))) return candidate
  }
  throw new Error(`Kein freier Slug für Basis "${base}"`)
}

function meetsPublishMinimum(row: DirectoryImportRawRow): boolean {
  const name = trimToNull(row.praxisname) ?? trimToNull(row.ansprechpartner_name)
  const loc = trimToNull(row.plz) ?? trimToNull(row.ort)
  return Boolean(name && loc)
}

export type DirectoryImportResult = {
  batchId: string | null
  inserted: number
  updated: number
  skipped: number
  errors: { index: number; message: string }[]
}

export async function runDirectoryImport(
  supabase: SupabaseClient,
  rows: DirectoryImportRawRow[],
  options: DirectoryImportOptions
): Promise<DirectoryImportResult> {
  const errors: { index: number; message: string }[] = []
  let inserted = 0
  let updated = 0
  let skipped = 0

  const specialtyByCode = await loadCodeIdMap(supabase, 'directory_specialties')
  const animalByCode = await loadCodeIdMap(supabase, 'directory_animal_types')

  let batchId: string | null = null

  if (!options.dryRun) {
    const { data: batch, error: batchErr } = await supabase
      .from('directory_import_batches')
      .insert({
        name: options.batchName,
        source_system: 'directory_json_import',
        created_by_user_id: options.createdByUserId ?? null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (batchErr) throw new Error(`Batch anlegen: ${batchErr.message}`)
    batchId = (batch as { id: string }).id
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const displayName =
        trimToNull(row.ansprechpartner_name) ?? trimToNull(row.praxisname) ?? null
      if (!displayName) {
        skipped++
        errors.push({ index: i, message: 'Kein Anzeigename (ansprechpartner_name / praxisname leer)' })
        continue
      }

      const practiceName = trimToNull(row.praxisname)
      const specialtyCodes = resolveSpecialtyCodes(row.fachrichtung, row.unterkategorie)
      const animalCodes = resolveAnimalTypeCodes(row.tierarten)

      if (specialtyCodes.length === 0) {
        skipped++
        errors.push({ index: i, message: `Keine zuordenbare Fachrichtung: "${row.fachrichtung ?? ''}"` })
        continue
      }

      if (animalCodes.length === 0) {
        skipped++
        errors.push({ index: i, message: `Keine zuordenbare Tierart: "${row.tierarten ?? ''}"` })
        continue
      }

      const specialtyIds = specialtyCodes.map((c) => specialtyByCode.get(c)).filter(Boolean) as string[]
      const animalIds = animalCodes.map((c) => animalByCode.get(c)).filter(Boolean) as string[]

      if (specialtyIds.length !== specialtyCodes.length) {
        skipped++
        errors.push({
          index: i,
          message: `Unbekannte Fachrichtungscode(s): ${specialtyCodes.join(', ')}`,
        })
        continue
      }
      if (animalIds.length !== animalCodes.length) {
        skipped++
        errors.push({ index: i, message: `Unbekannte Tierart-Code(s): ${animalCodes.join(', ')}` })
        continue
      }

      let listingStatus = mapListingStatus(row.profil_status, options.allowPublishedFromSource)
      if (listingStatus === 'published' && !meetsPublishMinimum(row)) {
        listingStatus = 'draft'
      }

      const externalKey = buildExternalKey({
        website: row.website,
        praxisname: row.praxisname,
        plz: row.plz,
        telefon: row.telefon,
      })

      const baseSlug = baseSlugFromRow(row.praxisname, row.plz)
      const profilePayload = {
        slug: baseSlug,
        display_name: displayName,
        practice_name: practiceName,
        short_description: trimToNull(row.beschreibung_kurz),
        description: buildDescriptionParts(row),
        street: trimToNull(row.strasse),
        house_number: trimToNull(row.hausnummer),
        postal_code: trimToNull(row.plz),
        city: trimToNull(row.ort),
        state: trimToNull(row.bundesland),
        country: upperCountry('DE'),
        service_type: mapServiceType(row.mobil_oder_praxis),
        service_area_text: trimToNull(row.einsatzgebiet),
        phone_public: trimToNull(row.telefon),
        email_public: trimToNull(row.email),
        listing_status: listingStatus,
        claim_state: 'unclaimed' as const,
        verification_state: mapVerificationState(row.verifiziert_status),
        premium_active: parseTruthy(row.premium_status),
        data_origin: 'import' as const,
        last_imported_at: new Date().toISOString(),
      }

      if (options.dryRun) {
        inserted++
        continue
      }

      const existingId = await findProfileIdByExternalKey(supabase, externalKey)
      const slug = existingId ? undefined : await allocateUniqueSlug(supabase, baseSlug)

      let profileId: string

      if (existingId) {
        const { error: upErr } = await supabase.from('directory_profiles').update(profilePayload).eq('id', existingId)

        if (upErr) throw new Error(upErr.message)
        profileId = existingId
        updated++
      } else {
        const finalSlug = slug ?? baseSlug
        const { data: prof, error: insErr } = await supabase
          .from('directory_profiles')
          .insert({
            ...profilePayload,
            slug: finalSlug,
          })
          .select('id')
          .single()

        if (insErr) throw new Error(insErr.message)
        profileId = (prof as { id: string }).id
        inserted++
      }

      await supabase.from('directory_profile_specialties').delete().eq('directory_profile_id', profileId)
      const specRows = specialtyIds.map((directory_specialty_id, idx) => ({
        directory_profile_id: profileId,
        directory_specialty_id,
        is_primary: idx === 0,
      }))
      const { error: sjErr } = await supabase.from('directory_profile_specialties').insert(specRows)
      if (sjErr) throw new Error(`specialties junction: ${sjErr.message}`)

      await supabase.from('directory_profile_animal_types').delete().eq('directory_profile_id', profileId)
      const animalRows = animalIds.map((directory_animal_type_id) => ({
        directory_profile_id: profileId,
        directory_animal_type_id,
      }))
      const { error: ajErr } = await supabase.from('directory_profile_animal_types').insert(animalRows)
      if (ajErr) throw new Error(`animal_types junction: ${ajErr.message}`)

      const sourcePayload = {
        directory_profile_id: profileId,
        directory_import_batch_id: batchId,
        external_key: externalKey,
        primary_source_url: trimToNull(row.quellen_url_1),
        secondary_source_url: trimToNull(row.quellen_url_2),
        source_type: mapSourceType(row.quellen_typ),
        data_quality: mapDataQuality(row.datenqualitaet),
        raw_reference: { source_row_index: i, praxisname: row.praxisname } as Record<string, unknown>,
      }
      const { error: srcErr } = await supabase.from('directory_profile_sources').insert(sourcePayload)
      if (srcErr) throw new Error(`sources: ${srcErr.message}`)

      await supabase.from('directory_profile_social_links').delete().eq('directory_profile_id', profileId)
      const socialRows: {
        directory_profile_id: string
        platform: string
        url: string
        sort_order: number
      }[] = []
      let so = 0
      const web = trimToNull(row.website)
      if (web) {
        socialRows.push({
          directory_profile_id: profileId,
          platform: 'website',
          url: /^https?:\/\//i.test(web) ? web : `https://${web}`,
          sort_order: so++,
        })
      }
      const ig = trimToNull(row.social_instagram)
      if (ig) {
        const url = ig.includes('http') ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`
        socialRows.push({
          directory_profile_id: profileId,
          platform: 'instagram',
          url,
          sort_order: so++,
        })
      }
      const fb = trimToNull(row.social_facebook)
      if (fb) {
        const url = fb.includes('http') ? fb : `https://facebook.com/${fb.replace(/^@/, '')}`
        socialRows.push({
          directory_profile_id: profileId,
          platform: 'facebook',
          url,
          sort_order: so++,
        })
      }
      const li = trimToNull(row.social_linkedin)
      if (li) {
        const url = li.includes('http') ? li : `https://linkedin.com/in/${li.replace(/^@/, '')}`
        socialRows.push({
          directory_profile_id: profileId,
          platform: 'linkedin',
          url,
          sort_order: so++,
        })
      }
      if (socialRows.length > 0) {
        const { error: socErr } = await supabase.from('directory_profile_social_links').insert(socialRows)
        if (socErr) throw new Error(`social: ${socErr.message}`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push({ index: i, message })
      skipped++
    }
  }

  if (batchId && !options.dryRun) {
    await supabase
      .from('directory_import_batches')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', batchId)
  }

  return { batchId, inserted, updated, skipped, errors }
}
