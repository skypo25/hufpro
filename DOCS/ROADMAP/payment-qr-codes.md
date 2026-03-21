# Zahlungs QR Codes auf Rechnungen

## Ziel
- Auf Rechnungen sollen später zwei QR-Codes möglich sein:
  1. SEPA / GiroCode für Banküberweisung
  2. PayPal QR-Code oder PayPal-Zahlungslink als QR-Code

## Nutzen
- Kunden können Rechnungen schneller bezahlen
- Weniger Übertragungsfehler bei IBAN, Betrag und Verwendungszweck
- Moderner und professioneller Rechnungsprozess

## Geplanter Funktionsumfang
- QR-Code für klassische Überweisung mit Empfänger, IBAN, BIC, Betrag und Verwendungszweck
- QR-Code für PayPal-Zahlung mit direkter Weiterleitung zur Zahlung
- Optionale Aktivierung in den Rechnungseinstellungen
- Darstellung der QR-Codes in der PDF-Rechnung

## Offene Fragen
- Soll PayPal über festen Payment-Link oder über PayPal-Invoicing gelöst werden?
- Welche Rechnungsdaten müssen pro QR-Code dynamisch erzeugt werden?
- Sollen ein oder beide QR-Codes optional einblendbar sein?
- Wo werden Bankdaten und PayPal-Konfiguration in den Einstellungen gepflegt?
- Wie sollen Gebühren, Teilzahlungen oder abweichende Beträge behandelt werden?

## Technische To-dos
- Datenmodell für Zahlungsinformationen definieren
- QR-Code-Generierung für SEPA/GiroCode prüfen und umsetzen
- PayPal-Link-Strategie festlegen
- Einbindung in PDF-Rechnungsdokument planen
- UI für Einstellungen vorbereiten
- Testfälle für Banking-Apps und PayPal-Zahlung definieren

## Hinweis
- Diese Datei ist zunächst nur eine Roadmap und noch keine Umsetzungsanweisung
