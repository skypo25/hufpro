# Offline PWA

## Bereits umgesetzt
- Offline-Basis mit Serwist
- Caching für App-Shell, statische Assets und besuchte Seiten
- Offline-Fallback-Seite
- Offline-Draft-Integration in `RecordCreateForm`
- Offline-Draft-Integration in `MobileRecordForm`
- Automatische lokale Speicherung in IndexedDB
- Wiederherstellung lokaler Entwürfe
- Offline-/Online-Statushinweise im Formular
- Offline-Speicherung von bis zu 4 komprimierten Fotos
- Speicherung von Markierungen und Annotationen

## Offen – hohe Priorität
- Offline-Unterstützung auch für den Edit-Modus bestehender Dokumentationen
- Prüfung eines sinnvollen manuellen oder teilautomatischen Sync-Konzepts
- Fehlerbehandlung beim späteren Hochladen lokaler Entwürfe weiter verbessern
- Bildhandling bei sehr großen Bildern robuster machen
- Verhalten bei Verbindungswechseln weiter testen

## Offen – später
- Entwurfsübersicht für lokal gespeicherte Dokumentationen
- Konfliktlogik zwischen lokalem Entwurf und Serverstand
- Später eventuell Blob-basierte statt Base64-basierter Bildspeicherung prüfen
- Weitere Optimierung für ältere Browser

## Bekannte Grenzen
- Edit-Modus aktuell noch nicht offlinefähig
- Kein vollautomatischer Sync nach Rückkehr der Verbindung
- Große Bilder können übersprungen werden
- Online-Funktionen wie Login, Supabase-Auth, API-Routen, PDF- und E-Mail-Versand bleiben onlineabhängig

## Notizen
- Ziel bleibt eine stabile, praxistaugliche Offline-Dokumentation ohne Regressionen in der bestehenden Online-Logik
