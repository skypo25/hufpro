# Steuerung der App anhand der Onboarding-Daten

**Status:** TODO / Planung  
**Datum:** März 2025  
**Hinweis:** Noch nichts umgesetzt – nur Analyse und Empfehlung.

---

## 1. Zentrale Steuerungslogik

### Ausgangsdaten (bereits in `user_settings.settings`)

- `profession`: `hufbearbeiter` | `tierheilpraktiker` | `tierphysiotherapeut` | `osteopath` | `sonstiges`
- `animal_focus`: `nur_pferde` | `pferde_und_kleintiere` | `kleintiere` | `alle_tiere` | `sonstiges`

### Abgeleitete Steuerungswerte (zentral berechnen)

| Kombination | `terminology` | `primaryAnimal` | `showHorses` | `showSmallAnimals` | `docType` |
|-------------|---------------|-----------------|--------------|---------------------|-----------|
| Hufbearbeiter + nur_pferde | `pferd` | horse | ✅ | ❌ | `hoof` |
| Andere + nur_pferde | `pferd` | horse | ✅ | ❌ | `therapy` |
| Andere + pferde_und_kleintiere | `tier` | both | ✅ | ✅ | `therapy` |
| Andere + kleintiere | `tier` | small | ❌ | ✅ | `therapy` |
| Andere + alle_tiere / sonstiges | `tier` | both | ✅ | ✅ | `therapy` |

**Empfehlung:** Eine zentrale Datei/Hook (z.B. `lib/appProfile.ts`), die aus `profession` + `animal_focus` diese Werte ableitet:
- `terminology: 'pferd' | 'tier'` (für UI-Texte)
- `showHorses: boolean`
- `showSmallAnimals: boolean`
- `docType: 'hoof' | 'therapy'` (Art der Dokumentation)
- `requiresAnimalTypeChoice: boolean` (nur bei „Pferde + Kleintiere“: zuerst Tierart wählen)

---

## 2. Architektur – Bestehende Hufbearbeiter-Logik intakt lassen

### Schutz über Feature-Flag

```
isHufbearbeiter = profession === 'hufbearbeiter'
```

- **Wenn `isHufbearbeiter`:** Nur der bisherige Code-Pfad läuft. Keine neuen Branches, keine Änderung bestehender Formulare oder Routen.
- **Wenn nicht:** Zusätzliche Logik greift (andere Labels, optional Tierauswahl, etc.).

### Konkrete Umsetzung

1. **Beim App-Start / Layout:** `profession` und `animal_focus` aus `user_settings` laden.
2. **Fallback:** Wenn keine Werte vorhanden (z.B. alter Nutzer), **Default: Hufbearbeiter + nur_pferde** – damit bestehende Nutzer unverändert weiterlaufen.
3. **Bedingtes Rendering:** Nur dort, wo es notwendig ist, nach Profil filtern. Der Hufbearbeiter-Code bleibt unberührt.

---

## 3. UI-Begriffe zentral ableiten

### Zentrale Map (z.B. in `lib/terminology.ts`)

| Key | `pferd` | `tier` |
|-----|---------|--------|
| `navLabel` | Pferde | Tiere |
| `navLabelSingle` | Pferd | Tier |
| `newLabel` | Neues Pferd | Neues Tier |
| `listTitle` | Pferde | Tiere |
| `emptyState` | Keine Pferde gefunden | Keine Tiere gefunden |
| `searchPlaceholder` | Pferd, Rasse, Besitzer… | Tier, Rasse, Besitzer… |

- Alle UI-Komponenten lesen diese Map statt fest verdrahteter Strings.
- Bei Hufbearbeiter: `terminology` ist immer `pferd` → kein sichtbarer Unterschied.

---

## 4. Navigation, Formulare und Dokumentation steuern

### Navigation (Sidebar / Tab-Bar)

- `terminology === 'pferd'` → Label „Pferde“, Link weiterhin `/horses`.
- `terminology === 'tier'` → Label „Tiere“, Link weiterhin `/horses` (oder später `/animals` – technisch bleibt die Route ggf. gleich, nur das Label ändert sich).

### Anlegen („Neues Pferd“ vs „Neues Tier“)

- **Pferd-Modus:** Direkt `HorseForm` wie bisher. Button „Neues Pferd“ → `/horses/new`.
- **Tier-Modus mit Pferde + Kleintiere:** Button „Neues Tier“ → Zwischenschritt: Auswahl „Pferd“ oder „Kleintier“. Pferd → bestehendes `HorseForm`. Kleintier → neues `SmallAnimalForm`.
- **Tier-Modus mit nur Kleintieren:** Button „Neues Tier“ → direkt `SmallAnimalForm`, kein Pferd-Schritt.

### Dokumentation

- **Hufbearbeiter:** `RecordCreateForm` + `hoof_records` unverändert.
- **Andere + Pferde:** Gleiche `horses`-Struktur, aber anderer Dokumenttyp (z.B. `therapy_records` oder generische Dokumentation ohne Huf-spezifische Felder).
- **Kleintiere:** Eigenen Dokumenttyp mit eigenen Feldern.

---

## 5. Bestehendes Pferdeformular wiederverwenden

- `HorseForm` bleibt für Hufbearbeiter **identisch**.
- Für „andere Berufsgruppen + Pferde“ wird dasselbe Formular verwendet.
- Optional: Minimale Erweiterung über Props, z.B. `mode="hoof" | "therapy"` – wenn für Therapieberufe andere Felder ausgeblendet werden sollen.
- **Wichtig:** Kein Refactoring des Formulars – nur optionale Erweiterung.

---

## 6. Kleintiere ergänzen ohne Sonderlogik überall

### Strategie

1. **Eigene Entität:** Neue Tabelle `small_animals` (oder `pets`) – analog zu `horses` (name, breed, Besitzer, etc.).
2. **Eigene Formulare/Routen:** `SmallAnimalForm`, Route z.B. `/animals/small/new` oder `/small-animals/new`.
3. **Profil steuert Sichtbarkeit:** Navigation zeigt Kleintiere nur, wenn `showSmallAnimals === true`.
4. **Zentrale „Anlegen“-Seite:** Wenn `requiresAnimalTypeChoice`, wird zuerst Pferd vs. Kleintier gewählt; dann wird zum jeweiligen Formular geroutet.
5. **Keine If/Else-Ketten:** Komponenten fragen nur `appProfile.showSmallAnimals` ab – keine `profession === 'xyz'`-Checks in jeder Datei.

---

## 7. Empfohlenes Muster: Zentrales App-Profil

- **Konfigurationslogik:** Ein zentraler Helper/Hook (`deriveAppProfile(profession, animal_focus)`).
- **React Context oder Hook:** `useAppProfile()` liefert die abgeleiteten Werte.
- **Vorteil:** Alle Regeln an einer Stelle; leicht erweiterbar und testbar.

---

## 8. Betroffene Bereiche im Projekt

| Bereich | Betroffene Dateien |
|---------|--------------------|
| **Profil-Logik** | Neu: `lib/appProfile.ts` |
| **Terminologie** | Neu: `lib/terminology.ts` oder Teil von `appProfile` |
| **Layout / Navigation** | `Sidebar.tsx`, `MobileShell.tsx`, `MobileFab.tsx` |
| **Listen** | `MobileHorses.tsx`, `app/(app)/horses/page.tsx` – Labels dynamisch |
| **Anlegen** | `MobileHorseForm`, `MobileFab`, evtl. neue „Tierart wählen“-Seite |
| **Detail** | `MobileHorseDetail`, `app/(app)/horses/[id]/page.tsx` – bei „Tier“ evtl. generischere Labels |
| **Dokumentation** | `RecordCreateForm`, `MobileRecordForm` – nur für Nicht-Hufbearbeiter alternativer Pfad |
| **Suche** | Filter „Pferde“ vs „Tiere“ je nach `terminology` |
| **APIs** | `/api/horses/*` bleibt; neue APIs für `small_animals`, evtl. `therapy_records` |
| **Datenbank** | Neue Tabellen: `small_animals`, evtl. `therapy_records` |
| **Onboarding** | Keine Änderung – `profession` und `animal_focus` werden bereits gespeichert |

---

## 9. Umsetzungsschritte (Risiko minimal)

### Phase 1: Grundlage (ohne Verhalten)

1. `lib/appProfile.ts` anlegen: `deriveAppProfile(profession, animal_focus)`.
2. `useAppProfile()`-Hook, der `user_settings` lädt und Profil liefert.
3. Default: Keine Daten → Hufbearbeiter + nur_pferde.
4. Noch keine UI-Änderungen.

### Phase 2: Terminologie

1. `getTerminology(profile)` oder direkt `profile.terminology`.
2. Sidebar/Navigation: Labels aus Profil ableiten („Pferde“ vs „Tiere“).
3. Nur Labels ändern, keine neuen Flows.

### Phase 3: „Neues Tier“ mit Tierauswahl

1. Neue Seite: „Tierart wählen“ (Pferd vs. Kleintier).
2. In Tier-Modus: Button „Neues Tier“ → diese Seite statt direkt zu `HorseForm`.
3. Pferd → bestehendes `HorseForm`.
4. Kleintier → zunächst Platzhalter oder einfaches Formular.

### Phase 4: Kleintiere

1. Migration für `small_animals`.
2. `SmallAnimalForm` + CRUD.
3. Integration in Navigation und „Neues Tier“-Flow.

### Phase 5: Dokumentation für andere Berufe

1. Evtl. `therapy_records` oder generische Dokumentation.
2. Eigenes Formular, das nur erscheint, wenn `docType === 'therapy'`.

In jeder Phase bleibt das Verhalten für Hufbearbeiter unverändert.

---

## 10. Bewusst unverändert

| Bereich | Begründung |
|---------|------------|
| `HorseForm` (Desktop + Mobile) | Bestehende Hufbearbeiter-Logik bleibt identisch; optional nur Erweiterung für „andere + Pferd“. |
| `RecordCreateForm` / `MobileRecordForm` | Für Hufbearbeiter kein Touch; evtl. neuer paralleler Pfad für andere. |
| `hoof_records`-Schema | Bestehende Dokumentation bleibt wie sie ist. |
| Route `/horses` | Pfad kann gleich bleiben; nur Label und Inhalte werden gesteuert. |
| Onboarding | Abfrage und Speicherung bleiben unverändert. |
| APIs `/api/horses/*` | Keine Änderung; neue APIs separat für Kleintiere/Therapie. |
| `appointment_horses` | Relation Termin ↔ Pferd bleibt; evtl. später `appointment_animals` o.Ä. für Kleintiere. |

---

## Kurzfassung

1. **Zentrale Logik:** `deriveAppProfile(profession, animal_focus)` liefert alle Steuerungswerte.
2. **Architektur:** Hufbearbeiter = aktueller Stand; andere Berufe = zusätzliche, profilgesteuerte Pfade.
3. **Terminologie:** Zentral über Profil; keine hartkodierten Strings in UI-Komponenten.
4. **Formulare:** `HorseForm` wiederverwenden für alle Pferde; neues `SmallAnimalForm` nur für Kleintiere.
5. **Kleintiere:** Eigene Entität und Formulare; keine Sonderfälle im Kern der Hufbearbeiter-Logik.
6. **Umsetzung:** Schrittweise von Profil → Terminologie → Anlege-Flow → Kleintiere → Dokumentation.
