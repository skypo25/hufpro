import 'server-only'

import { cache } from 'react'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import {
  isDocumentationModuleId,
  modulesFromProfessions,
} from '@/lib/modules/catalog'
import type {
  DocumentationModuleId,
  ModuleEntitlementSource,
} from '@/lib/modules/types'
import { DOCUMENTATION_MODULE_IDS } from '@/lib/modules/types'

export type EffectiveModules = {
  enabled: DocumentationModuleId[]
  /** true, wenn bereits Entitlement-Zeilen existieren (auch disabled). */
  hasEntitlementRows: boolean
}

type EntitlementDbRow = {
  module_id: string
  enabled: boolean
}

/**
 * Aktive Module eines Users (Service Role).
 * Keine Client-Schreibrechte — nur Admin / Onboarding-RPC.
 */
async function loadEnabledModules(userId: string): Promise<EffectiveModules> {
  const db = createSupabaseServiceRoleClient()
  const { data, error } = await db
    .from('user_documentation_modules')
    .select('module_id, enabled')
    .eq('user_id', userId)

  if (error) {
    console.error('[modules] getEnabledDocumentationModules', error.message)
    return { enabled: [], hasEntitlementRows: false }
  }

  const rows = (data ?? []) as EntitlementDbRow[]
  const enabled = rows
    .filter((r) => r.enabled && isDocumentationModuleId(r.module_id))
    .map((r) => r.module_id as DocumentationModuleId)

  return { enabled, hasEntitlementRows: rows.length > 0 }
}

/**
 * Einmalige Legacy-Übernahme: Profession + vorhandene Docs → Entitlements.
 * Idempotent. Wird von GET /api/me/documentation-modules getriggert.
 */
export async function ensureLegacyModulesMigrated(userId: string): Promise<EffectiveModules> {
  const current = await loadEnabledModules(userId)
  if (current.hasEntitlementRows) return current

  const db = createSupabaseServiceRoleClient()
  const { data: settingsRow } = await db
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle()
  const settings = (settingsRow?.settings ?? {}) as Record<string, unknown>
  if (settings.onboarding_complete !== true) {
    return current
  }

  const { count: hoofCount } = await db
    .from('hoof_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { data: docKinds } = await db
    .from('documentation_records')
    .select('documentation_kind, therapy_discipline')
    .eq('user_id', userId)
    .limit(200)

  const hasHoofDocs = (hoofCount ?? 0) > 0 ||
    (docKinds ?? []).some((d) => d.documentation_kind === 'hoof')
  const therapyRows = (docKinds ?? []).filter((d) => d.documentation_kind === 'therapy')
  const hasTherapyDocs = therapyRows.length > 0
  const therapyDisciplines = therapyRows.map(
    (d) => d.therapy_discipline as 'physio' | 'osteo' | 'heilpraktik' | 'other' | null
  )

  try {
    await migrateUserModulesFromLegacy({
      userId,
      professions: settings.profession,
      hasHoofDocs,
      hasTherapyDocs,
      therapyDisciplines,
    })
  } catch (e) {
    console.error('[modules] legacy migrate', e)
  }

  return loadEnabledModules(userId)
}

export const getEnabledDocumentationModulesCached = cache(
  async (userId: string): Promise<EffectiveModules> => {
    return ensureLegacyModulesMigrated(userId)
  }
)

export async function userHasDocumentationModule(
  userId: string,
  moduleId: DocumentationModuleId
): Promise<boolean> {
  const { enabled } = await getEnabledDocumentationModulesCached(userId)
  return enabled.includes(moduleId)
}

/**
 * Einmalige Erstfreischaltung (Onboarding).
 * Idempotent: wenn bereits Zeilen existieren → no-op (keine neuen Rechte).
 */
export async function grantModulesFromOnboardingOnce(params: {
  userId: string
  professions: unknown
}): Promise<{ granted: DocumentationModuleId[]; skipped: boolean }> {
  const db = createSupabaseServiceRoleClient()
  const { data: existing } = await db
    .from('user_documentation_modules')
    .select('module_id')
    .eq('user_id', params.userId)
    .limit(1)

  if (existing && existing.length > 0) {
    return { granted: [], skipped: true }
  }

  const modules = modulesFromProfessions(params.professions)
  const fallback: DocumentationModuleId[] =
    modules.length > 0 ? modules : ['hoof']

  const now = new Date().toISOString()
  const rows = fallback.map((module_id) => ({
    user_id: params.userId,
    module_id,
    enabled: true,
    source: 'onboarding' as ModuleEntitlementSource,
    granted_at: now,
    granted_by: null,
    updated_at: now,
    updated_by: null,
  }))

  const { error } = await db.from('user_documentation_modules').insert(rows)
  if (error) {
    // Race: paralleler Insert → als skipped behandeln wenn Unique-Violation
    if (/duplicate|unique/i.test(error.message)) {
      return { granted: [], skipped: true }
    }
    throw new Error(error.message)
  }

  return { granted: fallback, skipped: false }
}

/**
 * Admin: Modul aktivieren/deaktivieren.
 * Upsert — erstellt Zeile falls fehlend.
 */
export async function setUserDocumentationModule(params: {
  userId: string
  moduleId: DocumentationModuleId
  enabled: boolean
  adminUserId: string
}): Promise<void> {
  const db = createSupabaseServiceRoleClient()
  const now = new Date().toISOString()

  const { data: existing } = await db
    .from('user_documentation_modules')
    .select('module_id, granted_at, granted_by, source')
    .eq('user_id', params.userId)
    .eq('module_id', params.moduleId)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('user_documentation_modules')
      .update({
        enabled: params.enabled,
        updated_at: now,
        updated_by: params.adminUserId,
        source: 'admin',
      })
      .eq('user_id', params.userId)
      .eq('module_id', params.moduleId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await db.from('user_documentation_modules').insert({
    user_id: params.userId,
    module_id: params.moduleId,
    enabled: params.enabled,
    source: 'admin',
    granted_at: now,
    granted_by: params.adminUserId,
    updated_at: now,
    updated_by: params.adminUserId,
  })
  if (error) throw new Error(error.message)
}

export async function listUserDocumentationModuleRows(userId: string): Promise<
  { module_id: DocumentationModuleId; enabled: boolean }[]
> {
  const db = createSupabaseServiceRoleClient()
  const { data, error } = await db
    .from('user_documentation_modules')
    .select('module_id, enabled')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  const byId = new Map<DocumentationModuleId, boolean>()
  for (const id of DOCUMENTATION_MODULE_IDS) byId.set(id, false)
  for (const row of data ?? []) {
    if (isDocumentationModuleId(row.module_id)) {
      byId.set(row.module_id, Boolean(row.enabled))
    }
  }
  return DOCUMENTATION_MODULE_IDS.map((module_id) => ({
    module_id,
    enabled: byId.get(module_id) ?? false,
  }))
}

/**
 * Migration bestehender User: Profession + vorhandene Docs → Module.
 * Idempotent (nur fehlende Module hinzufügen, bestehende nicht überschreiben).
 */
export async function migrateUserModulesFromLegacy(params: {
  userId: string
  professions: unknown
  hasHoofDocs: boolean
  hasTherapyDocs: boolean
  therapyDisciplines: Array<'physio' | 'osteo' | 'heilpraktik' | 'other' | null>
}): Promise<DocumentationModuleId[]> {
  const db = createSupabaseServiceRoleClient()
  const { data: existing } = await db
    .from('user_documentation_modules')
    .select('module_id')
    .eq('user_id', params.userId)

  const have = new Set(
    (existing ?? [])
      .map((r) => r.module_id)
      .filter(isDocumentationModuleId)
  )

  const want = new Set<DocumentationModuleId>(modulesFromProfessions(params.professions))
  if (params.hasHoofDocs) want.add('hoof')
  if (params.hasTherapyDocs) {
    for (const d of params.therapyDisciplines) {
      if (d === 'physio') want.add('physio')
      else if (d === 'osteo') want.add('osteo')
      else if (d === 'heilpraktik') want.add('heilpraktik')
      else want.add('heilpraktik')
    }
    if (want.size === modulesFromProfessions(params.professions).length && !want.has('physio') && !want.has('osteo') && !want.has('heilpraktik')) {
      want.add('heilpraktik')
    }
  }
  if (want.size === 0) want.add('hoof')

  const toInsert = [...want].filter((id) => !have.has(id))
  if (toInsert.length === 0) return []

  const now = new Date().toISOString()
  const { error } = await db.from('user_documentation_modules').insert(
    toInsert.map((module_id) => ({
      user_id: params.userId,
      module_id,
      enabled: true,
      source: 'migration' as ModuleEntitlementSource,
      granted_at: now,
      granted_by: null,
      updated_at: now,
      updated_by: null,
    }))
  )
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message)
  }
  return toInsert
}
