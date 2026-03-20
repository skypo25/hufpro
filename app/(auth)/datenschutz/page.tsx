import Link from 'next/link'

export const metadata = {
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung von AniDocs',
}

export default function DatenschutzPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px', fontFamily: 'var(--font-dm-sans)', fontSize: 15, lineHeight: 1.6, color: '#374151' }}>
      <h1 style={{ fontFamily: 'var(--font-outfit)', fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 24 }}>
        Datenschutzerklärung
      </h1>

      <p><strong>Verantwortlicher:</strong> [Name und Anschrift des Verantwortlichen hier ergänzen]</p>
      <p><strong>Kontakt:</strong> [E-Mail des Verantwortlichen hier ergänzen]</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>1. Erhebung und Speicherung personenbezogener Daten</h2>
      <p>Beim Besuch dieser Anwendung werden automatisch Informationen (z. B. IP-Adresse, Browser-Typ, aufgerufene Seiten) erhoben. Zur Nutzung der App sind Registrierung und Anmeldung erforderlich. Dabei speichern wir E-Mail, Name sowie Ihre Betriebs- und Kundendaten.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>2. Zweck der Verarbeitung</h2>
      <p>Die Daten dienen der Bereitstellung von AniDocs: Kundeverwaltung, Terminplanung, Dokumentation und Rechnungserstellung.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>3. Rechtsgrundlage</h2>
      <p>Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und Art. 6 Abs. 1 lit. a DSGVO (Einwilligung bei Registrierung).</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>4. Drittanbieter</h2>
      <p>Wir nutzen Supabase (Hosting, Datenbank, Auth) und ggf. OpenAI für KI-Funktionen (Spracherkennung, Textverbesserung). Bei OpenAI erfolgt eine Übermittlung in die USA. Rechtsgrundlage: Standardvertragsklauseln.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>5. Ihre Rechte</h2>
      <p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Sie können sich bei einer Aufsichtsbehörde beschweren.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 28, marginBottom: 8 }}>6. Cookies</h2>
      <p>Wir verwenden technisch notwendige Cookies (z. B. für die Anmeldung) sowie Cookies von Supabase. Diese sind für den Betrieb der App erforderlich.</p>

      <p style={{ marginTop: 32, fontSize: 13, color: '#6b7280' }}>
        Stand: März 2025. Bitte ergänzen Sie die Platzhalter [Name, Anschrift, E-Mail] mit Ihren tatsächlichen Angaben vor Veröffentlichung.
      </p>

      <p style={{ marginTop: 24 }}>
        <Link href="/login" style={{ color: '#52b788', fontWeight: 500 }}>← Zurück zur Anmeldung</Link>
      </p>
    </div>
  )
}
