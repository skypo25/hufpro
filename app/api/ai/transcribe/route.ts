import { NextResponse } from 'next/server'
import { isAdminUserId } from '@/lib/admin/config'
import { userHasFeature } from '@/lib/admin/featureFlags'
import { requireAppAccess } from '@/lib/billing/requireAppAccess'

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions'

/**
 * POST /api/ai/transcribe
 * Body: multipart/form-data mit Feld "audio" (Blob/File, z. B. audio/webm).
 * Nutzt OpenAI Whisper (Speech-to-Text). OPENAI_API_KEY in .env.local erforderlich.
 * @see https://platform.openai.com/docs/api-reference/audio/createTranscription
 */
export async function POST(request: Request) {
  const gate = await requireAppAccess({ mode: 'write' })
  if (!gate.ok) return gate.response

  if (!isAdminUserId(gate.userId) && !(await userHasFeature(gate.userId, 'ai_assistant'))) {
    return NextResponse.json(
      { error: 'KI-Assistent ist für diesen Account deaktiviert.' },
      { status: 403 }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY nicht konfiguriert. Bitte in .env.local eintragen.' },
      { status: 503 }
    )
  }

  let text: string
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Audio fehlt' }, { status: 400 })
    }

    const openAiBody = new FormData()
    openAiBody.append('file', audio, 'audio.webm')
    openAiBody.append('model', 'whisper-1')
    openAiBody.append('language', 'de')
    openAiBody.append('response_format', 'json')

    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiBody,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } }).error?.message ?? response.statusText
      console.error('OpenAI transcription failed:', msg)
      // Keine Key-/Provider-Details an Clients leaken
      const clientMsg = /api key|incorrect|invalid/i.test(msg)
        ? 'Spracherkennung ist serverseitig nicht konfiguriert. Bitte OPENAI_API_KEY prüfen.'
        : 'Spracherkennung fehlgeschlagen. Bitte erneut versuchen.'
      return NextResponse.json({ error: clientMsg }, { status: 502 })
    }

    const data = (await response.json()) as { text?: string }
    text = typeof data.text === 'string' ? data.text.trim() : ''
  } catch (e) {
    console.error('Transcribe error:', e)
    return NextResponse.json(
      { error: 'Spracherkennung fehlgeschlagen' },
      { status: 500 }
    )
  }

  return NextResponse.json({ text })
}
