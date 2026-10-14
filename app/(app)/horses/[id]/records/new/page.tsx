import { redirect } from 'next/navigation'
import RecordCreateForm from '@/components/records/RecordCreateForm'
import TherapyModuleRecordForm from '@/components/records/TherapyModuleRecordForm'
import ModulePicker from '@/components/modules/ModulePicker'
import { createRecord } from '@/app/(app)/horses/[id]/records/actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { SLOT_LABELS } from '@/lib/photos/photoTypes'
import { loadRecordListForHorseView } from '@/lib/documentation/loadRecordListForHorseView'
import { loadRecordDetailFromDocumentation } from '@/lib/documentation/loadRecordForDetailView'
import { loadAppointmentDocContext } from '@/lib/documentation/appointmentLink'
import AppPage from '@/components/layout/AppPage'
import { getEnabledDocumentationModules } from '@/lib/modules/entitlements.server'
import {
  isDocumentationModuleId,
  MODULE_CATALOG,
} from '@/lib/modules/catalog'
import { resolveModulesForAnimal } from '@/lib/modules/resolve'
import type { DocumentationModuleId } from '@/lib/modules/types'

/** Modulwahl hängt an frischen Entitlements — nie statisch cachen. */
export const dynamic = 'force-dynamic'

type NewRecordPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    appointmentId?: string
    module?: string
  }>
}

type HorseRow = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birth_year: number | null
  animal_type?: string | null
  special_notes: string | null
  notes: string | null
  stable_name: string | null
  stable_city: string | null
  customers:
    | {
        name: string | null
        city: string | null
      }
    | {
        name: string | null
        city: string | null
      }[]
    | null
}

function getRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function getTodayISODate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWholeBodySlot(photoType: string | null | undefined): boolean {
  return photoType === 'whole_left' || photoType === 'whole_right'
}

export default async function NewHoofRecordPage({ params, searchParams }: NewRecordPageProps) {
  const { id } = await params
  const { appointmentId: appointmentIdParam, module: moduleParam } = await searchParams
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { enabled: enabledModules } = await getEnabledDocumentationModules(user.id)

  const { data: horseRow } = await supabase
    .from('horses')
    .select(
      `
        id,
        name,
        breed,
        sex,
        birth_year,
        animal_type,
        special_notes,
        notes,
        stable_name,
        stable_city,
        customers (
          name,
          city
        )
      `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single<HorseRow>()

  const customer = getRelation(horseRow?.customers ?? null)

  const horse = horseRow?.id
    ? {
        id: horseRow.id,
        name: horseRow.name || 'Pferd',
        breed: horseRow.breed,
        sex: horseRow.sex,
        birthYear: horseRow.birth_year,
        customerName: customer?.name || 'Kunde',
        stableName:
          horseRow.stable_name ||
          horseRow.stable_city ||
          customer?.city ||
          null,
        memo: horseRow.special_notes || horseRow.notes || null,
      }
    : null

  const list = await loadRecordListForHorseView(supabase, user.id, id)

  let lastRecord: { date: string | null; text: string } | null = null
  const erstterminBodyPhotos: { url: string; label: string }[] = []
  let erstterminRecordDate: string | null = null
  let defaultRecordType: 'Regeltermin' | 'ersttermin' = 'ersttermin'

  if (list.recordRows.length > 0) {
    defaultRecordType = 'Regeltermin'
    const latestId = list.recordRows[0].record.id

    const latestDocLoad = await loadRecordDetailFromDocumentation(supabase, user.id, id, latestId)

    if (latestDocLoad.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.info('[new-record] letzter Eintrag: documentation_*', { latestId })
      }
      const r = latestDocLoad.record
      lastRecord = {
        date: r.record_date,
        text: [r.hoof_condition, r.treatment, r.notes].filter(Boolean).join(' · ') || '',
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[new-record] letzter Eintrag: Fallback hoof_*', { latestId, reason: latestDocLoad.reason })
      }
      const { data: hr } = await supabase
        .from('hoof_records')
        .select('record_date, notes, hoof_condition, treatment')
        .eq('id', latestId)
        .eq('horse_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (hr) {
        lastRecord = {
          date: hr.record_date,
          text: [hr.hoof_condition, hr.treatment, hr.notes].filter(Boolean).join(' · ') || '',
        }
      }
    }

    // Ersttermin-Fotokontext nur für Hufmodul relevant
    const loadHoofErstterminContext =
      (isDocumentationModuleId(moduleParam) && moduleParam === 'hoof') ||
      (!moduleParam && enabledModules.includes('hoof'))
    if (loadHoofErstterminContext) {
      const oldestRow = list.recordRows[list.recordRows.length - 1].record
      const oldestId = oldestRow.id
      erstterminRecordDate = oldestRow.record_date

      const oldestDocLoad =
        oldestId === latestId
          ? latestDocLoad
          : await loadRecordDetailFromDocumentation(supabase, user.id, id, oldestId)

      if (oldestDocLoad.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.info('[new-record] Ersttermin-Kontext: documentation_* Fotos', { oldestId })
        }
        const whole = oldestDocLoad.photos.filter((p) => isWholeBodySlot(p.photo_type))
        for (const p of whole) {
          if (!p.file_path || !p.photo_type) continue
          const { data: signed } = await supabase.storage
            .from('hoof-photos')
            .createSignedUrl(p.file_path, 60 * 60)
          if (signed?.signedUrl) {
            erstterminBodyPhotos.push({
              url: signed.signedUrl,
              label: SLOT_LABELS[p.photo_type] ?? p.photo_type,
            })
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[new-record] Ersttermin-Kontext: Fallback hoof_* Fotos', {
            oldestId,
            reason: oldestDocLoad.reason,
          })
        }
        const { data: bodyPhotos } = await supabase
          .from('hoof_photos')
          .select('file_path, photo_type')
          .eq('hoof_record_id', oldestId)
          .eq('user_id', user.id)
          .in('photo_type', ['whole_left', 'whole_right'])

        if (bodyPhotos?.length) {
          for (const p of bodyPhotos) {
            if (!p.file_path || !p.photo_type) continue
            const { data: signed } = await supabase.storage
              .from('hoof-photos')
              .createSignedUrl(p.file_path, 60 * 60)
            if (signed?.signedUrl) {
              erstterminBodyPhotos.push({
                url: signed.signedUrl,
                label: SLOT_LABELS[p.photo_type] ?? p.photo_type,
              })
            }
          }
        }
      }
    }
  }

  const defaultRecordDate = getTodayISODate()
  let recordDate = defaultRecordDate
  let recordType = defaultRecordType === 'ersttermin' ? 'Ersttermin' : defaultRecordType
  let appointmentId: string | null = null

  if (appointmentIdParam) {
    // Mehrere Dokumentationen pro Termin erlaubt — nicht automatisch zur ersten bestehenden springen.
    const ctx = await loadAppointmentDocContext(supabase, user.id, id, appointmentIdParam)
    if (ctx) {
      appointmentId = ctx.appointmentId
      recordDate = ctx.recordDate
      recordType = ctx.recordType
    }
  }

  const therapyHorse = horse
    ? {
        id: horse.id,
        name: horse.name,
        breed: horse.breed,
        sex: horse.sex,
        birthYear: horse.birthYear,
        customerName: horse.customerName,
        stableName: horse.stableName,
        memo: horse.memo,
      }
    : null

  // Optionales Modul am Termin (Vorauswahl, blockiert keine weiteren Module)
  let preferredModule: DocumentationModuleId | null = null
  if (appointmentIdParam) {
    const { data: apt } = await supabase
      .from('appointments')
      .select('documentation_module')
      .eq('id', appointmentIdParam)
      .eq('user_id', user.id)
      .maybeSingle()
    if (isDocumentationModuleId(apt?.documentation_module)) {
      preferredModule = apt.documentation_module
    }
  }

  const animalType = horseRow?.animal_type ?? 'horse'
  const resolved = resolveModulesForAnimal(enabledModules, animalType, preferredModule)

  if (resolved.status === 'none') {
    return (
      <AppPage>
        <div className="rounded-2xl border border-[#E5E2DC] bg-white p-6">
          <h1 className="text-lg font-semibold text-[#1B1F23]">Keine passende Dokumentation</h1>
          <p className="mt-2 text-[14px] text-[#6B7280]">
            Für diese Tierart ist kein freigeschaltetes Dokumentationsmodul verfügbar. Bitte wende dich an den
            Support, wenn du ein weiteres Modul benötigst.
          </p>
        </div>
      </AppPage>
    )
  }

  let selectedModule: DocumentationModuleId | null = null
  if (isDocumentationModuleId(moduleParam) && resolved.candidates.includes(moduleParam)) {
    selectedModule = moduleParam
  } else if (resolved.status === 'single') {
    selectedModule = resolved.moduleId
  } else if (resolved.status === 'choice') {
    return (
      <AppPage>
        <ModulePicker
          horseId={id}
          candidates={resolved.candidates}
          appointmentId={appointmentId}
          preferredModule={preferredModule}
        />
      </AppPage>
    )
  }

  if (!selectedModule) {
    return (
      <AppPage>
        <ModulePicker
          horseId={id}
          candidates={resolved.candidates}
          appointmentId={appointmentId}
          preferredModule={preferredModule}
        />
      </AppPage>
    )
  }

  const moduleDef = MODULE_CATALOG[selectedModule]

  if (moduleDef.documentationKind === 'therapy') {
    return (
      <AppPage>
        <TherapyModuleRecordForm
          horse={therapyHorse}
          animalType={animalType}
          moduleId={selectedModule}
          defaultRecordDate={recordDate}
          defaultRecordType={recordType}
          appointmentId={appointmentId}
          lastRecord={lastRecord}
          saveAction={createRecord}
        />
      </AppPage>
    )
  }

  return (
    <AppPage>
      <RecordCreateForm
        horse={horse}
        defaultRecordDate={recordDate}
        defaultRecordType={recordType}
        appointmentId={appointmentId}
        lastRecord={lastRecord}
        textBlocks={[]}
        saveAction={createRecord}
        erstterminBodyPhotos={erstterminBodyPhotos}
        erstterminRecordDate={erstterminRecordDate}
      />
    </AppPage>
  )
}