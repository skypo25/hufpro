'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import TimePicker from '@/components/form/TimePicker'
import {
  isoToLocalDateInputValue,
  isoToLocalTimeInputValue,
  localDateTimeToUtcIso,
  localDateToUtcIsoStartOfDay,
} from '@/lib/datetime/localDateTime'

type Customer = {
  id: string
  name: string | null
}

type Horse = {
  id: string
  name: string | null
  customer_id: string | null
}

type Appointment = {
  id: string
  customer_id: string | null
  appointment_date: string | null
  notes: string | null
}

type Props = {
  appointment: Appointment
  customers: Customer[]
  horses: Horse[]
  selectedHorseIds: string[]
}

export default function EditAppointmentForm({
  appointment,
  customers,
  horses,
  selectedHorseIds,
}: Props) {
  const router = useRouter()

  const [customerId, setCustomerId] = useState(
    appointment.customer_id || ''
  )

  const [horseIds, setHorseIds] = useState<string[]>(selectedHorseIds)

  const [date, setDate] = useState(
    isoToLocalDateInputValue(appointment.appointment_date) || ''
  )

  const [time, setTime] = useState(
    isoToLocalTimeInputValue(appointment.appointment_date) || ''
  )

  const [notes, setNotes] = useState(appointment.notes || '')

  const filteredHorses = useMemo(() => {
    if (!customerId) return []
    return horses.filter((h) => h.customer_id === customerId)
  }, [customerId, horses])

  function toggleHorse(id: string) {
    if (horseIds.includes(id)) {
      setHorseIds(horseIds.filter((h) => h !== id))
    } else {
      setHorseIds([...horseIds, id])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    let appointmentDateTime: string | null = null

    if (date) {
      appointmentDateTime = time
        ? localDateTimeToUtcIso(date, time)
        : localDateToUtcIsoStartOfDay(date)
    }

    await supabase
      .from('appointments')
      .update({
        appointment_date: appointmentDateTime,
        notes,
        customer_id: customerId,
      })
      .eq('id', appointment.id)
      .eq('user_id', user.id)

    await supabase
      .from('appointment_horses')
      .delete()
      .eq('appointment_id', appointment.id)

    if (horseIds.length > 0) {
      const rows = horseIds.map((horseId) => ({
        appointment_id: appointment.id,
        horse_id: horseId,
        user_id: user.id,
      }))

      await supabase.from('appointment_horses').insert(rows)
    }

    router.push('/calendar')
    router.refresh()
  }

  return (
    <div className="rounded-[20px] border border-[#E5E2DC] bg-white p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label>Kunde</label>

          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              setHorseIds([])
            }}
            className="w-full border rounded-xl p-3"
          >
            <option value="">Kunde wählen</option>

            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Pferde</label>

          <div className="space-y-2">
            {filteredHorses.map((horse) => (
              <label key={horse.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={horseIds.includes(horse.id)}
                  onChange={() => toggleHorse(horse.id)}
                />

                {horse.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-xl p-3"
          />

          <TimePicker
            value={time}
            onChange={setTime}
            className="w-full rounded-xl border border-[#E5E2DC] p-3"
          />
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notiz"
          className="border rounded-xl p-3 w-full"
        />

        <button
          type="submit"
          className="w-full bg-[#0B1736] text-white rounded-xl p-4"
        >
          Termin speichern
        </button>
      </form>
    </div>
  )
}