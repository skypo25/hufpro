'use client'

import { useFormStatus } from 'react-dom'

import { approveAdminDirectoryClaim, rejectAdminDirectoryClaim } from '@/lib/admin/directoryClaimsActions'

function SubmitButton(props: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={props.className}>
      {pending ? props.pendingLabel : props.label}
    </button>
  )
}

export function AdminClaimApproveForm(props: { claimId: string; disabled?: boolean }) {
  if (props.disabled) {
    return (
      <button type="button" disabled className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 text-[13px] font-semibold text-[#9CA3AF]">
        Annehmen
      </button>
    )
  }
  return (
    <form
      action={approveAdminDirectoryClaim}
      onSubmit={(e) => {
        if (
          !confirm(
            'Claim annehmen? Das Profil wird diesem Nutzer zugeordnet (claimed_by_user_id, claim_state = claimed).'
          )
        ) {
          e.preventDefault()
        }
      }}
      className="inline"
    >
      <input type="hidden" name="claimId" value={props.claimId} />
      <SubmitButton
        label="Annehmen"
        pendingLabel="Wird angenommen…"
        className="rounded-lg border border-[#15803d] bg-[#16a34a] px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#15803d] disabled:opacity-60"
      />
    </form>
  )
}

export function AdminClaimRejectForm(props: { claimId: string; disabled?: boolean }) {
  if (props.disabled) {
    return null
  }
  return (
    <form
      action={rejectAdminDirectoryClaim}
      onSubmit={(e) => {
        if (!confirm('Claim wirklich ablehnen?')) {
          e.preventDefault()
        }
      }}
      className="space-y-3"
    >
      <input type="hidden" name="claimId" value={props.claimId} />
      <div>
        <label
          htmlFor={`rejection_reason_${props.claimId}`}
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]"
        >
          Ablehnungsgrund (optional)
        </label>
        <textarea
          id={`rejection_reason_${props.claimId}`}
          name="rejection_reason"
          rows={3}
          maxLength={4000}
          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#1B1F23] outline-none focus:border-[#DC2626]"
          placeholder="Kurz für interne Nachvollziehbarkeit…"
        />
      </div>
      <SubmitButton
        label="Ablehnen"
        pendingLabel="Wird abgelehnt…"
        className="rounded-lg border border-[#DC2626] bg-white px-4 py-2 text-[13px] font-semibold text-[#DC2626] shadow-sm hover:bg-[#FEF2F2] disabled:opacity-60"
      />
    </form>
  )
}
