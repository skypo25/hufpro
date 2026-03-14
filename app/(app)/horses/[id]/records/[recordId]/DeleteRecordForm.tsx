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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        <i className="bi bi-trash"></i>
        Dokumentation löschen
      </button>
    </form>
  )
}