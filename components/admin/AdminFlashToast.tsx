'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useToast } from '@/context/ToastContext'

const SAVED_MESSAGES: Record<string, string> = {
  flag: 'Feature-Flag aktualisiert.',
  note: 'Notiz gespeichert.',
  trial: 'Trial verlängert.',
  trial_end: 'Trial beendet.',
  trial_end_db: 'Trial nur in der Datenbank beendet (keine Stripe-Subscription).',
  ban: 'Account deaktiviert.',
  unban: 'Account wieder aktiviert.',
  password_reset: 'Passwort-Reset-E-Mail wurde gesendet.',
  billing_cancel_period: 'Abo wird zum Periodenende gekündigt.',
  billing_cancel_now: 'Abo wurde sofort gekündigt.',
  billing_reactivate: 'Periodenend-Kündigung widerrufen.',
  billing_comp: 'Comp-/Grace-Zugang verlängert.',
}

const ERR_MESSAGES: Record<string, string> = {
  flag: 'Feature-Flag konnte nicht gespeichert werden.',
  note: 'Notiz konnte nicht gespeichert werden.',
  trial: 'Trial konnte nicht aktualisiert werden.',
  ban: 'Account konnte nicht geändert werden.',
  delete: 'Account konnte nicht gelöscht werden.',
  impersonate: 'Support-Ansicht konnte nicht gestartet werden.',
  password_reset: 'Passwort-Reset konnte nicht gesendet werden.',
  billing: 'Billing-Aktion fehlgeschlagen.',
}

/** Zeigt nach Redirect (?saved= / ?err=) denselben Toast wie in der Behandler-App. */
export default function AdminFlashToast({
  saved,
  err,
  msg,
}: {
  saved?: string | null
  err?: string | null
  msg?: string | null
}) {
  const { showToast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    if (!saved && !err) return
    done.current = true

    // Ausführlicher Hinweis bleibt als Banner — kein Toast nötig.
    if (saved === 'trial_end_db') return

    if (saved) {
      showToast(SAVED_MESSAGES[saved] ?? 'Aktualisierung durchgeführt.', 'success')
    } else if (err) {
      const base = ERR_MESSAGES[err] ?? 'Aktion fehlgeschlagen.'
      showToast(msg ? `${base} ${msg}` : base, 'error')
    }

    router.replace(pathname, { scroll: false })
  }, [saved, err, msg, showToast, router, pathname])

  return null
}
