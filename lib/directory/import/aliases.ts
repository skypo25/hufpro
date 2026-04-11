/**
 * Normalisierte Codes müssen mit den Directory-Migrationen (Fachrichtungs-Seeds) übereinstimmen.
 * Aliase: freie Schreibweisen aus Rohdaten → code.
 */

export const SPECIALTY_ALIASES: Record<string, string> = {
  tierphysiotherapie: 'tierphysiotherapie',
  physiotherapie: 'tierphysiotherapie',
  tierphysio: 'tierphysiotherapie',
  tierosteopathie: 'tierosteopathie',
  osteopathie: 'tierosteopathie',
  tierheilpraktik: 'tierheilpraktik',
  heilpraktik: 'tierheilpraktik',
  thp: 'tierheilpraktik',
  tierheilpraktiker: 'tierheilpraktik',
  heilpraktiker: 'tierheilpraktik',
  hufbearbeitung: 'hufbearbeitung',
  hufpflege: 'hufbearbeitung',
  hufschmied: 'hufschmied',
  beschlag: 'hufschmied',
  hufbeschlag: 'hufschmied',
  barhuf: 'barhufbearbeitung',
  barhufbearbeitung: 'barhufbearbeitung',
  'barhuf bearbeitung': 'barhufbearbeitung',
  schmied: 'hufschmied',
}

export const ANIMAL_ALIASES: Record<string, string> = {
  pferd: 'pferd',
  pferde: 'pferd',
  hund: 'hund',
  hunde: 'hund',
  katze: 'katze',
  katzen: 'katze',
  kleintier: 'kleintiere',
  kleintiere: 'kleintiere',
  heimtier: 'kleintiere',
  heimtiere: 'kleintiere',
  nutztier: 'nutztiere',
  nutztiere: 'nutztiere',
  rind: 'nutztiere',
  schwein: 'nutztiere',
}

/** Mappt Unterkategorie-Text auf Specialty-Code (wenn Hauptfach Huf o. Ä.). */
export const SUBCATEGORY_ALIASES: Record<string, string> = {
  barhuf: 'barhufbearbeitung',
  barhufbearbeitung: 'barhufbearbeitung',
  hufschmied: 'hufschmied',
  hufbeschlag: 'hufschmied',
  tierphysiotherapie: 'tierphysiotherapie',
  tierosteopathie: 'tierosteopathie',
  tierheilpraktik: 'tierheilpraktik',
}
