/**
 * Zentrale Ableitung des App-Profils aus Onboarding-Daten (profession + animal_focus).
 * Keine React-Abhängigkeit — reine Funktionen für spätere Nutzung in UI/Server.
 */

/** Wie in app/onboarding/page.tsx */
export type Profession =
  | 'hufbearbeiter'
  | 'tierheilpraktiker'
  | 'tierphysiotherapeut'
  | 'osteopath'
  | 'sonstiges'

/** Wie in app/onboarding/page.tsx */
export type AnimalFocus =
  | 'nur_pferde'
  | 'pferde_und_kleintiere'
  | 'alle_tiere'
  | 'kleintiere'
  | 'sonstiges'

/** UI-Sprache: Pferd/Pferde vs. Tier/Tiere */
export type Terminology = 'pferd' | 'tier'

/** Welche Tiergruppe(n) strukturell im Fokus liegen */
export type PrimaryAnimal = 'horse' | 'small' | 'both'

/** Dokumentationsart: Huf-Doku vs. spätere Therapie-/allgemeine Doku */
export type DocType = 'hoof' | 'therapy'

const PROFESSIONS: readonly Profession[] = [
  'hufbearbeiter',
  'tierheilpraktiker',
  'tierphysiotherapeut',
  'osteopath',
  'sonstiges',
]

const ANIMAL_FOCUS: readonly AnimalFocus[] = [
  'nur_pferde',
  'pferde_und_kleintiere',
  'alle_tiere',
  'kleintiere',
  'sonstiges',
]

/** Fachliche Erstaufnahme-Module im AnimalForm (nicht an Berufsbezeichnung gekoppelt). */
export type ClinicalIntakeBlockId = 'anamnesis' | 'locomotion' | 'history'

export type AppProfile = {
  /** Alle ausgewählten Fachrichtungen (Onboarding Multi-Select). */
  professions: Profession[]
  profession: Profession
  animalFocus: AnimalFocus
  terminology: Terminology
  primaryAnimal: PrimaryAnimal
  showHorses: boolean
  showSmallAnimals: boolean
  docType: DocType
  /** true, wenn vor dem Anlegen zwischen Pferd und Kleintier gewählt werden soll (nur Nicht-Huf) */
  requiresAnimalTypeChoice: boolean
  isHufbearbeiter: boolean
}

const DEFAULT_PROFESSION: Profession = 'hufbearbeiter'
const DEFAULT_ANIMAL_FOCUS: AnimalFocus = 'nur_pferde'

function normalizeProfession(value: unknown): Profession | null {
  if (typeof value !== 'string') return null
  return PROFESSIONS.includes(value as Profession) ? (value as Profession) : null
}

function normalizeProfessions(value: unknown): Profession[] {
  if (Array.isArray(value)) {
    const out: Profession[] = []
    for (const v of value) {
      const p = normalizeProfession(v)
      if (p && !out.includes(p)) out.push(p)
    }
    return out.length > 0 ? out : [DEFAULT_PROFESSION]
  }
  const single = normalizeProfession(value)
  return [single ?? DEFAULT_PROFESSION]
}

function normalizeAnimalFocus(value: unknown): AnimalFocus {
  if (typeof value !== 'string') return DEFAULT_ANIMAL_FOCUS
  return ANIMAL_FOCUS.includes(value as AnimalFocus) ? (value as AnimalFocus) : DEFAULT_ANIMAL_FOCUS
}

/**
 * Leitet ein konsistentes AppProfile aus gespeicherten Onboarding-Werten ab.
 * Fehlende oder ungültige Werte → konservativer Fallback (Hufbearbeiter + nur Pferde).
 */
export function deriveAppProfile(
  profession: unknown,
  animalFocus: unknown
): AppProfile {
  const professions = normalizeProfessions(profession)
  const p = professions[0] ?? DEFAULT_PROFESSION
  const a = normalizeAnimalFocus(animalFocus)
  const isHufbearbeiter = professions.includes('hufbearbeiter')

  // Hufbearbeiter: immer Pferd-Terminologie und Huf-Dokumentation (wie bisherige App)
  const terminology: Terminology = isHufbearbeiter
    ? 'pferd'
    : a === 'nur_pferde'
      ? 'pferd'
      : 'tier'

  let primaryAnimal: PrimaryAnimal
  if (a === 'nur_pferde') primaryAnimal = 'horse'
  else if (a === 'kleintiere') primaryAnimal = 'small'
  else primaryAnimal = 'both'

  const showHorses = a !== 'kleintiere'
  const showSmallAnimals =
    a === 'kleintiere' ||
    a === 'pferde_und_kleintiere' ||
    a === 'alle_tiere' ||
    a === 'sonstiges'

  const docType: DocType = isHufbearbeiter ? 'hoof' : 'therapy'

  const requiresAnimalTypeChoice =
    !isHufbearbeiter &&
    (a === 'pferde_und_kleintiere' || a === 'alle_tiere' || a === 'sonstiges')

  return {
    professions,
    profession: p,
    animalFocus: a,
    terminology,
    primaryAnimal,
    showHorses,
    showSmallAnimals,
    docType,
    requiresAnimalTypeChoice,
    isHufbearbeiter,
  }
}

/**
 * Welche Fachblöcke im Tier-Anlageformular angezeigt werden.
 * Später: z. B. aus user_settings (Kombinationen) — aktuell alle drei für Nicht-Hufbearbeiter.
 */
export function deriveClinicalIntakeBlocks(profile: AppProfile): ClinicalIntakeBlockId[] {
  if (profile.isHufbearbeiter) return []
  return ['anamnesis', 'locomotion', 'history']
}

/**
 * Kundenformular: Pferd-/Huf-spezifische Bereiche (Bearbeitungsintervall, „Erstes Pferd mit anlegen“).
 * Bei Tier-Terminologie (`terminology === 'tier'`) ausblenden; `interval_weeks` dann beim Speichern null.
 */
export function showCustomerHorseSpecificFields(profile: AppProfile): boolean {
  return profile.terminology === 'pferd'
}

// ─── UI-Labels (Terminologie) — zentral, für Navigation & Pferde-/Tier-Listen ───

/** Tab- und Seitentitel: „Pferde“ vs. „Tiere“ */
export function animalsNavLabel(terminology: Terminology): string {
  return terminology === 'pferd' ? 'Pferde' : 'Tiere'
}

/** Einzahl für Spaltenköpfe, aria-labels: „Pferd“ vs. „Tier“ */
export function animalSingularLabel(terminology: Terminology): string {
  return terminology === 'pferd' ? 'Pferd' : 'Tier'
}

/** CTA Desktop/Mobile: „Pferd anlegen“ vs. „Tier anlegen“ */
export function newAnimalButtonLabel(terminology: Terminology): string {
  return terminology === 'pferd' ? 'Pferd anlegen' : 'Tier anlegen'
}

/** FAB-Eintrag: „Neues Pferd“ vs. „Neues Tier“ */
export function newAnimalFabLabel(terminology: Terminology): string {
  return terminology === 'pferd' ? 'Neues Pferd' : 'Neues Tier'
}

/** Kopfzeile: „{n} Pferde in Betreuung“ / „{n} Tiere in Betreuung“ */
export function animalsInCareLine(terminology: Terminology, horseCount: number): string {
  return `${horseCount} ${animalsNavLabel(terminology)} in Betreuung`
}

export function searchAnimalsPlaceholder(terminology: Terminology): string {
  return terminology === 'pferd'
    ? 'Pferd, Rasse, Besitzer oder Stallort suchen…'
    : 'Tier, Rasse, Besitzer oder Stallort suchen…'
}

/** Kundenlisten-Suche (Desktop/Mobile) */
export function searchCustomersPlaceholder(terminology: Terminology): string {
  return terminology === 'pferd'
    ? 'Kunde, Ort oder Pferd suchen…'
    : 'Kunde, Ort oder Tier suchen…'
}

export function animalsStatLabel(terminology: Terminology): string {
  return `${animalsNavLabel(terminology)} gesamt`
}

/** Dashboard-Stat-Kachel: „Pferde betreut“ vs. „Tiere betreut“ */
export function dashboardAnimalsBetreutLabel(terminology: Terminology): string {
  return terminology === 'pferd' ? 'Pferde betreut' : 'Tiere betreut'
}

export function animalsLoadingMessage(terminology: Terminology): string {
  return terminology === 'pferd' ? 'Pferde werden geladen…' : 'Tiere werden geladen…'
}

export function animalsEmptyMessage(terminology: Terminology): string {
  return terminology === 'pferd' ? 'Keine Pferde gefunden.' : 'Keine Tiere gefunden.'
}

/** Pagination: „Zeige a–b von n Pferden“ / „… Tieren“ */
export function animalsPaginationLine(
  terminology: Terminology,
  start: number,
  end: number,
  total: number
): string {
  const noun = terminology === 'pferd' ? 'Pferden' : 'Tieren'
  return `Zeige ${start}–${end} von ${total} ${noun}`
}

export function statCardAllAnimalsSubtext(terminology: Terminology): string {
  return terminology === 'pferd' ? 'alle Pferde' : 'alle Tiere'
}

export function horsesLoadErrorDescription(terminology: Terminology, message: string): string {
  const prefix = terminology === 'pferd' ? 'Pferde konnten nicht geladen werden' : 'Tiere konnten nicht geladen werden'
  return `${prefix}: ${message}`
}
