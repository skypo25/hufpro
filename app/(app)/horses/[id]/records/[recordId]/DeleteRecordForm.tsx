'use client'

type DeleteRecordFormProps = {
  action: () => void
}

export default function DeleteRecordForm({ action }: DeleteRecordFormProps) {
  return (
    <form
      action={action}
      className="w-full"
      onSubmit={(e) => {
        const confirmed = window.confirm(
          'Willst du diese Hufdokumentation wirklich löschen? Alle zugehörigen Fotos werden ebenfalls entfernt.'
        )

        if (!confirmed) {
          e.preventDefault()
        }
      }}
    >
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FECACA] bg-white px-4 py-2.5 text-[13px] font-medium text-[#DC2626] transition hover:border-[#FCA5A5] hover:bg-[#FEF2F2]"
      >
        <i className="bi bi-trash text-[14px]" aria-hidden />
        Löschen
      </button>
    </form>
  )
}