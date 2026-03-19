/**
 * KI-Textverbesserung: Vorhandenen Text nur sprachlich verbessern (keine inhaltlichen Änderungen).
 */

const IMPROVE_API = '/api/ai/improve-text'

/**
 * Sendet den Text an die API und gibt die sprachlich verbesserte Version zurück.
 */
export async function improveText(inputText: string, animalName?: string): Promise<string> {
  const res = await fetch(IMPROVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text: inputText, animalName: animalName?.trim() || undefined }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Textverbesserung fehlgeschlagen')
  }

  const data = (await res.json()) as { text?: string }
  return typeof data.text === 'string' ? data.text.trim() : ''
}
