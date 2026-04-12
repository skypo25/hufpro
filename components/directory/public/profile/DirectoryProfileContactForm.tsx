'use client'

import { useCallback, useState } from 'react'

export function DirectoryProfileContactForm({
  slug,
  displayName,
  privacyInfoUrl,
}: {
  slug: string
  displayName: string
  privacyInfoUrl: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      if (!privacy) {
        setError('Bitte bestätigen Sie den Hinweis zur Datenverarbeitung.')
        return
      }
      const phoneTrim = phone.trim()
      if (phoneTrim.length < 4) {
        setError('Bitte geben Sie eine Telefonnummer an (mindestens 4 Zeichen).')
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch('/api/directory/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            name: name.trim(),
            email: email.trim(),
            phone: phoneTrim,
            message: message.trim(),
            privacyAccepted: true,
            website: honeypot,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          setError(data.error || 'Senden fehlgeschlagen.')
          return
        }
        setDone(true)
        setName('')
        setEmail('')
        setPhone('')
        setMessage('')
        setPrivacy(false)
      } catch {
        setError('Netzwerkfehler. Bitte später erneut versuchen.')
      } finally {
        setSubmitting(false)
      }
    },
    [slug, name, email, phone, message, privacy, honeypot]
  )

  if (done) {
    return (
      <div className="dir-prof-v2-contact-done dir-prof-v2-contact-done--premium" role="status">
        <span className="dir-prof-v2-contact-done-ic" aria-hidden>
          <i className="bi bi-check-lg" />
        </span>
        <div>
          <strong className="dir-prof-v2-contact-done-title">Nachricht übermittelt</strong>
          <p className="dir-prof-v2-contact-done-sub">
            <strong>{displayName}</strong> erhält Ihre Nachricht per E-Mail und kann Ihnen direkt antworten.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form className="dir-prof-v2-contact-form dir-prof-v2-contact-form--premium" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="dir-prof-v2-contact-err" role="alert">
          {error}
        </div>
      ) : null}
      <div className="dir-prof-v2-contact-field dir-prof-v2-contact-field--inset">
        <label htmlFor="dir-contact-name">Vor- und Nachname</label>
        <input
          id="dir-contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          placeholder=" "
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          className="dir-prof-v2-contact-input"
        />
      </div>
      <div className="dir-prof-v2-contact-field dir-prof-v2-contact-field--inset">
        <label htmlFor="dir-contact-email">E-Mail</label>
        <input
          id="dir-contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder=" "
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className="dir-prof-v2-contact-input"
        />
      </div>
      <div className="dir-prof-v2-contact-field dir-prof-v2-contact-field--inset">
        <label htmlFor="dir-contact-phone">Telefon</label>
        <input
          id="dir-contact-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          minLength={4}
          maxLength={40}
          placeholder=" "
          value={phone}
          onChange={(ev) => setPhone(ev.target.value)}
          className="dir-prof-v2-contact-input"
        />
      </div>
      <div className="dir-prof-v2-contact-field dir-prof-v2-contact-field--inset dir-prof-v2-contact-field--textarea">
        <label htmlFor="dir-contact-msg">Nachricht</label>
        <textarea
          id="dir-contact-msg"
          name="message"
          required
          minLength={1}
          maxLength={4000}
          rows={6}
          placeholder=" "
          value={message}
          onChange={(ev) => setMessage(ev.target.value)}
          className="dir-prof-v2-contact-textarea"
        />
      </div>
      {/* Honeypot — für Bots; nicht ausfüllen */}
      <div className="dir-prof-v2-hp" aria-hidden="true">
        <label htmlFor="dir-contact-website">Website</label>
        <input
          id="dir-contact-website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(ev) => setHoneypot(ev.target.value)}
        />
      </div>
      <div className="dir-prof-v2-contact-privacy">
        <div className="dir-prof-v2-contact-check">
          <input
            id="dir-contact-privacy"
            type="checkbox"
            checked={privacy}
            onChange={(ev) => setPrivacy(ev.target.checked)}
          />
          <label htmlFor="dir-contact-privacy">
            Ich willige ein, dass meine Angaben zur Bearbeitung der Anfrage an den Profilinhaber übermittelt werden.
            Hinweise zur Verarbeitung und zum Widerruf stehen in der{' '}
            <a href={privacyInfoUrl} target="_blank" rel="noopener noreferrer">
              Datenschutzerklärung
            </a>
            .
          </label>
        </div>
      </div>
      <div className="dir-prof-v2-contact-actions">
        <button type="submit" className="dir-prof-v2-contact-submit" disabled={submitting}>
          {submitting ? 'Wird gesendet…' : 'Nachricht senden'}
        </button>
      </div>
    </form>
  )
}
