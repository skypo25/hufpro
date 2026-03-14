import { notFound } from 'next/navigation'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import TerminConfirmForm from './TerminConfirmForm'

type Props = {
  params: Promise<{ token: string }>
}

export default async function TerminBestaetigenPage({ params }: Props) {
  const { token } = await params
  if (!token?.trim()) notFound()

  let appointment: {
    id: string
    date: string
    time: string
    type: string
    duration: string | null
    horseNames: string[]
    notes: string | null
  } | null = null
  let error: string | null = null

  try {
    const supabase = createSupabaseServiceRoleClient()
    const { data: row, error: appErr } = await supabase
      .from('appointments')
      .select('id, appointment_date, type, duration_minutes, notes, confirmation_token_expires_at, status')
      .eq('confirmation_token', token)
      .maybeSingle()

    if (appErr || !row) {
      error = 'Link ungültig oder abgelaufen.'
    } else if (row.confirmation_token_expires_at && new Date(row.confirmation_token_expires_at) < new Date()) {
      error = 'Der Bestätigungs-Link ist abgelaufen.'
    } else if (row.status !== 'Vorgeschlagen') {
      error = 'Dieser Termin wurde bereits bestätigt oder geändert.'
    }
    if (error) {
      // skip building appointment
    } else if (row) {

    const { data: links } = await supabase
      .from('appointment_horses')
      .select('horse_id')
      .eq('appointment_id', row.id)
    const horseIds = (links ?? []).map((r) => r.horse_id).filter(Boolean)
    let horseNames: string[] = []
    if (horseIds.length > 0) {
      const { data: horses } = await supabase
        .from('horses')
        .select('name')
        .in('id', horseIds)
      horseNames = (horses ?? []).map((h) => h.name?.trim() || 'Pferd').filter(Boolean)
    }

    const date = row.appointment_date
      ? new Intl.DateTimeFormat('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }).format(new Date(row.appointment_date))
      : '–'
    const time = row.appointment_date
      ? new Intl.DateTimeFormat('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(row.appointment_date))
      : '–'

    appointment = {
      id: row.id,
      date,
      time,
      type: (row.type ?? 'Termin').toString(),
      duration:
        row.duration_minutes != null ? `${row.duration_minutes} Min.` : null,
      horseNames,
      notes: row.notes?.trim() || null,
    }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    error = msg.includes('SUPABASE_SERVICE_ROLE_KEY')
      ? 'Konfiguration fehlt: SUPABASE_SERVICE_ROLE_KEY in .env.local eintragen (Supabase Dashboard → Project Settings → API → service_role).'
      : 'Konfiguration fehlt. Bitte wenden Sie sich an den Anbieter.'
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-8 shadow-sm">
        <h1 className="font-serif text-xl font-semibold text-[#1B1F23]">
          Terminbestätigung
        </h1>
        <p className="mt-4 text-[15px] text-[#6B7280]">{error}</p>
      </div>
    )
  }

  if (!appointment) notFound()

  return (
    <div className="rounded-2xl border border-[#E5E2DC] bg-white p-8 shadow-sm">
      <h1 className="font-serif text-xl font-semibold text-[#1B1F23]">
        Termin bestätigen
      </h1>
      <p className="mt-2 text-[14px] text-[#6B7280]">
        Bitte bestätigen Sie den folgenden Termin.
      </p>
      <dl className="mt-6 space-y-3 text-[15px]">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
            Datum
          </dt>
          <dd className="mt-0.5 font-medium text-[#1B1F23]">{appointment.date}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
            Uhrzeit
          </dt>
          <dd className="mt-0.5 font-medium text-[#1B1F23]">{appointment.time}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
            Art
          </dt>
          <dd className="mt-0.5 font-medium text-[#1B1F23]">{appointment.type}</dd>
        </div>
        {appointment.duration && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Dauer
            </dt>
            <dd className="mt-0.5 font-medium text-[#1B1F23]">
              {appointment.duration}
            </dd>
          </div>
        )}
        {appointment.horseNames.length > 0 && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Pferd(e)
            </dt>
            <dd className="mt-0.5 font-medium text-[#1B1F23]">
              {appointment.horseNames.join(', ')}
            </dd>
          </div>
        )}
        {appointment.notes && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Notizen
            </dt>
            <dd className="mt-0.5 text-[#1B1F23]">{appointment.notes}</dd>
          </div>
        )}
      </dl>
      <TerminConfirmForm token={token} />
    </div>
  )
}
