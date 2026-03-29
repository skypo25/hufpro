'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useAppProfile } from '@/context/AppProfileContext'
import { legacyFlatFromHorseIntake, resolveClinicalForForm } from '@/lib/animals/clinicalIntakeTypes'
import ErstanamneseEditForm from '@/components/animals/ErstanamneseEditForm'

export default function MobileErstanamneseEdit({ horseId }: { horseId: string }) {
  const router = useRouter()
  const { profile, loading: profileLoading } = useAppProfile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clinical, setClinical] = useState<ReturnType<typeof resolveClinicalForForm> | null>(null)

  useEffect(() => {
    if (profileLoading) return
    if (profile.isHufbearbeiter) {
      router.replace(`/animals/${horseId}`)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setError('Nicht angemeldet.')
        setLoading(false)
        return
      }
      const { data: horse, error: qErr } = await supabase
        .from('horses')
        .select('id, name, intake, special_notes')
        .eq('id', horseId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (qErr || !horse) {
        setError(qErr?.message ?? 'Tier nicht gefunden.')
        setLoading(false)
        return
      }
      setClinical(resolveClinicalForForm(horse.intake, legacyFlatFromHorseIntake(horse)))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [horseId, profile.isHufbearbeiter, profileLoading, router])

  const viewHref = `/animals/${horseId}/erstanamnese`

  if (profileLoading || loading || (!clinical && !error)) {
    return (
      <>
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <Link href={viewHref} className="mobile-back" aria-label="Zurück">
            ‹
          </Link>
          <div className="mobile-greeting">Laden …</div>
        </header>
      </>
    )
  }

  if (error || !clinical) {
    return (
      <>
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <Link href={viewHref} className="mobile-back" aria-label="Zurück">
            ‹
          </Link>
          <div className="mobile-greeting">Fehler</div>
        </header>
        <div className="mobile-content px-4 py-6 text-[14px] text-red-700">{error ?? 'Fehler'}</div>
      </>
    )
  }

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <Link href={viewHref} className="mobile-back" aria-label="Zurück">
          ‹
        </Link>
        <div className="mobile-greeting">Erstanamnese bearbeiten</div>
      </header>
      <div className="mobile-content mobile-form-embed-root px-4 pb-28 pt-2">
        <ErstanamneseEditForm horseId={horseId} initialClinical={clinical} backHref={viewHref} />
      </div>
    </>
  )
}
