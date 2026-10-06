/**
 * Lädt das Dokumentations-PDF per fetch und triggert den Browser-Download,
 * ohne die aktuelle Seite zu verlassen.
 */
export async function downloadRecordPdf(
  horseId: string,
  recordId: string
): Promise<void> {
  const res = await fetch(`/animals/${horseId}/records/${recordId}/pdf`)
  if (!res.ok) {
    throw new Error('PDF konnte nicht erstellt werden')
  }

  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  const match = cd?.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i)
  const filename = match?.[1]
    ? decodeURIComponent(match[1].replace(/['"]/g, '').trim())
    : 'Befundbericht.pdf'

  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Kurz verzögern, damit der Download starten kann
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
