'use client'

import type { AppointmentHorse } from './types'
import { getAgeFromBirthYear } from '@/lib/format'

type HorsePickerProps = {
  horses: AppointmentHorse[]
  selectedHorseIds: string[]
  onToggleHorse: (horseId: string) => void
}

function horseMeta(horse: AppointmentHorse) {
  const age = getAgeFromBirthYear(horse.birth_year ?? null)
  const parts = [horse.breed, horse.sex, age ? `${age} J.` : null].filter(Boolean)
  return parts.join(' · ')
}

export default function HorsePicker({
  horses,
  selectedHorseIds,
  onToggleHorse,
}: HorsePickerProps) {
  if (horses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#E5E2DC] px-4 py-6 text-center text-[13px] text-[#6B7280]">
        Keine Pferde für diesen Kunden gefunden.
      </div>
    )
  }

  if (horses.length === 1) {
    const horse = horses[0]

    return (
      <div className="rounded-[10px] border-2 border-[#154226] bg-[rgba(21,66,38,0.05)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-[#1B1F23]">
              {horse.name || '-'}
            </div>
            <div className="text-[12px] text-[#6B7280]">{horseMeta(horse)}</div>
          </div>
          <div className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-semibold text-[#166534]">
            automatisch gewählt
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {horses.map((horse) => {
        const selected = selectedHorseIds.includes(horse.id)

        return (
          <button
            key={horse.id}
            type="button"
            onClick={() => onToggleHorse(horse.id)}
            className={[
              'flex w-full items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition',
              selected
                ? 'border-2 border-[#154226] bg-[rgba(21,66,38,0.05)]'
                : 'border-[#E5E2DC] bg-white hover:border-[#154226] hover:bg-[rgba(21,66,38,0.02)]',
            ].join(' ')}
          >
            <div
              className={[
                'flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border-2 text-[12px]',
                selected
                  ? 'border-[#154226] bg-[#154226] text-white'
                  : 'border-[#E5E2DC] text-transparent',
              ].join(' ')}
            >
              ✓
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-[#1B1F23]">
                {horse.name || '-'}
              </div>
              <div className="truncate text-[12px] text-[#6B7280]">
                {horseMeta(horse)}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}