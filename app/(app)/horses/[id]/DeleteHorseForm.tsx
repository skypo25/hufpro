'use client'

type DeleteHorseFormProps = {
  action: () => void
}

export default function DeleteHorseForm({ action }: DeleteHorseFormProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          'Willst du dieses Pferd wirklich löschen? Alle Hufdokumentationen und Fotos dieses Pferdes werden ebenfalls entfernt.'
        )

        if (!confirmed) {
          e.preventDefault()
        }
      }}
    >
      <button
        type="submit"
        style={{
          backgroundColor: '#b91c1c',
          color: 'white',
          border: 'none',
          padding: '10px 14px',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Pferd löschen
      </button>
    </form>
  )
}