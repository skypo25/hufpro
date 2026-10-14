import 'server-only'

import { NextResponse } from 'next/server'
import {
  getEnabledDocumentationModulesCached,
  userHasDocumentationModule,
} from '@/lib/modules/entitlements.server'
import {
  animalTypesForModules,
  moduleSupportsAnimalType,
  normalizeAppAnimalType,
} from '@/lib/modules/catalog'
import type { DocumentationModuleId } from '@/lib/modules/types'
import { canCreateDocumentationForModule } from '@/lib/modules/resolve'

export async function requireDocumentationModule(
  userId: string,
  moduleId: DocumentationModuleId
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const allowed = await userHasDocumentationModule(userId, moduleId)
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Modul nicht freigeschaltet.', moduleId },
        { status: 403 }
      ),
    }
  }
  return { ok: true }
}

export async function requireCanCreateDocumentation(params: {
  userId: string
  moduleId: DocumentationModuleId
  animalType: string | null | undefined
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { enabled } = await getEnabledDocumentationModulesCached(params.userId)
  if (
    !canCreateDocumentationForModule({
      enabledModules: enabled,
      moduleId: params.moduleId,
      animalType: params.animalType,
    })
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Dokumentation für dieses Modul/Tier nicht erlaubt.',
          moduleId: params.moduleId,
        },
        { status: 403 }
      ),
    }
  }
  return { ok: true }
}

export async function requireAllowedAnimalType(params: {
  userId: string
  animalType: string | null | undefined
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { enabled } = await getEnabledDocumentationModulesCached(params.userId)
  const allowed = animalTypesForModules(enabled)
  const key = normalizeAppAnimalType(params.animalType)
  if (enabled.length === 0 || !allowed.includes(key)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Tierart nicht durch freigeschaltete Module erlaubt.', animalType: key },
        { status: 403 }
      ),
    }
  }
  return { ok: true }
}

export async function assertModuleSupportsAnimal(
  moduleId: DocumentationModuleId,
  animalType: string | null | undefined
): Promise<boolean> {
  return moduleSupportsAnimalType(moduleId, animalType)
}
