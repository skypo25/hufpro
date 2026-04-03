export const CUSTOMER_EXPORT_README = `AniDocs – Datenexport
========================

Dieses ZIP enthält Ihre Daten in einer für Sie lesbaren Form sowie einen separaten
technischen Bereich für Support, Import oder Migration.

Ordnerübersicht
---------------

01_Liesmich
  Diese Datei und ggf. weitere Hinweise.

02_Kunden
  Kunden.csv – Stammdaten Ihrer Kund:innen (lesbare Spalten, deutsche Überschriften).

03_Tiere
  Tiere.csv – Tierstammdaten mit Bezug zum Kunden.

04_Termine
  Termine.csv – Terminliste mit Datum, Uhrzeit, Kunde, Tieren und Status.

05_Dokumentationen
  Dokumentationen.csv – Übersicht aller Dokumentationen (Spalten „Zusammenfassung“/„Empfehlung“ als Klartext).
  HTML/ – pro Eintrag eine HTML-Datei, inhaltlich am Befund-PDF orientiert (Kopf, Infos, Hufbefund,
  Maßnahmen, Fotos Solar/Lateral; Bilder verlinken relativ auf 06_Fotos/Bilder/ — ZIP entpacken).

06_Fotos
  Fotos.csv – Zuordnung der exportierten Bilder.
  Bilder/ – Fotodateien mit verständlichen Dateinamen.

07_Rechnungen
  Rechnungen.csv und Rechnungspositionen.csv – Rechnungsdaten in Klartext.
  PDFs/ – Rechnungs-PDFs (wie in der App), sofern vorhanden.

99_Technischer_Rohdatenexport
  Rohdaten (JSON/CSV) mit technischen Feldnamen und internen IDs – nur für technische
  Zwecke gedacht, nicht für die normale Nutzung. Die Hauptdateien in den Ordnern 02–07
  sind für Sie aufbereitet.

Hinweise
--------
- CSV-Dateien sind UTF-8 (mit BOM) und mit Semikolon getrennt – für Excel unter Windows geeignet.
- Leere Felder sind bewusst leer (kein „null“-Text).
- Rechtliche Aufbewahrung (z. B. GoBD) liegt in Ihrer Verantwortung.

`
