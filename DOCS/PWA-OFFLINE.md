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

## Entwürfe lokal speichern

Die Hooks `useOfflineDraft` und `useOnlineStatus` ermöglichen:

1. **Offline**: Formulardaten in IndexedDB speichern (`persist()`)
2. **Online**: Entwurf laden und an Server senden (manuell oder per Sync-Logik)

**Beispiel-Integration** (in `RecordCreateForm` oder `MobileRecordForm`):

```tsx
const { draft, persist, clear } = useOfflineDraft(horseId, recordId)
const isOnline = useOnlineStatus()

// Beim Ändern: wenn offline → persist(formData)
// Beim Absenden: wenn online → Server-Action; wenn offline → persist + Hinweis
// Nach erfolgreichem Sync → clear()
```

## Entwicklung

- **Dev**: Service Worker ist deaktiviert (`disable={process.env.NODE_ENV === 'development'}`)
- **Prod-Build**: `npm run build` – SW wird unter `/serwist/sw.js` bereitgestellt
- **Testen**: `npm run build && npm start`, dann in DevTools → Application → Service Workers
