'use client'

type AppointmentType =
  | 'Regeltermin'
  | 'Ersttermin'
  | 'Kontrolle'
  | 'Sondertermin'

type AppointmentTypePickerProps = {
  value: AppointmentType
  onChange: (value: AppointmentType) => void
}

const TYPES: Array<{
  value: AppointmentType
  iconClass: string
  label: string
  hint: string
}> = [
  { value: 'Regeltermin', iconClass: 'bi-repeat', label: 'Regeltermin', hint: 'Routinebearbeitung' },
  { value: 'Ersttermin', iconClass: 'bi-stars', label: 'Ersttermin', hint: 'Neues Pferd / Befund' },
  { value: 'Kontrolle', iconClass: 'bi-search', label: 'Kontrolle', hint: 'Nachkontrolle' },
  { value: 'Sondertermin', iconClass: 'bi-lightning-fill', label: 'Sondertermin', hint: 'Akut / außerplanmäßig' },
]

export default function AppointmentTypePicker({
  value,
  onChange,
}: AppointmentTypePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {TYPES.map((type) => {
        const selected = value === type.value

        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={[
              'rounded-[10px] border px-4 py-4 text-center transition',
              selected
                ? 'border-[#52b788] bg-[#f4f5f4]'
                : 'border-[#E5E2DC] bg-white hover:border-[#52b788] hover:bg-[#f4f5f4]',
            ].join(' ')}
          >
            <div className="mb-2 text-[22px] text-[#52b788]">
              <i className={`bi ${type.iconClass}`} />
            </div>
            <div className="text-[13px] font-semibold text-[#1B1F23]">{type.label}</div>
            <div className="mt-1 text-[11px] text-[#6B7280]">{type.hint}</div>
          </button>
        )
      })}
    </div>
  )
}