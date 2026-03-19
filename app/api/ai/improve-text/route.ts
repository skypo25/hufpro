import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * POST /api/ai/improve-text
 * Body: { text: string, animalName?: string }
 * Antwort: { text: string } – sprachlich verbessert; optional gegliedert, wenn Inhalte im Text erkennbar sind.
 * OPENAI_API_KEY in .env.local erforderlich.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY nicht konfiguriert. Bitte in .env.local eintragen.' },
      { status: 503 }
    )
  }

  let inputText: string
  let animalName: string | undefined
  try {
    const body = await request.json()
    inputText = typeof body.text === 'string' ? body.text : ''
    animalName =
      typeof body.animalName === 'string' ? body.animalName.trim() || undefined : undefined
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  if (!inputText.trim()) {
    return NextResponse.json({ error: 'Text fehlt' }, { status: 400 })
  }

  const systemPrompt = `Du verbesserst ausschließlich den vorgegebenen Text.
Du darfst NICHTS erfinden und keine neuen Informationen hinzufügen.
Du darfst den Text sprachlich verbessern und – nur wenn im Text eindeutig erkennbar – in wenige passende Abschnitte gliedern.

ERLAUBT:
- Grammatik korrigieren
- Satzbau verbessern
- Satzzeichen setzen
- Umgangssprache glätten
- Wiederholungen reduzieren
- Füllwörter entfernen
- Optional: Überschriften setzen (nur wenn Inhalte im Text erkennbar sind)

NICHT ERLAUBT:
- neue Informationen hinzufügen
- interpretieren, umdeuten oder fachlich ergänzen
- Dinge erfinden, die nicht gesagt wurden
- Überschriften erfinden, wenn der Inhalt nicht vorkommt
- Struktur wie „Befund / Maßnahme / Empfehlung“ (verboten)

WICHTIG:
- Verwende ausschließlich Inhalte aus dem Input.
- Wenn ein Tiername als Kontext gegeben ist, darfst du ihn passend verwenden – aber nur als sprachliche Formulierung, nicht als neue Information.
- Antworte ausschließlich mit dem finalen Text, ohne Meta-Kommentare.`

  const nameLine = animalName
    ? `Tiername (optional verwenden, falls passend): ${animalName}\n\n`
    : ''

  const userPrompt = `Verbessere ausschließlich die Sprache des folgenden Textes. Inhalt und Aussage müssen unverändert bleiben.

REGELN – erlaubt:
- Grammatik korrigieren
- Satzbau verbessern
- Satzzeichen setzen
- Umgangssprache leicht glätten
- Füllwörter entfernen
- Wiederholungen reduzieren

OPTIONALE GLIEDERUNG (nur wenn im Text erkennbar):
Wenn (und nur wenn) der Text entsprechende Inhalte enthält, darfst du passende Überschriften setzen – ausschließlich aus dieser Liste:
- Beobachtung
- Empfehlung
- Hinweis an den Besitzer
- Nächster Behandlungsintervall

Setze eine Überschrift nur, wenn der Inhalt im Text wirklich vorkommt. Andernfalls schreibe als Fließtext/Abschnitt ohne Überschriften.

REGELN – nicht erlaubt:
- Neue Informationen hinzufügen
- Inhalte interpretieren oder umdeuten
- Fachliche Ergänzungen machen
- Struktur wie „Befund / Maßnahme / Empfehlung“ erzeugen
- Dinge erfinden, die nicht im Text stehen

Ausgabeformat:
- Wenn Überschriften verwendet werden, dann:
  Überschrift:
  Text…
  (mit Leerzeile zwischen Abschnitten)
- Sonst: nur ein sauberer Absatz/Fließtext.

${nameLine}Text:
"${inputText}"

Antworte nur mit dem finalen Text.`

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
        temperature: 0.2,
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
      ''

    return NextResponse.json({ text })
  } catch (e) {
    console.error('Improve text error:', e)
    return NextResponse.json(
      { error: 'Textverbesserung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
