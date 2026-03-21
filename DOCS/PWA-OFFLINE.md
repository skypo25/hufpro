# PWA Offline-Support

## Übersicht

Die App nutzt **Serwist** (Turbopack) für produktionsreifen Offline-Support. Der Service Worker wird unter `/serwist/sw.js` bereitgestellt.

## Was offline funktioniert

| Bereich | Verhalten |
|--------|-----------|
| **App-Shell** | HTML, CSS, JS, Fonts werden gecacht |
| **Statische Assets** | `/_next/static/*`, Icons, Bilder (Cache-First) |
| **Besuchte Seiten** | Dashboard, Dokumentationen etc. werden beim Besuch gecacht und sind offline verfügbar |
| **Navigation** | Bei unbekannten Routen offline → Fallback-Seite `/~offline` |
| **Entwürfe** | `lib/offline-drafts.ts` + `hooks/useOfflineDraft.ts` – lokale Speicherung in IndexedDB |

## Was online bleiben muss

- **Supabase-Auth** (Login, Session)
- **Supabase-Daten** (Kunden, Pferde, Termine, Dokumentationen)
- **API-Routen** (E-Mail, PDF-Generierung)
- **Neue Daten laden** (z. B. neue Termine, Kundenliste)

## Architektur

- **SerwistProvider** (`app/serwist-provider.tsx`): Registriert den SW, cached beim Navigieren
- **Service Worker** (`app/sw.ts`): Precaching, Runtime-Caching, Offline-Fallback
- **Route** `app/serwist/[path]/route.ts`: Liefert den kompilierten SW
- **Offline-Seite** `app/~offline/page.tsx`: Zeigt „Keine Internetverbindung“ mit Reload-Button

## Entwürfe lokal speichern (Dokumentation)

**Integriert in:** `RecordCreateForm` (Desktop) und `MobileRecordForm` (Mobile/PWA)

### Ablauf

1. **Automatisches Speichern:** Formulardaten werden alle 1,5 Sekunden (debounced) in IndexedDB gespeichert.
2. **Offline:** Beim Klick auf „Speichern“ wird der Entwurf lokal gespeichert. Hinweis: „Entwurf lokal gespeichert. Wird synchronisiert, sobald du wieder online bist.“
3. **Online:** Beim Speichern wird an den Server gesendet. Nach Erfolg wird der lokale Entwurf gelöscht.
4. **Wiederherstellung:** Beim erneuten Öffnen der Dokumentationsseite wird ein vorhandener Entwurf automatisch geladen.

### Bilder

- **Offline:** Fotos werden komprimiert (max. 1200px, JPEG 75%) und als Base64 in IndexedDB gespeichert (max. 4 Fotos, ~800KB pro Foto).
- **Hinweis im Formular:** „Offline: Fotos werden lokal gespeichert und beim nächsten Sync hochgeladen.“
- **Grenzen:** Sehr große Bilder können übersprungen werden. Vollständiger Offline-Bildupload ist vorbereitet; bei älteren Browsern ohne `createImageBitmap`/`OffscreenCanvas` wird kein Foto gespeichert.

## Entwicklung

- **Dev**: Service Worker ist deaktiviert (`disable={process.env.NODE_ENV === 'development'}`)
- **Prod-Build**: `npm run build` – SW wird unter `/serwist/sw.js` bereitgestellt
- **Testen**: `npm run build && npm start`, dann in DevTools → Application → Service Workers
