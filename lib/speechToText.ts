/**
 * Speech-to-Text: wandelt Audio (z. B. von VoiceRecorder) in Text um.
 *
 * Ersetzbar durch:
 * - Whisper API: Client sendet Blob an POST /api/ai/transcribe,
 *   Backend ruft OpenAI Whisper auf und gibt Transkript zurück.
 * - Andere STT-Dienste: gleiche Schnittstelle beibehalten.
 */

const TRANSCRIBE_API = '/api/ai/transcribe'

/**
 * Konvertiert ein Audio-Blob in Text.
 * Aktuell: Ruft Backend-API auf (Mock oder Whisper).
 * Später: API-Route mit Whisper implementieren, hier nichts ändern.
 */
export async function speechToText(audio: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('audio', audio, 'recording.webm')

  const res = await fetch(TRANSCRIBE_API, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Spracherkennung fehlgeschlagen')
  }

  const data = (await res.json()) as { text?: string }
  return typeof data.text === 'string' ? data.text.trim() : ''
}
