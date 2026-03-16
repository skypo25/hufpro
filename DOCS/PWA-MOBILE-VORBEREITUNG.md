# PWA & Mobile – Vorbereitung

## Erledigt

- **PWA:** `public/manifest.json` (Name, Start-URL, Theme-Farbe, Icon-Pfade), Theme-Color im Root-Layout, minimaler Service Worker `public/sw.js` mit Registrierung.
- **Mobile-Umschaltung:** Unter 768px wird die **Mobile-Ansicht** gezeigt, ab 768px unverändert die **Desktop-Ansicht** (Sidebar + bestehender Inhalt).
- **Mobile-Shell:** `components/mobile/MobileShell.tsx` – Bottom-Navigation (Start, Termine, Pferde, Kunden, Mehr) und Bereich für dein Header-/Seiten-Layout.
- **Routen-Map:** `components/mobile/mobileRouteMap.tsx` – hier werden pro Route die Mobile-Seiten eingetragen. Aktuell liefern alle Routen einen Platzhalter („Mobile-Ansicht folgt“).

## Was du noch machen musst

### 1. PWA-Icons (optional, für „Zum Startbildschirm hinzufügen“)

- Leg zwei Icons in **`public/icons/`** ab:
  - `icon-192.png` (192×192 px)
  - `icon-512.png` (512×512 px)
- Ohne Icons ist die App trotzdem nutzbar; einige Browser zeigen dann kein eigenes Icon beim Installieren.

### 2. Mobile-Seiten (Layout von dir)

- Du lieferst das Layout (z. B. als HTML/Struktur), wir bauen es in React um.
- **Pro Seite:** In `components/mobile/mobileRouteMap.tsx` die entsprechende Route auf die neue Komponente umstellen, z. B.:
  - `/dashboard` → `MobileDashboard` (mit deinem Header „Hallo, Jessica“, Kennzahlen, Kacheln, FAB usw.)
  - `/calendar` → `MobileCalendar`
  - usw.
- **Header:** In `MobileShell` ist oben ein leerer `<header>` vorgesehen. Das konkrete Header-Layout (Begrüßung, Suche, Benachrichtigungen) kann pro Seite unterschiedlich sein und kommt in die jeweilige Mobile-Seiten-Komponente (z. B. oben in `MobileDashboard`).

## Dateien im Überblick

| Datei | Zweck |
|-------|--------|
| `public/manifest.json` | PWA-Metadaten, Start-URL, Icons, Theme |
| `public/sw.js` | Service Worker (für Installation) |
| `app/layout.tsx` | Manifest-Link, Theme-Color, SW-Registrierung |
| `components/RegisterSw.tsx` | Registriert den Service Worker im Browser |
| `components/mobile/useIsMobile.ts` | Hook: `true` wenn Viewport &lt; 768px |
| `components/mobile/MobileShell.tsx` | Bottom-Nav + Platz für dein Layout |
| `components/mobile/mobileRouteMap.tsx` | Route → Mobile-Komponente (hier Platzhalter ersetzen) |
| `components/mobile/MobilePlaceholder.tsx` | „Mobile-Ansicht folgt“ für noch nicht umgesetzte Seiten |
| `components/AppLayoutClient.tsx` | Schaltet zwischen Desktop (Sidebar + Inhalt) und Mobile (Shell + Inhalt aus Routen-Map) |

Wir machen es Seite für Seite: Sobald du das Layout für eine Seite lieferst, bauen wir die Komponente und hängen sie in der `mobileRouteMap` an die passende Route.
