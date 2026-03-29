'use client'

import { Fragment } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  animalTypeIconColor,
  faIconForAnimalType,
} from '@/lib/animalTypeDisplay'

export type AppointmentAnimalInline = {
  name: string
  animalType?: string | null
}

/** Tier-Icons in Kalender (Woche, Liste, Mobile) – 8×8 px, Farbe wie Zeilentext */
export const CALENDAR_OVERVIEW_ICON_CLASS = 'h-[8px] w-[8px] shrink-0'

/** Tier-Icons auf der Kundendetailseite (Termine, Tierliste) – 10×10 px */
export const CUSTOMER_DETAIL_ANIMAL_ICON_CLASS = 'h-[10px] w-[10px] shrink-0'

type AppointmentAnimalsInlineProps = {
  animals: AppointmentAnimalInline[]
  emptyText?: string
  /** Zusatzklassen fürs Icon; ohne inheritTextStyle: Default h-3 w-3 shrink-0 */
  iconClassName?: string
  className?: string
  /**
   * Kalender & Co.: Icon-Farbe wie Zeilentext (currentColor). Größe per iconClassName, z. B. CALENDAR_OVERVIEW_ICON_CLASS.
   * Standard: Dunkelgrün #154226, feste Icon-Größe.
   */
  inheritTextStyle?: boolean
}

/**
 * Zeigt pro Tier das passende Font-Awesome-Icon direkt vor dem Namen.
 */
export default function AppointmentAnimalsInline({
  animals,
  emptyText = 'Kein Tier zugeordnet',
  iconClassName,
  className = '',
  inheritTextStyle = false,
}: AppointmentAnimalsInlineProps) {
  if (!animals.length) {
    return <span className={className}>{emptyText}</span>
  }

  const sepClass = inheritTextStyle ? 'text-current opacity-45' : 'text-[#9CA3AF]'
  const iconCls = inheritTextStyle
    ? iconClassName
      ? ['text-current', iconClassName].filter(Boolean).join(' ')
      : 'h-[1em] w-[1em] shrink-0 text-current'
    : iconClassName ?? 'h-3 w-3 shrink-0'
  const iconStyle = inheritTextStyle ? undefined : { color: animalTypeIconColor }
  /** FA setzt oft height:1em per Inline-Style — schlägt Tailwind h-[Npx]; N aus Klasse übernehmen. */
  const fixedPx =
    iconClassName?.match(/h-\[(\d+)px\]/)?.[1] ??
    iconClassName?.match(/w-\[(\d+)px\]/)?.[1]
  const faFixedPxStyle = fixedPx
    ? ({
        width: Number(fixedPx),
        height: Number(fixedPx),
        maxWidth: Number(fixedPx),
        maxHeight: Number(fixedPx),
        fontSize: Number(fixedPx),
        verticalAlign: '-0.05em',
      } as const)
    : null
  const mergedIconStyle = faFixedPxStyle
    ? { ...faFixedPxStyle, ...(iconStyle ?? {}) }
    : iconStyle

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 ${className}`}>
      {animals.map((a, i) => (
        <Fragment key={`${a.name}-${i}`}>
          {i > 0 ? (
            <span className={sepClass} aria-hidden>
              ·
            </span>
          ) : null}
          <span className="inline-flex items-center gap-0.5">
            <FontAwesomeIcon
              icon={faIconForAnimalType(a.animalType)}
              className={iconCls}
              style={mergedIconStyle}
            />
            <span>{a.name}</span>
          </span>
        </Fragment>
      ))}
    </span>
  )
}
