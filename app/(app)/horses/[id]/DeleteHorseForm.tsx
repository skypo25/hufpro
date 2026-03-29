'use client'

type DeleteHorseFormProps = {
  action: () => void | Promise<void>
  label?: string
  confirmText?: string
  /** z. B. Footer neben Speichern — Standard ist kompakter Destructive-Button */
  className?: string
}

export default function DeleteHorseForm({
  action,
  label,
  confirmText,
  className,
}: DeleteHorseFormProps) {
  const btnClass =
    className ??
    'rounded-md bg-red-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800'

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          confirmText ??
            'Willst du dieses Tier wirklich löschen? Alle zugehörigen Dokumentationen und Fotos werden ebenfalls entfernt.',
        )

        if (!confirmed) {
          e.preventDefault()
        }
      }}
    >
      <button type="submit" className={btnClass}>
        {label ?? 'Tier löschen'}
      </button>
    </form>
  )
}
