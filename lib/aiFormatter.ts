/**
 * KI-Formatierung: Roher Befund-Text wird in strukturierte Therapie-Dokumentation umgewandelt.
 * Ruft Backend-Route auf (OpenAI/Compatible-API).
 */

export type TherapyType = 'huf' | 'physio' | 'osteo' | 'heilpraktiker'

const FORMAT_API = '/api/ai/format-documentation'

/**
 * Formatiert gesprochenen Befund zu professioneller Dokumentation.
 * @param rawText - Rohtext aus Spracherkennung
 * @param therapyType - Behandlungsart für Anpassung der Sprache
 * @param animalName - Name des Tieres (z. B. Pferdename), damit die KI „der Huf von Maja“ statt „der Huf des Tieres“ formuliert
 */
export async function formatTherapyDocumentation(
  rawText: string,
  therapyType: TherapyType,
  animalName?: string
): Promise<string> {
  const res = await fetch(FORMAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ rawText, therapyType, animalName: animalName?.trim() || undefined }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'KI-Verarbeitung fehlgeschlagen')
  }

  const data = (await res.json()) as { text?: string }
  return typeof data.text === 'string' ? data.text.trim() : ''
}
