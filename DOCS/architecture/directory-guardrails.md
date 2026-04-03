# Architektur-Guardrails AniDocs

**Status:** Verbindlich  
**Geltungsbereich:** Öffentliches Tierbehandler-Verzeichnis und interner Arbeitsbereich im gleichen Next.js-Projekt (Variante A)  
**Oberstes Ziel:** Der Arbeitsbereich für Behandler (Desktop und mobil/PWA) darf nicht spürbar langsamer, schwerer oder instabiler werden.

---

## 1. Architektur-Prinzipien

1. **Zwei Produktbereiche**  
   Öffentliches Verzeichnis und interner Arbeitsbereich sind **zwei getrennte Produktbereiche** mit unterschiedlichen Nutzer:innen, Risiken und Performance-Budgets. Technisch im Monolithen, **konzeptionell und entwicklungsseitig strikt getrennt**.

2. **Priorität Arbeitsbereich**  
   Der Arbeitsbereich hat **Vorrang** auf Performance, Stabilität, Vorhersagbarkeit der Ladezeiten und PWA-Verhalten. Verzeichnis-Features dürfen diese Priorität **nicht** unterlaufen.

3. **Keine „stillen“ globalen Ladepfade**  
   Verzeichnis-Logik, schwere UI-Bibliotheken und öffentliche Spezialfälle dürfen **nicht** über Root-Layout, globale Provider oder geteilte Einstiegspunkte in die initiale Ladephase des Arbeitsbereichs gelangen.

4. **Root minimal**  
   Alles auf **Root-Ebene** (globales Layout, globale Metadaten-Strategie, globale Skripte/Provider) bleibt **so klein und generisch wie möglich**. Produkt-spezifisches gehört in **bereichsspezifische** Layouts.

5. **PWA = Arbeitsbereich**  
   Installierbarkeit, Offline-Fokus und Service-Worker-Strategie gelten **primär dem Arbeitsbereich**. Das öffentliche Verzeichnis ist **Web-Standard** (schnell, cachebar über normale HTTP/CDN-Mechanismen), nicht Teil derselben PWA-„App-Shell“-Philosophie.

6. **Explizite Grenzen statt pragmatischer Vermischung**  
   Ausnahmen von diesen Regeln sind **bewusste Architekturentscheidungen** (dokumentiert, begründet, reviewed) – keine stillen Abkürzungen aus Zeitgründen.

7. **Sicherheit und Datenminimierung**  
   Öffentliche Oberflächen exponieren **nur** das, was für Verzeichnis/SEO nötig ist. Interne Praxis- und Kundendaten bleiben **hinter Auth und RLS**; öffentliche Pfade dürfen nicht zu „Abkürzungen“ in interne Datenmodelle werden.

---

## 2. Struktur-Regeln für Route-Gruppen und Layouts

1. **Logische Trennung über Route-Gruppen**  
   Öffentlicher Verzeichnisbereich und Arbeitsbereich liegen in **getrennten Route-Gruppen** (konzeptionell: eigener Baum pro Produktbereich). Navigation und URLs können trotzdem zur gleichen Domain gehören; die **Datei- und Layout-Hierarchie** spiegelt die Trennung wider.

2. **Eigene Layout-Ketten**  
   - **Öffentliches Verzeichnis:** eigenes Layout (und ggf. Unter-Layouts für Suche, Profil, Claim), **ohne** Abhängigkeit von Arbeits-App-Navigation, Sidebars oder Praxis-Context.  
   - **Arbeitsbereich:** eigenes Layout mit App-Chrome, Auth-Gates, Praxis-Kontext – **ohne** Verzeichnis-spezifische schwere Module in der gemeinsamen Elternkette zum Root.  
   - **Admin (falls vorhanden):** **eigenes** Layout; weder Verzeichnis- noch Arbeits-App-Layout als „Über-Container“ für Admin ohne klare Grenze.

3. **Globales `app/layout.tsx`**  
   - **Erlaubt:** technische Grundlagen, die **beide** Bereiche brauchen (Schriftarten, Theme-Basis, strikt schlanke Root-Shell, ggf. minimale Analytics-Hooks nach Richtlinie).  
   - **Nicht erlaubt:** Verzeichnis-Suche, Karten, Claim-Wizards, SEO-Massenlogik, große Client-Provider-Bäume, „eine App für alles“.  
   - **Regel:** Wenn eine Ergänzung nur **einem** der beiden Produktbereiche dient, gehört sie **nicht** ins Root-Layout.

4. **Kein „ein Layout regelt alles“**  
   Kein gemeinsames Layout, das gleichzeitig öffentliches Marketing/Verzeichnis und eingeloggte Praxis-App mit unterschiedlichen JS-Bedarfen **zusammenlädt**. Getrennte Layouts = getrennte **Client-Boundary**- und **Code-Split**-Chancen.

5. **Admin vs. öffentlich vs. App**  
   Drei sichtbare Rollen – **drei klare Layout-Linien**. Überschneidungen nur über **explizit als „shared“** deklarierte, dünne Schicht (siehe Abschnitt 3).

---

## 3. Import- und Abhängigkeits-Regeln

1. **Richtung der Abhängigkeit**  
   - **Erlaubt:** `shared` / `ui-core` / `lib`-Module, die **bewusst** als neutral definiert sind (siehe unten), können von **beiden** Bereichen importiert werden.  
   - **Verboten (Arbeitsbereich):** Importe aus dem **Verzeichnisbaum** (Komponenten, Hooks, Feature-Logik für öffentliche Suche/Profil/Claim/Maps), außer nach expliziter Architektur-Ausnahme mit Begründung.  
   - **Verboten (Verzeichnis):** Importe aus dem **internen Arbeitsbereich** (Praxis-Dashboards, Patienten-/Behandlungs-Workflows, interne Navigations- und State-Strukturen). Ausnahmen nur, wenn es sich um **rein technische, nicht-fachliche** Helfer handelt, die in `shared` ausgelagert sind.

2. **Problematische Import-Arten**  
   - Import von **Feature-Ordnern** über Ordnergrenzen hinweg.  
   - Import über **Barrel-Dateien** (`index.ts`), die **große Unterbäume** re-exportieren und so unbeabsichtigt schwere transitive Abhängigkeiten ziehen.  
   - **„Convenience“-Imports** aus dem falschen Bereich „nur für eine kleine Komponente“.

3. **Was als gemeinsam okay ist**  
   - Reine **Utilities** (Datum, Format, kleine Parser, Konstanten ohne UI).  
   - **Design-Tokens**, primitive UI-Atoms, **wenn** sie ohne schwere Peer-Dependencies auskommen.  
   - **Typen** und Schema-Namen, sofern sie **keine** Implementierung von interner Geschäftslogik mitziehen.  
   - **API-Client-Hülle** nur, wenn klar getrennt: z. B. öffentliche Fetch-Helfer vs. authentifizierte Supabase-Session-Pfade – nicht eine „God-API-Schicht“.

4. **Risiken**  
   - **Barrel-Exports:** erhöhen das Risiko, dass der Bundler mehr lädt als beabsichtigt; im Arbeitsbereich und in `shared` **sparsam** einsetzen oder gezielt **deep imports** erzwingen.  
   - **Globale Provider:** jeder zusätzliche globale Context am Root kann **alle** Routen teuer machen; Provider gehören in das **Layout des jeweiligen Produktbereichs**.  
   - **Gemischte Utility-Dateien:** eine Datei mit „mal Formatierung, mal Verzeichnis-Suche“ zwingt zur Mitladung – **trennen**.

5. **Verbindliche Formulierung**  
   **Niemals** darf der Arbeitsbereich zur Laufzeit **Verzeichnis-Feature-Code** über den normalen Seitengraph mitladen müssen. **Niemals** darf das Verzeichnis **interne Praxis-Feature-Implementierungen** importieren; höchstens **freigegebene** `shared`-Bausteine.

---

## 4. Regeln für Client Components und schwere Libraries

1. **Typisch gefährlich**  
   Große **Karten**-SDKs, **Rich-Text-/Editor**-Stacks, **schwere Such-UI** (Virtualisierung + große Daten), **Media-Player** mit vielen Codecs, **Charts** für Marketing, **Animation**-Frameworks für Landing-Heavy-Seiten – alles, was **Hunderte KB** Client-JS oder lange Main-Thread-Arbeit bedeutet.

2. **Zuordnung**  
   Solche Bibliotheken sind **standardmäßig nur im öffentlichen Verzeichnisbereich** erlaubt und müssen **dynamisch** und **route-lokal** angebunden werden, sodass der Arbeitsbereich sie **nicht** im gemeinsamen Parent-Chunk hat.

3. **Entscheidungsregel**  
   Frage: *„Muss ein:e Behandler:in im Arbeits-Alltag diese Library für Kernaufgaben brauchen?“*  
   - **Nein** → nur Verzeichnis (oder später separates Surface), nicht im App-Layout, nicht in `shared` ohne Review.  
   - **Ja** → gehört **primär** in den Arbeitsbereich; Verzeichnis darf **nicht** die schwerste Variante „mitnutzen“, wenn es eine leichtere Alternative nur für öffentliche Ansicht gibt.

4. **AniDocs-spezifisch**  
   - **Verzeichnis, Suche, Karten, öffentliche Profile, Claim:** überwiegend **Server Components + gezielte Client-Inseln**; schwere Dinge **nur** auf den betroffenen Routen.  
   - **Behandler-Workflow:** schlanke Client-Boundaries; keine SEO-/Marketing-/Verzeichnis-Experimente in Kernpfaden.

5. **„use client“**  
   Client-Grenzen werden **so weit unten wie möglich** im Baum gesetzt, nicht am Root eines großen Bereichs ohne Not.

---

## 5. Regeln für PWA und Service Worker

1. **Grundhaltung**  
   Der Service Worker ist **ein Werkzeug für den Arbeitsbereich**, nicht für die gesamte öffentliche Website. Er soll **vorhersagbares Offline-/Cache-Verhalten** für definierte Arbeits-URLs unterstützen, nicht „die ganze Domain“ optimieren.

2. **PWA-relevante Bereiche**  
   Primär: **Arbeitsbereich**-Routen, statische App-Shell-Assets des Arbeitsbereichs, ggf. klar begrenzte Icons/Manifest-Bezüge. Öffentliche Verzeichnis-URLs sind **nicht** Ziel eines aggressiven App-Caches, es sei denn, es gibt eine **separat dokumentierte**, risikoarme Strategie (z. B. nur Network-first für HTML).

3. **Global nicht vorgecachen**  
   - Große **Chunks** des Verzeichnisses (Suche, Karten, Claim-Bundles).  
   - **HTML** breiter öffentlicher Bereiche als „immer offline“.  
   - **API-Antworten** mit personenbezogenen oder internen Daten.  
   - **Wildcard-Precache** ohne engen Pfad-Prefix zum Arbeitsbereich.

4. **Verzeichnis darf Offline-Fläche nicht aufblähen**  
   Precache-Listen, Runtime-Caching-Regeln und Manifest-**scope** müssen so gewählt sein, dass neue Verzeichnis-Features **nicht** automatisch mehr Ressourcen in die PWA aufnehmen. Jede Erweiterung von SW-Regeln **explizit prüfen** gegen Arbeitsbereich-Budget.

5. **Desktop + mobil**  
   Dieselben Regeln gelten für **alle** Clients: Was den Service Worker oder das Manifest betrifft, wird **nicht** „nur mobil“ gedacht, sondern **Arbeitsbereich-first** für die gesamte installierbare Nutzung.

---

## 6. Regeln für Datenzugriff und öffentliche Queries

1. **Konzeptionelle Trennung**  
   Öffentliche Verzeichnisdaten und interne App-Daten sind **unterschiedliche Zugriffsmuster**: öffentlich lesbar (mit RLS/Policies explizit für Public), vs. **session- und rollengebunden**. Kein „ein Query-Layer für alles“, der interne Joins für öffentliche Seiten nutzt.

2. **Keine schweren App-Pfade für öffentliches Lesen**  
   Öffentliche Listen und Profilseiten dürfen **nicht** dieselben **komplexen** Server-Aufrufe wie interne Dashboards verwenden (tiefe Joins über Praxis-/Kundentabellen, breite Objekte). Öffentliche Reads: **schmal**, **indiziert**, **explizit freigegebene** Felder.

3. **Tiefe Kopplung vermeiden**  
   Verzeichnislogik **greift nicht** in interne Geschäftsprozesse ein (Behandlungsakte, interne Notizen, sensible Metadaten). Claim/Verify-Prozesse nutzen **eigene**, klar abgegrenzte Datenflüsse – keine Vermischung mit „normaler“ Praxis-API.

4. **Supabase/RLS**  
   Öffentliche Zugriffe werden **über Policies** und **Views** oder **API-Schichten** so begrenzt, dass ein Fehler im Frontend **nicht** mehr preisgeben kann als vorgesehen. Interne und öffentliche **Rollen** mental und technisch trennen.

---

## 7. Performance-Guardrails

1. **Was gemessen wird**  
   Für **repräsentative Arbeitsbereich-Routen** (Desktop und mobil): LCP, INP/Interaktivität, JS-Größe der **initialen** Navigation, Time-to-Interactive nach Login-Pfaden. Nicht nur Homepage, sondern **typische Arbeitsflows**.

2. **Metriken mit Schwellenlogik**  
   Festlegen interner **Budgets** (z. B. JS pro Route-Klasse); Überschreitung nach größeren Verzeichnis-Merges **Pflicht zur Ursachenanalyse** (Bundle-Diff, Import-Graph).

3. **Kopplung erkannt**  
   Warnsignal: Arbeitsbereich-Chunks enthalten **Strings/Module** aus Verzeichnis-Pfaden; oder Bundle-Analyzer zeigt **transitive** Abhängigkeit von Verzeichnis-Libraries. Dann **Stop** – Refactor vor Feature-Ausbau.

4. **Regression als Prozess**  
   Wesentliche Änderungen am Root, an globalen Providern oder am SW **immer** mit Blick auf **Arbeitsbereich-Metriken** – nicht nur auf Lighthouse der Marketing-URL.

---

## 8. Typische No-Gos

1. Schwere Verzeichnis-Komponenten oder Karten/Suche im **globalen** oder **Arbeits-App-Layout**.  
2. **Ein** globaler Provider-Baum für Auth + Verzeichnis + Marketing + Experimente.  
3. Service Worker, der **die ganze Site** oder große Teile des Verzeichnisses **precacht** oder pauschal **offline** stellt.  
4. SEO-/Structured-Data-/Sitemap-Logik, die **interne** Arbeits-App-Routen oder **private** Daten berührt.  
5. Große **gemeinsame** UI-Bibliotheken ohne Namespace/Trennung, die Verzeichnis- und App-spezifische Widgets **in einer** Export-Ebene mischen.  
6. **Barrel-Export**-Orgien, die beim Import einer Kleinigkeit **halbe Features** mitziehen.  
7. Öffentliche Seiten, die **Session-Internals** oder **Praxis-Kontext** voraussetzen, um „einfach mal Daten zu holen“.  
8. **Direkte** Nutzung interner Tabellen/Queries für öffentliche Profilansichten ohne dedizierte, minimale Schnittstelle.  
9. Verzeichnis-Experimente in **Hot Paths** der Behandler-App (Startseite nach Login, häufige Listen, PWA-Start).  
10. „Nur schnell“ **cross-import** zwischen Verzeichnis- und Arbeits-Ordnern – **verboten** ohne Architektur-Freigabe.

---

## 9. Entscheidungskriterien für spätere Entkopplung

Eine **stärkere technische Trennung** (eigenes Frontend/Build, Monorepo mit zweiter App o. Ä.) wird **erwogen**, wenn **mehrere** der folgenden Signale **anhaltend** auftreten:

1. **Build und CI:** Build-Zeiten oder Bundle-Analyse zeigen, dass der Arbeitsbereich **messbar** unter dem Wachstum des Verzeichnisses leidet, **trotz** eingehaltener Guardrails.  
2. **Release-Tempo:** Verzeichnis und Arbeits-App brauchen **unterschiedliche** Deploy-Zyklen und **Konflikte** werden zum Engpass.  
3. **Team & Ownership:** Getrennte Verantwortung, die **konstant** gegen Monolith-Grenzen arbeitet.  
4. **Traffic/SEO:** Öffentlicher Teil hat **eigene** Skalierungs- und Caching-Anforderungen, die einen **eigenen** Edge-/Hosting-Pfad rechtfertigen.  
5. **Compliance/Risiko:** Anforderung, öffentliche und interne Oberfläche **organisatorisch/technisch** stärker zu isolieren.  
6. **Wiederholte Verstöße:** Guardrails können im Alltag **nicht** gehalten werden – dann ist die Architektur **zu fehleranfällig** für A, nicht nur „unbequem“.

**Variante A ist „nicht mehr sauber genug“,** wenn die Trennung **nur noch auf dem Papier** existiert (Imports, Chunks, SW, Datenpfade vermischt) **und** die Messwerte des Arbeitsbereichs **dauerhaft** leiden oder das Team den Aufwand für Einhaltung **höher** einschätzt als den einer Auslagerung.

---

## 10. Verbindliche Architektur-Leitlinien für AniDocs

**Ab jetzt gilt:**

- Öffentliches Verzeichnis und Arbeitsbereich sind **zwei Produktbereiche** mit **eigenen Layout-Ketten** und **keinem** Vermischen schwerer Logik auf Root-Ebene.  
- Der Arbeitsbereich hat **Vorrang** bei Performance und PWA; alle Verzeichnis-Entscheidungen werden **daran** bewertet.  
- **Import-Richtungen** und **gemeinsame Module** folgen den Regeln in Abschnitt 3; **Cross-Imports** zwischen Verzeichnis und Arbeits-Feature-Bäumen sind **unzulässig**, sofern nicht ausdrücklich und schriftlich als Ausnahme freigegeben.  
- Schwere Client-Libraries und große Client-Inseln gehören **in den öffentlichen Bereich**, **route-lokal**, und **nicht** in die Ladepfade der Behandler-App.  
- **Service Worker und PWA-Scope** schützen den Arbeitsbereich; das Verzeichnis **bläht** Precache und Runtime-Caches **nicht** auf.  
- **Öffentliche Datenzugriffe** sind schmal, klar abgegrenzt und **getrennt** von internen App-Zugriffsmustern.  
- **Performance-Budgets** und Bundle-Checks für den Arbeitsbereich sind **Teil der Qualitätsdefinition**; Anzeichen von Kopplung werden **ernst genommen** und **zuerst** bereinigt.  
- Die **No-Gos** in Abschnitt 8 sind **verbindlich**; Verstöße sind **keine** technischen Schulden „für später“, sondern **Architekturverletzungen**.

Diese Leitlinien **schützen den Arbeitsbereich** für Desktop und mobil/PWA, ermöglichen **saubere** Verzeichnis-Integration im Monolithen und geben **klare Trigger**, wann eine spätere stärkere Entkopplung sinnvoll wird – **ohne** sie vorwegzunehmen.
