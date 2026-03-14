'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import TimePicker from '@/components/form/TimePicker'

type Customer = {
  id: string
  name: string | null
}

type Horse = {
  id: string
  name: string | null
  customer_id: string | null
}

type NewAppointmentFormProps = {
  customers: Customer[]
  horses: Horse[]
  initialCustomerId: string
}

export default function NewAppointmentForm({
  customers,
  horses,
  initialCustomerId,
}: NewAppointmentFormProps) {
  const router = useRouter()

  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [selectedHorseIds, setSelectedHorseIds] = useState<string[]>([])
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const filteredHorses = useMemo(() => {
    if (!customerId) return []
    return horses.filter((horse) => horse.customer_id === customerId)
  }, [horses, customerId])

  function toggleHorse(horseId: string) {
    setSelectedHorseIds((prev) =>
      prev.includes(horseId)
        ? prev.filter((id) => id !== horseId)
        : [...prev, horseId]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Du bist nicht eingeloggt.')
      setLoading(false)
      router.push('/login')
      return
    }

    if (!customerId) {
      setMessage('Bitte einen Kunden auswählen.')
      setLoading(false)
      return
    }

    if (selectedHorseIds.length === 0) {
      setMessage('Bitte mindestens ein Pferd auswählen.')
      setLoading(false)
      return
    }

    let appointmentDateTime: string | null = null

    if (appointmentDate) {
      appointmentDateTime = appointmentTime
        ? `${appointmentDate}T${appointmentTime}:00`
        : `${appointmentDate}T00:00:00`
    }

    const leadHorseId = selectedHorseIds[0] || null

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert([
        {
          user_id: user.id,
          customer_id: customerId,
          horse_id: leadHorseId,
          appointment_date: appointmentDateTime,
          notes: notes || null,
        },
      ])
      .select('id')
      .single()

    if (appointmentError || !appointment) {
      setMessage(
        `Fehler beim Speichern des Termins: ${
          appointmentError?.message || 'Unbekannter Fehler'
        }`
      )
      setLoading(false)
      return
    }

    const appointmentHorseRows = selectedHorseIds.map((horseId) => ({
      appointment_id: appointment.id,
      horse_id: horseId,
      user_id: user.id,
    }))

    const { error: relationError } = await supabase
      .from('appointment_horses')
      .insert(appointmentHorseRows)

    if (relationError) {
      setMessage(
        `Termin gespeichert, aber Pferde konnten nicht verknüpft werden: ${relationError.message}`
      )
      setLoading(false)
      return
    }

    router.push(`/customers/${customerId}`)
    router.refresh()
  }

  return (
    <div className="rounded-[20px] border border-[#E5E2DC] bg-white p-8 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-3 block text-[14px] font-medium text-[#334155]">
            Kunde
          </label>
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              setSelectedHorseIds([])
            }}
            required
            className="w-full rounded-[16px] border border-[#D7DEE8] bg-white px-6 py-5 text-[16px] text-[#0F172A] outline-none focus:border-[#154226]"
          >
            <option value="">Kunde auswählen</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name || '-'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-3 block text-[14px] font-medium text-[#334155]">
            Pferde
          </label>

          {!customerId ? (
            <div className="rounded-[16px] border border-[#D7DEE8] bg-[#F8FAFC] px-6 py-5 text-[15px] text-[#64748B]">
              Bitte zuerst einen Kunden auswählen.
            </div>
          ) : filteredHorses.length === 0 ? (
            <div className="rounded-[16px] border border-[#D7DEE8] bg-[#F8FAFC] px-6 py-5 text-[15px] text-[#64748B]">
              Für diesen Kunden sind keine Pferde vorhanden.
            </div>
          ) : (
            <div className="space-y-3 rounded-[16px] border border-[#D7DEE8] bg-white p-4">
              {filteredHorses.map((horse) => {
                const checked = selectedHorseIds.includes(horse.id)

                return (
                  <label
                    key={horse.id}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition',
                      checked
                        ? 'border-[#154226] bg-[#f0f7f2]'
                        : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1]',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHorse(horse.id)}
                      className="h-4 w-4 accent-[#154226]"
                    />
                    <span className="text-[15px] font-medium text-[#0F172A]">
                      {horse.name || '-'}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-3 block text-[14px] font-medium text-[#334155]">
              Datum
            </label>
            <input
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              required
              className="w-full rounded-[16px] border border-[#D7DEE8] bg-white px-6 py-5 text-[16px] text-[#0F172A] outline-none focus:border-[#154226]"
            />
          </div>

          <div>
            <label className="mb-3 block text-[14px] font-medium text-[#334155]">
              Uhrzeit
            </label>
            <TimePicker
              value={appointmentTime}
              onChange={setAppointmentTime}
              className="w-full rounded-[16px] px-6 py-5 text-[16px]"
            />
          </div>
        </div>

        <div>
          <label className="mb-3 block text-[14px] font-medium text-[#334155]">
            Notiz
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="z. B. Kontrolle, Barhufbearbeitung, Rücksprache mit Besitzer"
            className="w-full rounded-[16px] border border-[#D7DEE8] bg-white px-6 py-5 text-[16px] text-[#0F172A] outline-none placeholder:text-[#8A94A6] focus:border-[#154226]"
          />
        </div>

        {message && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-[16px] bg-[#0B1736] px-6 py-5 text-[16px] font-medium text-white transition hover:bg-[#09122b] disabled:opacity-60"
        >
          {loading ? 'Bitte warten...' : 'Termin speichern'}
        </button>
      </form>
    </div>
  )
}