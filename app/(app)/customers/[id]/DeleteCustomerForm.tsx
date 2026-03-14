'use client'

type DeleteCustomerFormProps = {
  action: () => void
}

export default function DeleteCustomerForm({ action }: DeleteCustomerFormProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          'Willst du diesen Kunden wirklich löschen? Alle zugehörigen Pferde, Hufdokumentationen und Fotos werden ebenfalls entfernt.'
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
        Kunde löschen
      </button>
    </form>
  )
}