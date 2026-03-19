import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type TherapyType = 'huf' | 'physio' | 'osteo' | 'heilpraktiker'

const THERAPY_LABELS: Record<TherapyType, string> = {
  huf: 'Hufbearbeitung',
  physio: 'Tierphysiotherapie',
  osteo: 'Osteopathie',
  heilpraktiker: 'Tierheilpraktik',
}

/**
 * POST /api/ai/format-documentation
 * Body: { rawText: string, therapyType: "huf" | "physio" | "osteo" | "heilpraktiker" }
 *
 * API-Key: OPENAI_API_KEY in .env.local eintragen.
 * Optional: Andere kompatible Chat-API (z. B. Azure OpenAI, OpenRouter) durch Anpassung von buildMessages + fetch ersetzbar.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rawText: string
  let therapyType: TherapyType
  let animalName: string | undefined
  try {
    const body = await request.json()
    rawText = typeof body.rawText === 'string' ? body.rawText : ''
    therapyType = ['huf', 'physio', 'osteo', 'heilpraktiker'].includes(body.therapyType)
      ? body.therapyType
      : 'huf'
    animalName = typeof body.animalName === 'string' ? body.animalName.trim() || undefined : undefined
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY nicht konfiguriert. Bitte in .env.local eintragen.' },
      { status: 503 }
    )
  }

  const systemPrompt = `Du formulierst ausschließlich gesprochenen Text in korrektes, gut lesbares Deutsch um.
Du fügst KEINE eigenen Inhalte hinzu, erfindest NICHTS und strukturierst NICHT in Befund/Maßnahme/Empfehlung.
Du darfst nur: Grammatik korrigieren, Satzbau verbessern, Umgangssprache glätten, Füllwörter entfernen, Satzzeichen setzen.
Das Ergebnis ist nur eine sprachlich bereinigte Version des gesprochenen Textes – keine fachlichen Ergänzungen, keine Interpretation.`

  const animalLine = animalName
    ? `Tiername (wenn im Inhalt erwähnt, so verwenden): ${animalName}\n\n`
    : ''

  const userPrompt = `Kontext: ${THERAPY_LABELS[therapyType]}
${animalLine}Gesprochener Text (nur sprachlich bereinigen, Inhalt unverändert lassen):
"${rawText}"

---

AUFGABE:
Schreibe den obigen Text in korrektes, lesbares Deutsch um.

ERLAUBT NUR:
- Grammatik korrigieren
- Satzbau verbessern
- Umgangssprache glätten
- Füllwörter entfernen
- Satzzeichen sinnvoll setzen

NICHT ERLAUBT:
- Neue Informationen ergänzen
- Inhalte umdeuten oder strukturieren (kein "Befund:", "Maßnahme:", "Empfehlung:")
- Fachinhalte ergänzen, die nicht im Text stehen
- Halluzinieren

Antworte nur mit der bereinigten Textversion, ohne Überschriften oder Gliederung.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } }).error?.message ?? response.statusText
      return NextResponse.json(
        { error: `KI-Anfrage fehlgeschlagen: ${msg}` },
        { status: 502 }
      )
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text =
      data.choices?.[0]?.message?.content?.trim() ??
      'Keine Ausgabe erhalten.'

    return NextResponse.json({ text })
  } catch (e) {
    console.error('Format documentation error:', e)
    return NextResponse.json(
      { error: 'KI-Verarbeitung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
