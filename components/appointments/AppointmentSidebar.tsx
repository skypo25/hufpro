import type { AppointmentCustomer, AppointmentDayItem, AppointmentHorse } from './types'

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

function formatDateLabel(dateString: string) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatBillingAddress(c: AppointmentCustomer) {
  const street = c.street?.trim()
  const zipCity = [c.postal_code, c.city].filter(Boolean).join(' ').trim()
  const parts = [street, zipCity].filter(Boolean)
  if (c.country?.trim() && c.country.trim() !== 'Deutschland') parts.push(c.country.trim())
  return parts.join(', ') || null
}

function formatStableAddress(c: AppointmentCustomer) {
  const lines: string[] = []
  if (c.stable_name) lines.push(c.stable_name)
  const streetZipCity = [c.stable_street, [c.stable_zip, c.stable_city].filter(Boolean).join(' ')].filter(Boolean)
  if (streetZipCity.length) lines.push(streetZipCity.join(', '))
  if (c.stable_country && c.stable_country !== 'Deutschland') lines.push(c.stable_country)
  return lines.length ? lines.join('\n') : null
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
  const stableDiffers = !!selectedCustomer?.stable_differs
  const stableBlock = formatStableAddress(selectedCustomer || ({} as AppointmentCustomer))
  const billingBlock = formatBillingAddress(selectedCustomer || ({} as AppointmentCustomer))
  const hasStableLocation =
    !!(selectedCustomer?.stable_street?.trim() ||
      selectedCustomer?.stable_city?.trim() ||
      selectedCustomer?.stable_zip?.trim() ||
      selectedCustomer?.stable_name?.trim())
  const showStable = stableDiffers && hasStableLocation && !!stableBlock

  return (
    <div className="space-y-6">
      <div className="huf-card">
        <div className="border-b border-[#E5E2DC] px-5 py-4">
          <h4 className="dashboard-serif text-[15px] text-[#1B1F23]">Tagesübersicht</h4>
        </div>
        <div className="p-5">
          {dayItems.length === 0 ? (
            <div className="text-[13px] text-[#9CA3AF]">Keine Termine an diesem Tag.</div>
          ) : (
            <div className="space-y-3">
              {dayItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 border-b border-[rgba(0,0,0,0.04)] pb-3 last:border-b-0">
                  <div className="min-w-[45px] text-[12px] font-semibold text-[#6B7280]">
                    {item.time}
                  </div>
                  <div className="mt-1 h-7 w-[3px] rounded-full bg-[#52b788]" />
                  <div className="min-w-0">
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
        <div className="border-b border-[#E5E2DC] px-5 py-4">
          <h4 className="dashboard-serif text-[15px] text-[#1B1F23]">Zusammenfassung</h4>
        </div>
        <div className="p-5">
          <div className="flex justify-between border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Kunde</span>
            <span className="max-w-[180px] text-right font-medium text-[#1B1F23]">
              {selectedCustomer?.name || '-'}
            </span>
          </div>
          {selectedCustomer?.phone ? (
            <div className="flex justify-between border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
              <span className="shrink-0 text-[#6B7280]">Telefon</span>
              <a
                href={`tel:${selectedCustomer.phone.replace(/\s/g, '')}`}
                className="max-w-[180px] text-right font-medium text-[#52b788] hover:underline"
              >
                {selectedCustomer.phone}
              </a>
            </div>
          ) : (
            <div className="flex justify-between border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
              <span className="text-[#6B7280]">Telefon</span>
              <span className="text-right text-[#9CA3AF]">–</span>
            </div>
          )}
          {showStable ? (
            <>
              <div className="border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
                <div className="mb-1 text-[#6B7280]">Stalladresse</div>
                <div className="whitespace-pre-line text-right font-medium leading-snug text-[#1B1F23]">
                  {stableBlock}
                </div>
              </div>
              {selectedCustomer?.directions?.trim() ? (
                <div className="border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
                  <div className="mb-1 text-[#6B7280]">Anfahrt</div>
                  <div className="text-right text-[13px] leading-snug text-[#1B1F23]">
                    {selectedCustomer.directions.trim()}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {billingBlock ? (
                <div className="border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
                  <div className="mb-1 text-[#6B7280]">Adresse</div>
                  <div className="text-right font-medium leading-snug text-[#1B1F23]">{billingBlock}</div>
                </div>
              ) : selectedCustomer ? (
                <div className="border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
                  <div className="mb-1 text-[#6B7280]">Adresse</div>
                  <div className="text-right text-[#9CA3AF]">–</div>
                </div>
              ) : null}
              {stableDiffers && !showStable && selectedCustomer?.directions?.trim() ? (
                <div className="border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
                  <div className="mb-1 text-[#6B7280]">Anfahrt</div>
                  <div className="text-right text-[13px] leading-snug text-[#1B1F23]">
                    {selectedCustomer.directions.trim()}
                  </div>
                </div>
              ) : null}
            </>
          )}
          <div className="flex justify-between border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Pferd(e)</span>
            <span className="max-w-[180px] text-right font-medium text-[#52b788]">
              {selectedHorses.length > 0
                ? selectedHorses.map((horse) => horse.name || '-').join(', ')
                : '-'}
            </span>
          </div>
          <div className="flex justify-between border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Terminart</span>
            <span className="font-medium text-[#1B1F23]">{appointmentType}</span>
          </div>
          <div className="flex justify-between border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
            <span className="text-[#6B7280]">Datum</span>
            <span className="font-medium text-[#1B1F23]">
              {appointmentDate ? formatDateLabel(appointmentDate) : '-'}
            </span>
          </div>
          <div className="flex justify-between border-b border-[rgba(0,0,0,0.04)] py-2 text-[13px]">
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