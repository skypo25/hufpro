# Verzeichnis: Premium (Top-Profil) — Galerie, Kontaktformular, DSGVO

Dieses Dokument beschreibt die technische und redaktionelle Vorbereitung. **Keine Rechtsberatung** — bitte von einer datenschutzrechtlich qualifizierten Stelle prüfen lassen.

## Produktlogik

- **Top-Profil / Premium** (aktives `directory_profile_top_entitlement`): öffentliche **Bildergalerie** und **Kontaktformular**.
- **Kostenfreies Profil**: **keine** Galerie, **kein** Kontaktformular; Logo, Texte, Social-Links, Karte, Telefon (falls gesetzt) bleiben nutzbar.

## Kontaktformular (Verarbeitung)

- **Zweck**: Anfragen von Besucher:innen zur Bearbeitung durch den Profilinhaber.
- **Empfänger**: die im Profil hinterlegte **`email_public`** (nur serverseitig, nicht in der öffentlichen View).
- **Versand**: AniDocs **System-SMTP** (`system_smtp`), analog zu anderen Systemmails (z. B. Datenexport, Claim-Entscheid).
- **Reply-To**: E-Mail der absendenden Person (direkter Antwortkanal zum Besucher).

## Datensparsamkeit & Speicher

Tabelle `directory_contact_inquiries` speichert nach erfolgreichem Versand u. a. Name, E-Mail, optionales Telefon, Nachricht, **gehashter** Client-IP-String (`ip_hash`), gekürzter User-Agent, Zeitstempel.

- **Keine Roh-IP** in der Datenbank.
- Optional: Umstellung auf **Löschung nach X Tagen** (z. B. 30) per geplantem Job (`DELETE … WHERE created_at < now() - interval '30 days'`).
- **Speicherbegrenzung**: zusätzlich **Rate Limits** (pro IP und pro Profil im Zeitfenster) in `lib/directory/contact/publicDirectoryContact.server.ts`.

## Spam-Schutz (ohne Drittanbieter)

1. **Honeypot-Feld** (versteckt, Name z. B. `website`) — nicht ausfüllen.
2. **Rate Limit** (Datenbank-Zählung im Rollfenster).
3. **Servervalidierung** (Längen, E-Mail-Format, Pflicht-Checkbox).

## Textbausteine (UI)

### Kurzhinweis am Formular (implementiert)

> Ihre Angaben werden zur Bearbeitung ausschließlich an **[Name]** (Profilinhaber:in) weitergeleitet — nicht öffentlich angezeigt.

### Checkbox / Einwilligung (implementiert, Kurzfassung)

> Ich willige ein, dass meine Angaben zur Beararbeitung der Anfrage an den Profilinhaber übermittelt werden. Hinweise zur Verarbeitung und Widerruf in der Datenschutzerklärung.

Link-Ziel: `NEXT_PUBLIC_ABOUT_URL` bzw. App-Hilfe (`directoryAboutUrl()`).

### Erweiterung für die öffentliche Datenschutzerklärung (Redaktion)

Ergänzende Absätze könnten u. a. enthalten:

- Verantwortliche Stelle für die **Verarbeitung durch AniDocs** beim Versand der E-Mail (Auftragsverarbeitung / Weiterleitung an Profilinhaber, je nach rechtlicher Einordnung).
- **Verantwortlicher für die Konversation** nach Zustellung: der Profilinhaber (eigenes Impressum / eigene DS-Beratung).
- Speicherdauer der Logzeilen bei AniDocs; Rechte Auskunft/Löschung (über AniDocs-Kontakt, soweit AniDocs noch Daten hat).

## Umgebungsvariablen

- **`DIRECTORY_CONTACT_IP_SALT`** (optional): statisches Salt für `ip_hash` (empfohlen in Produktion).

## Wartung

- Regelmäßig prüfen, ob System-SMTP in Admin → System hinterlegt ist; sonst schlagen Kontaktanfragen fehl (`503`).
