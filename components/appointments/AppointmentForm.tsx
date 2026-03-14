'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHorse } from '@fortawesome/free-solid-svg-icons'
import { supabase } from '@/lib/supabase-client'
import CustomerPicker from './CustomerPicker'
import HorsePicker from './HorsePicker'
import AppointmentTypePicker from './AppointmentTypePicker'
import AppointmentSidebar from './AppointmentSidebar'
import TimePicker from '@/components/form/TimePicker'
import type { AppointmentFormProps } from './types'

function getSuggestedDuration(selectedHorseCount: number) {
  if (selectedHorseCount <= 1) return '45 Minuten'
  if (selectedHorseCount === 2) return '60 Minuten'
  if (selectedHorseCount === 3) return '90 Minuten'
  return '120 Minuten'
}

function durationLabelToMinutes(duration: string) {
  const map: Record<string, number> = {
    '30 Minuten': 30,
    '45 Minuten': 45,
    '60 Minuten': 60,
    '90 Minuten': 90,
    '120 Minuten': 120,
  }

  return map[duration] || 45
}

export default function AppointmentForm({
  mode,
  customers,
  horses,
  initialData,
  dayItems = [],
}: AppointmentFormProps) {
  const router = useRouter()

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialData.customerId)
  const [selectedHorseIds, setSelectedHorseIds] = useState<string[]>(initialData.selectedHorseIds)
  const [appointmentType, setAppointmentType] = useState(initialData.appointmentType)
  const [appointmentDate, setAppointmentDate] = useState(initialData.appointmentDate)
  const [appointmentTime, setAppointmentTime] = useState(initialData.appointmentTime)
  const [duration, setDuration] = useState(initialData.duration)
  const [notes, setNotes] = useState(initialData.notes)
  const [status, setStatus] = useState(initialData.status)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) || null

  const customerHorses = useMemo(() => {
    return horses.filter((horse) => horse.customer_id === selectedCustomerId)
  }, [horses, selectedCustomerId])

  const selectedHorses = useMemo(() => {
    return customerHorses.filter((horse) => selectedHorseIds.includes(horse.id))
  }, [customerHorses, selectedHorseIds])

  function handleSelectCustomer(customerId: string) {
    setSelectedCustomerId(customerId)
    setMessage('')

    const horsesForCustomer = horses.filter((horse) => horse.customer_id === customerId)

    if (horsesForCustomer.length === 1) {
      setSelectedHorseIds([horsesForCustomer[0].id])
      setDuration(getSuggestedDuration(1))
    } else {
      setSelectedHorseIds([])
      setDuration(getSuggestedDuration(0))
    }
  }

  function handleResetCustomer() {
    setSelectedCustomerId('')
    setSelectedHorseIds([])
    setCustomerSearch('')
    setDuration(getSuggestedDuration(0))
    setMessage('')
  }

  function handleToggleHorse(horseId: string) {
    setMessage('')

    setSelectedHorseIds((prev) => {
      const exists = prev.includes(horseId)
      const next = exists ? prev.filter((id) => id !== horseId) : [...prev, horseId]
      setDuration(getSuggestedDuration(next.length))
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!selectedCustomerId) {
      setMessage('Bitte wähle zuerst einen Kunden aus.')
      return
    }

    if (selectedHorseIds.length === 0) {
      setMessage('Bitte wähle mindestens ein Pferd aus.')
      return
    }

    if (!appointmentDate) {
      setMessage('Bitte wähle ein Datum aus.')
      return
    }

    if (!appointmentTime) {
      setMessage('Bitte wähle eine Uhrzeit aus.')
      return
    }

    setLoading(true)

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

    const appointmentDateTime = `${appointmentDate}T${appointmentTime}:00`
    const durationMinutes = durationLabelToMinutes(duration)
    let appointmentIdToNotify: string | null = null

    if (mode === 'create') {
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          customer_id: selectedCustomerId,
          appointment_date: appointmentDateTime,
          notes: notes || null,
          type: appointmentType,
          status,
          duration_minutes: durationMinutes,
          user_id: user.id,
        })
        .select('id')
        .single()

      if (appointmentError || !appointment) {
        setMessage(
          `Fehler beim Erstellen des Termins: ${appointmentError?.message || 'Unbekannter Fehler'}`
        )
        setLoading(false)
        return
      }

      const appointmentHorsePayload = selectedHorseIds.map((horseId) => ({
        appointment_id: appointment.id,
        horse_id: horseId,
        user_id: user.id,
      }))

      const { error: appointmentHorsesError } = await supabase
        .from('appointment_horses')
        .insert(appointmentHorsePayload)

      if (appointmentHorsesError) {
        await supabase.from('appointments').delete().eq('id', appointment.id)

        setMessage(
          `Fehler beim Verknüpfen der Pferde: ${appointmentHorsesError.message}`
        )
        setLoading(false)
        return
      }
      appointmentIdToNotify = appointment.id
    } else {
      if (!initialData.appointmentId) {
        setMessage('Die Termin-ID fehlt.')
        setLoading(false)
        return
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          customer_id: selectedCustomerId,
          appointment_date: appointmentDateTime,
          notes: notes || null,
          type: appointmentType,
          status,
          duration_minutes: durationMinutes,
        })
        .eq('id', initialData.appointmentId)
        .eq('user_id', user.id)

      if (updateError) {
        setMessage(`Fehler beim Aktualisieren des Termins: ${updateError.message}`)
        setLoading(false)
        return
      }

      const { error: deleteLinksError } = await supabase
        .from('appointment_horses')
        .delete()
        .eq('appointment_id', initialData.appointmentId)
        .eq('user_id', user.id)

      if (deleteLinksError) {
        setMessage(
          `Fehler beim Zurücksetzen der Pferde-Verknüpfungen: ${deleteLinksError.message}`
        )
        setLoading(false)
        return
      }

      const appointmentHorsePayload = selectedHorseIds.map((horseId) => ({
        appointment_id: initialData.appointmentId as string,
        horse_id: horseId,
        user_id: user.id,
      }))

      const { error: reinsertLinksError } = await supabase
        .from('appointment_horses')
        .insert(appointmentHorsePayload)

      if (reinsertLinksError) {
        setMessage(
          `Fehler beim Speichern der Pferde-Verknüpfungen: ${reinsertLinksError.message}`
        )
        setLoading(false)
        return
      }
      appointmentIdToNotify = initialData.appointmentId ?? null
    }

    const sendConfirmationEmail =
      status === 'Bestätigt' &&
      appointmentIdToNotify &&
      (mode === 'create' || initialData.status !== 'Bestätigt')
    if (sendConfirmationEmail) {
      try {
        const res = await fetch('/api/email/appointment-confirmed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: appointmentIdToNotify }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok && data.error) {
          setMessage(`Termin gespeichert. E-Mail an den Kunden konnte nicht versendet werden: ${data.error}`)
        }
      } catch {
        setMessage('Termin gespeichert. E-Mail-Benachrichtigung konnte nicht gesendet werden.')
      }
    }

    const sendProposedEmail =
      status === 'Vorgeschlagen' &&
      appointmentIdToNotify &&
      (mode === 'create' || initialData.status !== 'Vorgeschlagen')
    if (sendProposedEmail) {
      try {
        const res = await fetch('/api/email/appointment-proposed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: appointmentIdToNotify }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok && data.error) {
          setMessage(`Termin gespeichert. E-Mail mit Bestätigungs-Link konnte nicht versendet werden: ${data.error}`)
        }
      } catch {
        setMessage('Termin gespeichert. E-Mail mit Bestätigungs-Link konnte nicht gesendet werden.')
      }
    }

    router.push('/calendar')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-[1200px] grid-cols-1 gap-7 xl:grid-cols-[1fr_360px]"
    >
      <div className="space-y-6">
        <div className="huf-card">
          <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ef] text-[14px] text-[#154226]">
              <i className="bi bi-person-fill-check" />
            </div>
            <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">Kunde auswählen</h3>
          </div>
          <div className="p-6">
            <CustomerPicker
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              searchTerm={customerSearch}
              onSearchTermChange={setCustomerSearch}
              onSelectCustomer={handleSelectCustomer}
              onResetCustomer={handleResetCustomer}
            />
          </div>
        </div>

        <div className="huf-card">
          <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ef] text-[14px] text-[#154226]">
              <FontAwesomeIcon icon={faHorse} className="text-[14px]" />
            </div>
            <h3 className="dashboard-serif flex-1 text-[16px] text-[#1B1F23]">
              Pferde auswählen
            </h3>
            <span className="text-[11px] text-[#9CA3AF]">
              {customerHorses.length > 1 ? 'Mehrfachauswahl möglich' : ''}
            </span>
          </div>
          <div className="p-6">
            {selectedCustomerId ? (
              <HorsePicker
                horses={customerHorses}
                selectedHorseIds={selectedHorseIds}
                onToggleHorse={handleToggleHorse}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-[#E5E2DC] px-4 py-6 text-center text-[13px] text-[#6B7280]">
                Bitte zuerst einen Kunden auswählen.
              </div>
            )}
          </div>
        </div>

        <div className="huf-card">
          <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ef] text-[14px] text-[#154226]">
              <i className="bi bi-calendar2-heart-fill" />
            </div>
            <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">Terminart</h3>
          </div>
          <div className="p-6">
            <AppointmentTypePicker
              value={appointmentType}
              onChange={setAppointmentType}
            />
          </div>
        </div>

        <div className="huf-card">
          <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ef] text-[14px] text-[#154226]">
              <i className="bi bi-clock-fill" />
            </div>
            <h3 className="dashboard-serif text-[16px] text-[#1B1F23]">Datum & Uhrzeit</h3>
          </div>
          <div className="p-6">
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                  Datum
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E2DC] px-4 py-2.5 text-[14px] outline-none focus:border-[#154226]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                  Uhrzeit
                </label>
                <TimePicker
                  value={appointmentTime}
                  onChange={setAppointmentTime}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                  Geschätzte Dauer
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E2DC] px-4 py-2.5 text-[14px] outline-none focus:border-[#154226]"
                >
                  <option>30 Minuten</option>
                  <option>45 Minuten</option>
                  <option>60 Minuten</option>
                  <option>90 Minuten</option>
                  <option>120 Minuten</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="huf-card">
          <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ef] text-[14px] text-[#154226]">
              <i className="bi bi-chat-quote-fill" />
            </div>
            <h3 className="dashboard-serif flex-1 text-[16px] text-[#1B1F23]">
              Notizen
            </h3>
            <span className="text-[11px] text-[#9CA3AF]">Optional</span>
          </div>
          <div className="p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                  Termin-Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value as 'Bestätigt' | 'Vorgeschlagen' | 'Warteliste'
                    )
                  }
                  className="w-full rounded-lg border border-[#E5E2DC] px-4 py-2.5 text-[14px] outline-none focus:border-[#154226]"
                >
                  <option value="Bestätigt">Bestätigt</option>
                  <option value="Vorgeschlagen">Vorgeschlagen</option>
                  <option value="Warteliste">Warteliste</option>
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
                Notizen zum Termin
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[#E5E2DC] px-4 py-3 text-[14px] outline-none focus:border-[#154226]"
                placeholder="z. B. Bitte Scoot Boots mitbringen…"
              />
            </div>

            {message && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/calendar')}
            className="rounded-lg bg-transparent px-4 py-3 text-[14px] text-[#6B7280] hover:text-[#1B1F23]"
          >
            ← Abbrechen
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-lg border border-[#E5E2DC] bg-white px-6 py-3 text-[14px] font-medium text-[#1B1F23] hover:border-[#9CA3AF]"
            >
              Als Entwurf speichern
            </button>

            <button
              type="submit"
              disabled={loading}
              className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-8 py-3 text-[15px] font-medium text-white hover:bg-[#0f301b] disabled:opacity-60"
            >
              <i className="bi bi-check-lg text-[15px]" />
              {loading
                ? mode === 'edit'
                  ? 'Termin wird gespeichert...'
                  : 'Termin wird erstellt...'
                : mode === 'edit'
                  ? 'Termin speichern'
                  : 'Termin erstellen'}
            </button>
          </div>
        </div>
      </div>

      <AppointmentSidebar
        selectedCustomer={selectedCustomer}
        selectedHorses={selectedHorses}
        appointmentType={appointmentType}
        appointmentDate={appointmentDate}
        appointmentTime={appointmentTime}
        duration={duration}
        notes={notes}
        dayItems={dayItems}
      />
    </form>
  )
}