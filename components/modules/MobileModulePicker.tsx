'use client'

import Link from 'next/link'
import { MODULE_CATALOG, type DocumentationModuleId } from '@/lib/modules'

type Props = {
  horseId: string
  candidates: DocumentationModuleId[]
  appointmentId?: string | null
  preferredModule?: DocumentationModuleId | null
}

export default function MobileModulePicker({
  horseId,
  candidates,
  appointmentId,
  preferredModule,
}: Props) {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-[22px] font-semibold text-[#1B1F23]">Behandlungsart wählen</h1>
      <p className="mt-2 text-[14px] text-[#6B7280]">
        Mehrere Module sind freigeschaltet. Bitte wähle die Fachrichtung für diese Dokumentation.
      </p>
      <ul className="mt-5 space-y-2">
        {candidates.map((id) => {
          const def = MODULE_CATALOG[id]
          const qs = new URLSearchParams()
          qs.set('module', id)
          if (appointmentId) qs.set('appointmentId', appointmentId)
          const href = `/animals/${horseId}/records/new?${qs.toString()}`
          const isPreferred = preferredModule === id
          return (
            <li key={id}>
              <Link
                href={href}
                className={[
                  'flex items-center justify-between rounded-xl border px-4 py-3.5 text-[15px] font-medium',
                  isPreferred
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-[#E5E2DC] text-[#1B1F23]',
                ].join(' ')}
              >
                <span>{def?.label ?? id}</span>
                {isPreferred ? (
                  <span className="text-[11px] font-normal text-[#6B7280]">Termin</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
