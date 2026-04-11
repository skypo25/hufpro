'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { submitDirectoryClaim } from '@/lib/directory/claims/actions'
import { initialClaimFormState } from '@/lib/directory/claims/formState'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="dir-prof-btn dir-prof-btn--accent mt-4 w-full max-w-md justify-center" disabled={pending}>
      {pending ? 'Wird gesendet…' : 'Antrag absenden'}
    </button>
  )
}

export function DirectoryClaimForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState(submitDirectoryClaim, initialClaimFormState)

  return (
    <form action={formAction} className="dir-prof-card-body space-y-4 p-0">
      <input type="hidden" name="slug" value={slug} />
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="claim-display-name" className="mb-1 block text-sm font-medium text-[var(--dir-text-secondary)]">
          Name
        </label>
        <input
          id="claim-display-name"
          name="display_name"
          type="text"
          required
          autoComplete="name"
          className="w-full max-w-md rounded-[var(--dir-radius-sm)] border border-[var(--dir-border)] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="claim-email" className="mb-1 block text-sm font-medium text-[var(--dir-text-secondary)]">
          E-Mail
        </label>
        <input
          id="claim-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full max-w-md rounded-[var(--dir-radius-sm)] border border-[var(--dir-border)] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="claim-message" className="mb-1 block text-sm font-medium text-[var(--dir-text-secondary)]">
          Nachricht
        </label>
        <textarea
          id="claim-message"
          name="message"
          required
          rows={5}
          className="w-full max-w-lg rounded-[var(--dir-radius-sm)] border border-[var(--dir-border)] px-3 py-2 text-sm"
          placeholder="Kurz begründen, warum dieses Profil zu Ihnen gehört …"
        />
      </div>
      <div>
        <label htmlFor="claim-proof" className="mb-1 block text-sm font-medium text-[var(--dir-text-secondary)]">
          Link zum Nachweis (optional)
        </label>
        <input
          id="claim-proof"
          name="proof_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          className="w-full max-w-md rounded-[var(--dir-radius-sm)] border border-[var(--dir-border)] px-3 py-2 text-sm"
        />
      </div>
      <SubmitButton />
    </form>
  )
}
