export function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('email rate limit') || m.includes('rate limit exceeded'))
    return 'Zu viele Versuche. Bitte warte einige Minuten und versuche es erneut.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.'
  if (m.includes('invalid email')) return 'Bitte gib eine gültige E-Mail-Adresse ein.'
  if (m.includes('password') && m.includes('short'))
    return 'Das Passwort ist zu kurz. Mindestens 8 Zeichen erforderlich.'
  if (m.includes('weak password'))
    return 'Das Passwort ist zu schwach. Nutze Groß- und Kleinbuchstaben sowie Zahlen.'
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse.'
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'E-Mail oder Passwort falsch.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Netzwerkfehler. Bitte prüfe deine Internetverbindung.'
  return 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.'
}
