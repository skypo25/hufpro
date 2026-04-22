import Link from 'next/link'

export const metadata = {
  title: 'AGB',
  description: 'Allgemeine Geschäftsbedingungen von AniDocs',
}

export default function AgbPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px', fontFamily: 'var(--font-dm-sans)', fontSize: 15, lineHeight: 1.6, color: '#374151' }}>
      <h1 style={{ fontFamily: 'var(--font-outfit)', fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 24 }}>
        Allgemeine Geschäftsbedingungen (AGB)
      </h1>

      <p><strong>Anbieter:</strong> [Name und Anschrift hier ergänzen]</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>§ 1 Geltungsbereich</h2>
      <p>Diese AGB gelten für die Nutzung von AniDocs („Anwendung“). Mit der Registrierung akzeptieren Sie diese AGB.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>§ 2 Leistungsumfang</h2>
      <p>Die Anwendung bietet Funktionen zur Kundeverwaltung, Terminplanung, Dokumentation und Rechnungserstellung für Hufbearbeiter. Der genaue Leistungsumfang ergibt sich aus der jeweiligen Produktbeschreibung.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>§ 3 Registrierung und Konto</h2>
      <p>Zur Nutzung ist eine Registrierung mit E-Mail und Passwort erforderlich. Sie verpflichten sich, wahrheitsgemäße Angaben zu machen und Ihre Zugangsdaten vertraulich zu halten.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>§ 4 Nutzungsrechte</h2>
      <p>Ihnen wird ein nicht ausschließliches, zeitlich begrenztes Recht zur Nutzung der Anwendung im Rahmen des gebuchten Tarifs eingeräumt.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>§ 5 Haftung</h2>
      <p>Es gilt die gesetzliche Haftung. Schadensersatzansprüche sind ausgeschlossen, soweit nicht Vorsatz oder grobe Fahrlässigkeit vorliegen. Die Haftung für entgangenen Gewinn ist ausgeschlossen.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>§ 6 Kündigung</h2>
      <p>Sie können Ihr Konto jederzeit in den Einstellungen löschen. Der Anbieter kann die Nutzung bei Verstößen gegen diese AGB mit sofortiger Wirkung sperren.</p>

      <p style={{ marginTop: 32, fontSize: 13, color: '#6b7280' }}>
        Stand: März 2025. Bitte ergänzen Sie die Platzhalter [Name, Anschrift] mit Ihren tatsächlichen Angaben vor Veröffentlichung.
      </p>

      <p style={{ marginTop: 24 }}>
        <Link href="/login" style={{ color: '#006d6d', fontWeight: 500 }}>← Zurück zur Anmeldung</Link>
      </p>
    </div>
  )
}
