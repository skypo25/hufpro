-- Directory: Testprofile komplett ersetzen (nur Profil-Daten; Referenztabellen bleiben).
-- Vorherige Testdaten (inkl. altem Fachmodell mit hufbearbeitung) werden entfernt;
-- neue Profile folgen dem aktuellen Modell (Fachrichtung, Spezialisierung, Methode, Tierart, Geo).

-- ---------------------------------------------------------------------------
-- 1) Profilbezogene Daten leeren (Reihenfolge: CASCADE ab directory_profiles)
-- ---------------------------------------------------------------------------

TRUNCATE TABLE public.directory_profiles CASCADE;

-- ---------------------------------------------------------------------------
-- 2) Feste Profil-UUIDs (nachfolgende INSERTs referenzieren dieselben IDs)
-- ---------------------------------------------------------------------------

-- Tierphysiotherapie (4)
-- Tierosteopathie (4)
-- Tierheilpraktik (4)
-- Hufschmied (4)
-- Barhufbearbeitung (4)

INSERT INTO public.directory_profiles (
  id,
  slug,
  display_name,
  practice_name,
  short_description,
  description,
  street,
  house_number,
  postal_code,
  city,
  state,
  country,
  latitude,
  longitude,
  service_type,
  service_area_text,
  service_radius_km,
  listing_status,
  claim_state,
  verification_state,
  premium_active,
  data_origin
) VALUES
  -- Tierphysiotherapie
  (
    'a1000000-0000-4000-8000-000000000001',
    'test-anidocs-physio-berlin-mitte',
    'Dr. Anna Weber (Test)',
    'Tierphysio Mitte Berlin',
    'Rehabilitation und Lasertherapie für Pferde und Hunde — Testprofil.',
    'Schwerpunkt Bewegungsapparat; enge Zusammenarbeit mit Tierärzt:innen. Nur zu Demonstrationszwecken im AniDocs-Verzeichnis.',
    'Chausseestr.',
    '12',
    '10115',
    'Berlin',
    'BE',
    'DE',
    52.532,
    13.385,
    'stationary',
    'Berlin Mitte, Pankow',
    25,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'test-anidocs-physio-hamburg',
    'Tom Schneider (Test)',
    'Mobile Tierphysio Nord',
    'Muskelaufbau und Massage — Testprofil, mobil in Hamburg und Umland.',
    'Hausbesuche nach Terminvereinbarung. Demonstrationsdaten ohne reale Praxisbindung.',
    NULL,
    NULL,
    '22529',
    'Hamburg',
    'HH',
    'DE',
    53.565,
    9.978,
    'mobile',
    'Großraum Hamburg',
    40,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'test-anidocs-physio-muenchen',
    'Lisa Hartmann (Test)',
    'Ganganalyse München',
    'Ganganalyse und Sportpferd — Testprofil.',
    'Laufbandanalyse und Feldbewertung. Testeintrag für AniDocs Directory.',
    'Wörthstr.',
    '45',
    '81679',
    'München',
    'BY',
    'DE',
    48.135,
    11.582,
    'both',
    'Oberbayern',
    35,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'test-anidocs-physio-koeln',
    'Jan Becker (Test)',
    'NeuroReha Köln',
    'Neurologische Rehabilitation für Kleintiere — Testprofil.',
    'Koordination mit Neurologie. Nur Testdaten.',
    'Luxemburger Str.',
    '180',
    '50939',
    'Köln',
    'NW',
    'DE',
    50.936,
    6.952,
    'stationary',
    'Köln und Umgebung',
    20,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  -- Tierosteopathie
  (
    'a1000000-0000-4000-8000-000000000005',
    'test-anidocs-osteo-frankfurt',
    'Sarah Klein (Test)',
    'Osteopathie am Main',
    'Rücken und Beweglichkeit — Testprofil.',
    'Strukturelle Osteopathie für Pferd und Hund. Fiktiver Eintrag.',
    'Eschersheimer Landstr.',
    '42',
    '60322',
    'Frankfurt am Main',
    'HE',
    'DE',
    50.115,
    8.682,
    'stationary',
    'Rhein-Main',
    30,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    'test-anidocs-osteo-stuttgart',
    'Michael Braun (Test)',
    'Osteo mobil Schwaben',
    'Beckenschiefstand und Kiefer — mobil, Testprofil.',
    'Hausbesuche nach Absprache. Demonstration AniDocs.',
    NULL,
    NULL,
    '70173',
    'Stuttgart',
    'BW',
    'DE',
    48.775,
    9.183,
    'mobile',
    'Region Stuttgart',
    45,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    'test-anidocs-osteo-dresden',
    'Julia Richter (Test)',
    'Viszeral Osteo Elbe',
    'Viszerale und craniosakrale Osteopathie — Test.',
    'Termine in der Praxis. Testdatensatz.',
    'Hauptstr.',
    '7',
    '01099',
    'Dresden',
    'SN',
    'DE',
    51.051,
    13.737,
    'both',
    'Sachsen Elbland',
    50,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    'test-anidocs-osteo-hannover',
    'Felix Wolf (Test)',
    'Parietale Osteopathie Nord',
    'Parietale Techniken — Testprofil Hannover.',
    'Fokus Bewegungsapparat. Keine echte Praxis.',
    'Lavesallee',
    '1',
    '30169',
    'Hannover',
    'NI',
    'DE',
    52.375,
    9.732,
    'stationary',
    'Hannover',
    15,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  -- Tierheilpraktik
  (
    'a1000000-0000-4000-8000-000000000009',
    'test-anidocs-thp-leipzig',
    'Nina Krüger (Test)',
    'Naturheilkunde Leipzig',
    'Allergien und Haut — Testprofil THP.',
    'Ernährungsberatung ergänzend. Nur Demo.',
    'Karl-Liebknecht-Str.',
    '15',
    '04107',
    'Leipzig',
    'SN',
    'DE',
    51.340,
    12.375,
    'stationary',
    'Leipzig',
    25,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-00000000000a',
    'test-anidocs-thp-nuernberg',
    'Oliver Meier (Test)',
    'THP Mittelfranken mobil',
    'Stoffwechsel und Darm — mobil, Test.',
    'Kräuter und Homöopathie. Fiktiv.',
    NULL,
    NULL,
    '90402',
    'Nürnberg',
    'BY',
    'DE',
    49.452,
    11.078,
    'mobile',
    'Mittelfranken',
    60,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-00000000000b',
    'test-anidocs-thp-bremen',
    'Petra Hoffmann (Test)',
    'Immun & Darm Bremen',
    'Immunsystem und Entgiftung — Testprofil.',
    'Begleitung chronischer Fälle. Testeintrag.',
    'Ostertorsteinweg',
    '88',
    '28203',
    'Bremen',
    'HB',
    'DE',
    53.079,
    8.804,
    'both',
    'Bremen / Bremerhaven',
    40,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-00000000000c',
    'test-anidocs-thp-duesseldorf',
    'Clara Neumann (Test)',
    'Schmerztherapie THP NRW',
    'Schmerztherapie natürlich — Test.',
    'Akupunktur und Neuraltherapie. Demo.',
    'Graf-Adolf-Str.',
    '100',
    '40210',
    'Düsseldorf',
    'NW',
    'DE',
    51.227,
    6.773,
    'stationary',
    'Düsseldorf',
    22,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  -- Hufschmied
  (
    'a1000000-0000-4000-8000-00000000000d',
    'test-anidocs-hufschmied-essen',
    'Markus Hufeisen (Test)',
    'Beschlagstudio Ruhr',
    'Orthopädischer Beschlag und Klebebeschlag — Test.',
    'Wettkampf und Freizeit. Fiktiver Hufschmied.',
    'Rüttenscheider Str.',
    '30',
    '45131',
    'Essen',
    'NW',
    'DE',
    51.456,
    7.011,
    'both',
    'Ruhrgebiet',
    55,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-00000000000e',
    'test-anidocs-hufschmied-dortmund',
    'Stefan Nagel (Test)',
    'Sportpferdebeschlag DO',
    'Sportpferde und Aluminium — Testprofil.',
    'Turnierbetreuung möglich. Nur Test.',
    NULL,
    NULL,
    '44135',
    'Dortmund',
    'NW',
    'DE',
    51.514,
    7.465,
    'mobile',
    'NRW Süd',
    70,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-00000000000f',
    'test-anidocs-hufschmied-bonn',
    'Andreas Stahl (Test)',
    'Rehebeschlag Bonn',
    'Rehe- und Korrekturbeschlag — Test.',
    'Hufkorrekturen. Demonstration.',
    'Königstr.',
    '5',
    '53115',
    'Bonn',
    'NW',
    'DE',
    50.737,
    7.098,
    'stationary',
    'Bonn / Rhein-Sieg',
    30,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000010',
    'test-anidocs-hufschmied-mannheim',
    'Ralf Eisen (Test)',
    'Gangpferd Beschlag MA',
    'Gangpferde und Winterbeschlag — Test.',
    'Spezialbeschlag. Kein Live-Betrieb.',
    'Augustaanlage',
    '22',
    '68165',
    'Mannheim',
    'BW',
    'DE',
    49.489,
    8.469,
    'mobile',
    'Kurpfalz',
    45,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  -- Barhufbearbeitung
  (
    'a1000000-0000-4000-8000-000000000011',
    'test-anidocs-barhuf-freiburg',
    'Eva Barhuf (Test)',
    'Barhuf Süd-Schwarzwald',
    'Barhufumstellung und Hufreha — Test.',
    'Sanfte Umstellung. Testprofil.',
    'Schwarzwaldstr.',
    '3',
    '79102',
    'Freiburg im Breisgau',
    'BW',
    'DE',
    47.999,
    7.842,
    'both',
    'Südbaden',
    50,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000012',
    'test-anidocs-barhuf-rostock',
    'Kai Strand (Test)',
    'Küsten Barhuf',
    'Hufschuhe Beratung und Übergang Klebe — Test.',
    'Kühlung und Weidehaltung. Fiktiv.',
    NULL,
    NULL,
    '18055',
    'Rostock',
    'MV',
    'DE',
    54.089,
    12.140,
    'mobile',
    'Küste MV',
    65,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000013',
    'test-anidocs-barhuf-luebeck',
    'Maren Küste (Test)',
    'Huforthopädie Lübeck',
    'Huforthopädie und Fühligkeit — Test.',
    'Barhufpflege zertifiziert (fiktiv).',
    'Hüxstr.',
    '55',
    '23552',
    'Lübeck',
    'SH',
    'DE',
    53.865,
    10.687,
    'stationary',
    'Lübeck / Ostholstein',
    35,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  ),
  (
    'a1000000-0000-4000-8000-000000000014',
    'test-anidocs-barhuf-karlsruhe',
    'Tim Hufpfote (Test)',
    'Barhuf Technologie KA',
    'Rehebearbeitung und Umstellung Betreuung — Test.',
    'Kooperation mit Tierärzten. Demo.',
    'Kaiserstr.',
    '120',
    '76133',
    'Karlsruhe',
    'BW',
    'DE',
    49.009,
    8.404,
    'mobile',
    'Karlsruhe / Kraichgau',
    40,
    'published',
    'unclaimed',
    'none',
    false,
    'manual'
  );

-- Physio + Tiere + Sub + Method
INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true
FROM public.directory_profiles p
CROSS JOIN public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000001' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000001' AND sc.code = 'tp_rehabilitation';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000001' AND m.code = 'm_tp_laser';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000001' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000002' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000002' AND sc.code = 'tp_muskelaufbau';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000002' AND m.code = 'm_tp_massage';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000002' AND a.code = 'hund';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000003' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000003' AND sc.code = 'tp_ganganalyse';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000003' AND m.code = 'm_tp_uwl';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000003' AND a.code IN ('pferd', 'hund');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000004' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000004' AND sc.code = 'tp_neuro_reha';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000004' AND m.code = 'm_tp_tens';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000004' AND a.code = 'kleintiere';

-- Osteo
INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000005' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000005' AND sc.code = 'to_ruecken';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000005' AND m.code = 'm_to_parietal';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000005' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000006' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000006' AND sc.code = 'to_becken';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000006' AND m.code = 'm_to_gelenk';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000006' AND a.code = 'hund';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000007' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000007' AND sc.code = 'to_viszeral';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000007' AND m.code = 'm_to_viszeral';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000007' AND a.code IN ('pferd', 'hund');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000008' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000008' AND sc.code = 'to_kiefer';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000008' AND m.code = 'm_to_cranio';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000008' AND a.code = 'pferd';

-- THP
INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000009' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000009' AND sc.code = 'th_allergien';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000009' AND m.code = 'm_th_homoeo';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000009' AND a.code IN ('hund', 'katze');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-00000000000a' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-00000000000a' AND sc.code = 'th_stoffwechsel';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-00000000000a' AND m.code = 'm_th_phyto';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-00000000000a' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-00000000000b' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-00000000000b' AND sc.code = 'th_immunsystem';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-00000000000b' AND m.code = 'm_th_myko';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-00000000000b' AND a.code = 'hund';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-00000000000c' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-00000000000c' AND sc.code = 'th_schmerz';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-00000000000c' AND m.code = 'm_th_blutegel';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-00000000000c' AND a.code IN ('hund', 'katze');

-- Hufschmied
INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-00000000000d' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-00000000000d' AND sc.code = 'hs_orthopaedie';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-00000000000d' AND m.code = 'm_hs_klebe';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-00000000000d' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-00000000000e' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-00000000000e' AND sc.code = 'hs_sportpferd';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-00000000000e' AND m.code = 'm_hs_alu';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-00000000000e' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-00000000000f' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-00000000000f' AND sc.code = 'hs_rehe';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-00000000000f' AND m.code = 'm_hs_duplo';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-00000000000f' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000010' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000010' AND sc.code = 'hs_gangpferd';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000010' AND m.code = 'm_hs_winter';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000010' AND a.code = 'pferd';

-- Barhuf
INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000011' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000011' AND sc.code = 'bh_umstellung';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000011' AND m.code = 'm_bh_umstellung_betreuung';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000011' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000012' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000012' AND sc.code = 'bh_hufreha';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000012' AND m.code = 'm_bh_hufschuhe';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000012' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000013' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000013' AND sc.code = 'bh_ortho';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000013' AND m.code = 'm_bh_klebe_uebergang';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000013' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'a1000000-0000-4000-8000-000000000014' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'a1000000-0000-4000-8000-000000000014' AND sc.code = 'bh_rehe';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'a1000000-0000-4000-8000-000000000014' AND m.code = 'm_bh_rehe';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'a1000000-0000-4000-8000-000000000014' AND a.code = 'pferd';

-- Quellen (je Profil eine Zeile)
INSERT INTO public.directory_profile_sources (
  directory_profile_id,
  primary_source_url,
  source_type,
  data_quality
)
SELECT id,
  'https://example.invalid/anidocs-directory-test/source/' || slug,
  'manual_research',
  'reviewed'
FROM public.directory_profiles
WHERE slug LIKE 'test-anidocs-%';

-- Website-Link je Profil
INSERT INTO public.directory_profile_social_links (directory_profile_id, platform, url, sort_order)
SELECT id, 'website', 'https://example.invalid/anidocs-test/' || slug, 0
FROM public.directory_profiles
WHERE slug LIKE 'test-anidocs-%';

-- Einige Test-Medien (URL-only)
INSERT INTO public.directory_profile_media (directory_profile_id, media_type, url, sort_order, alt_text)
SELECT id, 'logo', 'https://picsum.photos/seed/anidocs-dir-' || slug || '/200/200', 0, 'Test-Logo (Platzhalter)'
FROM public.directory_profiles
WHERE id IN (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-00000000000d',
  'a1000000-0000-4000-8000-000000000011'
);
