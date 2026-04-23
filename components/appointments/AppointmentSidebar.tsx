import type { AppointmentCustomer, AppointmentDayItem, AppointmentHorse } from './types'
import {
  buildStallMultilineFromHorse,
  horseHasStructuredStall,
  pickPrimaryStallHorse,
} from '@/lib/nav/horseStableAddress'

type AppointmentSidebarProps = {
  selectedCustomer: AppointmentCustomer | null
  selectedHorses: AppointmentHorse[]
  appointmentType: string
  appointmentDate: string
  appointmentTime: string
  duration: string
  notes: string
  dayItems: AppointmentDayItem[]
}

/** Kurzes deutsches Datum — ohne Intl (Node vs. Browser liefert sonst z. B. "Do.," vs "Do." → Hydration-Mismatch). */
const WEEKDAY_DE_SHORT = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'] as const

function formatDateLabel(dateString: string) {
  if (!dateString) return '-'
  const [yStr, mStr, dStr] = dateString.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  if (!yStr || !mStr || !dStr || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return '-'
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return '-'
  const wd = WEEKDAY_DE_SHORT[date.getDay()]
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${wd} ${dd}.${mm}.${y}`
}

function formatBillingAddress(c: AppointmentCustomer) {
  const street = c.street?.trim()
  const zipCity = [c.postal_code, c.city].filter(Boolean).join(' ').trim()
  const parts = [street, zipCity].filter(Boolean)
  if (c.country?.trim() && c.country.trim() !== 'Deutschland') parts.push(c.country.trim())
  return parts.join(', ') || null
}

function formatStableAddressFromHorse(h: AppointmentHorse) {
  return buildStallMultilineFromHorse(h).trim() || null
}

export default function AppointmentSidebar({
  selectedCustomer,
  selectedHorses,
  appointmentType,
  appointmentDate,
  appointmentTime,
  duration,
  dayItems,
}: AppointmentSidebarProps) {
  const stallHorse = pickPrimaryStallHorse(selectedHorses)
  const stableBlock = stallHorse ? formatStableAddressFromHorse(stallHorse) : null
  const billingBlock = formatBillingAddress(selectedCustomer || ({} as AppointmentCustomer))
  const hasStableLocation = !!stallHorse && (horseHasStructuredStall(stallHorse) || !!stallHorse.stable_name?.trim())
  const showStable = hasStableLocation && !!stableBlock

  return (
    <div className="space-y-6">
      <div className="huf-card">
        <div className="border-b border-[var(--border)] px-[22px] py-[18px]">
          <h4 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">Tagesübersicht</h4>
        </div>
        <div className="px-[22px] py-[22px]">
          {dayItems.length === 0 ? (
            <div className="text-[13px] text-[#9CA3AF]">Keine Termine an diesem Tag.</div>
          ) : (
            <div className="space-y-3">
              {dayItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] pb-3 last:border-b-0"
                >
                  <div className="min-w-[45px] shrink-0 pt-0.5 text-[12px] font-semibold text-[#6B7280]">
                    {item.time}
                  </div>
                  <div
                    className="mt-0.5 h-7 w-[3px] shrink-0 rounded-full bg-[var(--accent)]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[#1B1F23]">
                      {item.customerName}
                    </div>
                    <div className="text-[11px] text-[#6B7280]">
                      {item.horseNames.join(' + ')}
                      {item.typeLabel ? ` · ${item.typeLabel}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="huf-card">
        <div className="border-b border-[var(--border)] px-[22px] py-[18px]">
          <h4 className="dashboard-serif text-[16px] font-medium text-[#1B1F23]">Zusammenfassung</h4>
        </div>
        <div className="px-[22px] py-[22px]">
          <div className="flex justify-between border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Kunde</span>
            <span className="max-w-[180px] text-right font-medium text-[#1B1F23]">
              {selectedCustomer?.name || '-'}
            </span>
          </div>
          {selectedCustomer?.phone ? (
            <div className="flex justify-between border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
              <span className="shrink-0 text-[#6B7280]">Telefon</span>
              <a
                href={`tel:${selectedCustomer.phone.replace(/\s/g, '')}`}
                className="max-w-[180px] text-right font-medium text-[var(--accent)] hover:underline"
              >
                {selectedCustomer.phone}
              </a>
            </div>
          ) : (
            <div className="flex justify-between border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
              <span className="text-[#6B7280]">Telefon</span>
              <span className="text-right text-[#9CA3AF]">–</span>
            </div>
          )}
          {billingBlock ? (
            <div className="border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
              <div className="mb-1 text-[#6B7280]">Rechnungsadresse</div>
              <div className="text-right font-medium leading-snug text-[#1B1F23]">{billingBlock}</div>
            </div>
          ) : selectedCustomer ? (
            <div className="border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
              <div className="mb-1 text-[#6B7280]">Rechnungsadresse</div>
              <div className="text-right text-[#9CA3AF]">–</div>
            </div>
          ) : null}
          {showStable && stableBlock ? (
            <>
              <div className="border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
                <div className="mb-1 text-[#6B7280]">
                  Stall / Standort{stallHorse?.name ? ` (${stallHorse.name})` : ''}
                </div>
                <div className="whitespace-pre-line text-right font-medium leading-snug text-[#1B1F23]">
                  {stableBlock}
                </div>
              </div>
              {stallHorse?.stable_directions?.trim() ? (
                <div className="border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
                  <div className="mb-1 text-[#6B7280]">Anfahrt zum Standort</div>
                  <div className="text-right text-[13px] leading-snug text-[#1B1F23]">
                    {stallHorse.stable_directions.trim()}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="flex justify-between border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Pferd(e)</span>
            <span className="max-w-[180px] text-right font-medium text-[var(--accent)]">
              {selectedHorses.length > 0
                ? selectedHorses.map((horse) => horse.name || '-').join(', ')
                : '-'}
            </span>
          </div>
          <div className="flex justify-between border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Terminart</span>
            <span className="font-medium text-[#1B1F23]">{appointmentType}</span>
          </div>
          <div className="flex justify-between border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Datum</span>
            <span className="font-medium text-[#1B1F23]">
              {appointmentDate ? formatDateLabel(appointmentDate) : '-'}
            </span>
          </div>
          <div className="flex justify-between border-b border-[color-mix(in_oklab,var(--foreground)_8%,transparent)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Uhrzeit</span>
            <span className="font-medium text-[#1B1F23]">{appointmentTime || '-'}</span>
          </div>
          <div className="flex justify-between py-2 text-[13px]">
            <span className="text-[#6B7280]">Dauer</span>
            <span className="font-medium text-[#1B1F23]">{duration || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}