-- Directory: 20 Rheinland-Pfalz-Testprofile (JSON-Parität).
-- Voraussetzungen: Referenz-Seeds + Subkategorien/Methoden (20260406140000, 20260410120000).
-- Optional davor: 20260412100000_directory_clear_profiles_and_imports.sql (sonst Slug-Kollision möglich).
--
-- Feste Profil-IDs: b2000000-0000-4000-8000-000000000001 … 000000000014 (hex, 20 Profile).

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
  phone_public,
  email_public,
  listing_status,
  claim_state,
  verification_state,
  premium_active,
  data_origin
) VALUES
  (
    'b2000000-0000-4000-8000-000000000001',
    'testprofil-tierphysio-rheinblick-56068',
    'Sarah Klein',
    'Testprofil Tierphysio Rheinblick',
    'Mobile Tierphysiotherapie für Pferde und Hunde im Raum Koblenz.',
    $d$Mobile Tierphysiotherapie für Pferde und Hunde im Raum Koblenz.

Qualifikationen:
Tierphysiotherapie Ausbildung

Leistungen:
Massage, Manuelle Therapie, Lasertherapie, Kinesiotaping$d$,
    'Rheinstraße',
    '12',
    '56068',
    'Koblenz',
    'Rheinland-Pfalz',
    'DE',
    50.3569,
    7.5890,
    'mobile',
    'Koblenz, Neuwied, Boppard',
    40,
    '0151 10000001',
    'sarah.klein@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'testprofil-tierphysio-moselpfote-54290',
    'Julia Weber',
    'Testprofil Tierphysio Moselpfote',
    'Tierphysiotherapie mit Schwerpunkt Muskelaufbau und Bewegungsfreude.',
    $d$Tierphysiotherapie mit Schwerpunkt Muskelaufbau und Bewegungsfreude.

Qualifikationen:
Tierphysiotherapeutin

Leistungen:
Massage, Manuelle Therapie, Faszientherapie$d$,
    'Moselweg',
    '4',
    '54290',
    'Trier',
    'Rheinland-Pfalz',
    'DE',
    49.7596,
    6.6439,
    'both',
    'Trier und Umgebung',
    35,
    '0151 10000002',
    'julia.weber@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'testprofil-pferdephysio-nahe-55543',
    'Anna Roth',
    'Testprofil Pferdephysio Nahe',
    'Mobile Pferdephysiotherapie für Trainingsbegleitung und Regeneration.',
    $d$Mobile Pferdephysiotherapie für Trainingsbegleitung und Regeneration.

Qualifikationen:
Pferdephysiotherapie

Leistungen:
Lasertherapie, Ultraschalltherapie, Kinesiotaping$d$,
    'Naheufer',
    '9',
    '55543',
    'Bad Kreuznach',
    'Rheinland-Pfalz',
    'DE',
    49.8448,
    7.8677,
    'mobile',
    'Bad Kreuznach, Bingen, Alzey',
    40,
    '0151 10000003',
    'anna.roth@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000004',
    'testprofil-tierphysio-eifelblick-54568',
    'Laura Fuchs',
    'Testprofil Tierphysio Eifelblick',
    'Physiotherapeutische Begleitung für Seniorenhunde und ältere Katzen.',
    $d$Physiotherapeutische Begleitung für Seniorenhunde und ältere Katzen.

Qualifikationen:
Tierphysiotherapie Kleintiere

Leistungen:
Massage, Elektrotherapie, TENS$d$,
    'Hauptstraße',
    '21',
    '54568',
    'Gerolstein',
    'Rheinland-Pfalz',
    'DE',
    50.2227,
    6.6592,
    'stationary',
    'Gerolstein und Umgebung',
    30,
    '0151 10000004',
    'laura.fuchs@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000005',
    'testprofil-osteopathie-rhein-main-55116',
    'Lena Hoffmann',
    'Testprofil Osteopathie Rhein-Main',
    'Mobile Tierosteopathie mit Fokus auf Rücken und Beweglichkeit.',
    $d$Mobile Tierosteopathie mit Fokus auf Rücken und Beweglichkeit.

Qualifikationen:
Tierosteopathie Ausbildung

Leistungen:
parietale Osteopathie, Gelenkmobilisation, Faszientechniken$d$,
    'Marktplatz',
    '3',
    '55116',
    'Mainz',
    'Rheinland-Pfalz',
    'DE',
    49.9929,
    8.2473,
    'mobile',
    'Mainz, Wiesbaden, Ingelheim',
    40,
    '0151 10000005',
    'lena.hoffmann@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000006',
    'testprofil-osteopathie-pfalz-67346',
    'Clara Becker',
    'Testprofil Osteopathie Pfalz',
    'Osteopathische Behandlung bei Bewegungseinschränkungen und Verspannungen.',
    $d$Osteopathische Behandlung bei Bewegungseinschränkungen und Verspannungen.

Qualifikationen:
Tierosteopathie

Leistungen:
viszerale Osteopathie, parietale Osteopathie, Faszientechniken$d$,
    'Ludwigsplatz',
    '6',
    '67346',
    'Speyer',
    'Rheinland-Pfalz',
    'DE',
    49.3173,
    8.4319,
    'both',
    'Speyer, Neustadt, Ludwigshafen',
    35,
    '0151 10000006',
    'clara.becker@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000007',
    'testprofil-osteopathie-westerwald-56410',
    'Emma Graf',
    'Testprofil Osteopathie Westerwald',
    'Mobile Osteopathie für Pferde mit Fokus auf Becken und Losgelassenheit.',
    $d$Mobile Osteopathie für Pferde mit Fokus auf Becken und Losgelassenheit.

Qualifikationen:
Pferdeosteopathie

Leistungen:
craniosacrale Osteopathie, Gelenkmobilisation$d$,
    'Bahnhofstraße',
    '17',
    '56410',
    'Montabaur',
    'Rheinland-Pfalz',
    'DE',
    50.4359,
    7.8252,
    'mobile',
    'Montabaur, Limburg, Koblenz',
    40,
    '0151 10000007',
    'emma.graf@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000008',
    'testprofil-osteopathie-moselhof-56812',
    'Felix Schmitt',
    'Testprofil Osteopathie Moselhof',
    'Ganzheitliche Osteopathie für Hunde mit ruhigem stationärem Setting.',
    $d$Ganzheitliche Osteopathie für Hunde mit ruhigem stationärem Setting.

Qualifikationen:
Tierosteopath

Leistungen:
craniosacrale Osteopathie, Faszientechniken$d$,
    'Gartenweg',
    '2',
    '56812',
    'Cochem',
    'Rheinland-Pfalz',
    'DE',
    50.1469,
    7.1667,
    'stationary',
    'Cochem und Umgebung',
    30,
    '0151 10000008',
    'felix.schmitt@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000009',
    'testprofil-tierheilpraxis-vulkaneifel-54550',
    'Miriam Bauer',
    'Testprofil Tierheilpraxis Vulkaneifel',
    'Tierheilpraktik für Allergien, Haut und allgemeine Regulation.',
    $d$Tierheilpraktik für Allergien, Haut und allgemeine Regulation.

Qualifikationen:
Tierheilpraktikerin

Leistungen:
Akupunktur, Phytotherapie, Bachblüten$d$,
    'Eifelstraße',
    '11',
    '54550',
    'Daun',
    'Rheinland-Pfalz',
    'DE',
    50.1978,
    6.8289,
    'stationary',
    'Daun und Vulkaneifel',
    30,
    '0151 10000009',
    'miriam.bauer@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-00000000000a',
    'testprofil-tierheilpraxis-nahegarten-55543',
    'Nina Fuchs',
    'Testprofil Tierheilpraxis Nahegarten',
    'Ganzheitliche Tierheilpraktik mit Schwerpunkt Darm und Stoffwechsel.',
    $d$Ganzheitliche Tierheilpraktik mit Schwerpunkt Darm und Stoffwechsel.

Qualifikationen:
Tierheilpraktik und Ernährungsberatung

Leistungen:
Mykotherapie, Phytotherapie, Schüssler Salze$d$,
    'Guldenbachweg',
    '5',
    '55543',
    'Bad Kreuznach',
    'Rheinland-Pfalz',
    'DE',
    49.8448,
    7.8677,
    'stationary',
    'Bad Kreuznach, Bingen, Kirn',
    30,
    '0151 10000010',
    'nina.fuchs@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-00000000000b',
    'testprofil-naturtierpraxis-alzey-55232',
    'Annik Richter',
    'Testprofil Naturtierpraxis Alzey',
    'Naturheilkundliche Unterstützung für Immunsystem und Regeneration.',
    $d$Naturheilkundliche Unterstützung für Immunsystem und Regeneration.

Qualifikationen:
Tierheilpraktikerin

Leistungen:
Bioresonanz, Spagyrik, Bachblüten$d$,
    'Rheinhessenstraße',
    '14',
    '55232',
    'Alzey',
    'Rheinland-Pfalz',
    'DE',
    49.7458,
    8.1158,
    'both',
    'Alzey, Wörrstadt, Mainz',
    35,
    '0151 10000011',
    'annik.richter@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-00000000000c',
    'testprofil-tierheilpraxis-suedpfalz-66953',
    'Sophie Kranz',
    'Testprofil Tierheilpraxis Südpfalz',
    'Mobile naturheilkundliche Begleitung mit Fokus auf Schmerztherapie.',
    $d$Mobile naturheilkundliche Begleitung mit Fokus auf Schmerztherapie.

Qualifikationen:
Tierheilpraktik

Leistungen:
Blutegeltherapie, Akupunktur, Neuraltherapie$d$,
    'Sonnenstraße',
    '19',
    '66953',
    'Pirmasens',
    'Rheinland-Pfalz',
    'DE',
    49.2015,
    7.6053,
    'mobile',
    'Pirmasens, Zweibrücken, Südwestpfalz',
    40,
    '0151 10000012',
    'sophie.kranz@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-00000000000d',
    'testprofil-hufschmiede-mittelrhein-56154',
    'Paul Wagner',
    'Testprofil Hufschmiede Mittelrhein',
    'Mobiler Hufschmied mit Schwerpunkt orthopädischer Beschlag.',
    $d$Mobiler Hufschmied mit Schwerpunkt orthopädischer Beschlag.

Qualifikationen:
Geprüfter Hufschmied

Leistungen:
Klebebeschlag, Aluminium-Beschlag, Kunststoffbeschlag$d$,
    'Rheinpromenade',
    '7',
    '56154',
    'Boppard',
    'Rheinland-Pfalz',
    'DE',
    50.2309,
    7.5889,
    'mobile',
    'Boppard, Koblenz, Rhein-Hunsrück',
    40,
    '0151 10000013',
    'paul.wagner@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-00000000000e',
    'testprofil-beschlagservice-eifel-54634',
    'Lukas Brenner',
    'Testprofil Beschlagservice Eifel',
    'Mobiler Hufschmied für Spezial- und Rehebeschläge.',
    $d$Mobiler Hufschmied für Spezial- und Rehebeschläge.

Qualifikationen:
Hufschmied

Leistungen:
Klebebeschlag, Winterbeschlag, Rehebeschlag$d$,
    'Marktstraße',
    '10',
    '54634',
    'Bitburg',
    'Rheinland-Pfalz',
    'DE',
    49.9679,
    6.5273,
    'mobile',
    'Bitburg, Trier, Eifel',
    40,
    '0151 10000014',
    'lukas.brenner@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-00000000000f',
    'testprofil-sportbeschlag-pfalz-67433',
    'Tobias Winter',
    'Testprofil Sportbeschlag Pfalz',
    'Sportpferdebeschlag für Turnier- und Freizeitpferde.',
    $d$Sportpferdebeschlag für Turnier- und Freizeitpferde.

Qualifikationen:
Hufschmied

Leistungen:
Aluminium-Beschlag, Stollenbeschlag$d$,
    'Reitweg',
    '1',
    '67433',
    'Neustadt an der Weinstraße',
    'Rheinland-Pfalz',
    'DE',
    49.3502,
    8.1356,
    'mobile',
    'Neustadt, Landau, Speyer',
    40,
    '0151 10000015',
    'tobias.winter@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000010',
    'testprofil-gangpferdebeschlag-mosel-56841',
    'Jonas Reuter',
    'Testprofil Gangpferdebeschlag Mosel',
    'Mobiler Hufschmied für Gangpferde und Spezialbeschläge.',
    $d$Mobiler Hufschmied für Gangpferde und Spezialbeschläge.

Qualifikationen:
Hufschmied

Leistungen:
Duplo-Beschlag, Kunststoffbeschlag$d$,
    'Moselstraße',
    '15',
    '56841',
    'Traben-Trarbach',
    'Rheinland-Pfalz',
    'DE',
    49.9547,
    7.1172,
    'mobile',
    'Traben-Trarbach, Bernkastel, Cochem',
    40,
    '0151 10000016',
    'jonas.reuter@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000011',
    'testprofil-barhufbalance-westerwald-56564',
    'Marie Lenz',
    'Testprofil Barhufbalance Westerwald',
    'Mobile Barhufbearbeitung mit Schwerpunkt Umstellung und Hufbalance.',
    $d$Mobile Barhufbearbeitung mit Schwerpunkt Umstellung und Hufbalance.

Qualifikationen:
Barhufbearbeitung Ausbildung

Leistungen:
Hufschuhe Beratung, Barhufumstellung Betreuung$d$,
    'Wiesenweg',
    '13',
    '56564',
    'Neuwied',
    'Rheinland-Pfalz',
    'DE',
    50.4285,
    7.4615,
    'mobile',
    'Neuwied, Koblenz, Westerwald',
    40,
    '0151 10000017',
    'marie.lenz@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000012',
    'testprofil-barhufrehab-eifel-54595',
    'Sven Hartmann',
    'Testprofil Barhufrehab Eifel',
    'Barhufrehabilitation und Hufgesundheit für Pferde in der Eifel.',
    $d$Barhufrehabilitation und Hufgesundheit für Pferde in der Eifel.

Qualifikationen:
Barhufbearbeiter

Leistungen:
Rehebearbeitung, Hufschuhe Beratung$d$,
    'Bergring',
    '8',
    '54595',
    'Prüm',
    'Rheinland-Pfalz',
    'DE',
    50.2078,
    6.4209,
    'mobile',
    'Prüm, Bitburg, Daun',
    40,
    '0151 10000018',
    'sven.hartmann@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000013',
    'testprofil-barhufpraxis-suedpfalz-76829',
    'Laura Haas',
    'Testprofil Barhufpraxis Südpfalz',
    'Barhufbearbeitung und Huforthopädie mit mobilem Schwerpunkt.',
    $d$Barhufbearbeitung und Huforthopädie mit mobilem Schwerpunkt.

Qualifikationen:
Barhufbearbeitung und Huforthopädie

Leistungen:
Klebebeschlag (Übergang), Barhufumstellung Betreuung$d$,
    'Gartenstraße',
    '22',
    '76829',
    'Landau in der Pfalz',
    'Rheinland-Pfalz',
    'DE',
    49.1980,
    8.1177,
    'both',
    'Landau, Neustadt, Südpfalz',
    35,
    '0151 10000019',
    'laura.haas@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  ),
  (
    'b2000000-0000-4000-8000-000000000014',
    'testprofil-barhufzentrum-rhein-lahn-56130',
    'Noah Keller',
    'Testprofil Barhufzentrum Rhein-Lahn',
    'Mobile Barhufbearbeitung bei Fühligkeit und empfindlichen Hufen.',
    $d$Mobile Barhufbearbeitung bei Fühligkeit und empfindlichen Hufen.

Qualifikationen:
Barhufbearbeiter

Leistungen:
Hufschuhe Beratung, Rehebearbeitung$d$,
    'Lahnstraße',
    '18',
    '56130',
    'Bad Ems',
    'Rheinland-Pfalz',
    'DE',
    50.3349,
    7.7164,
    'mobile',
    'Bad Ems, Koblenz, Rhein-Lahn-Kreis',
    40,
    '0151 10000020',
    'noah.keller@example.invalid',
    'published',
    'unclaimed',
    'none',
    false,
    'import'
  );

-- Fachrichtung, Spezialisierung, Methode, Tierarten (Codes aus 20260410120000)
INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000001' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000001' AND sc.code = 'tp_rehabilitation';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000001' AND m.code = 'm_tp_laser';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000001' AND a.code IN ('pferd', 'hund');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000002' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000002' AND sc.code = 'tp_muskelaufbau';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000002' AND m.code = 'm_tp_faszien';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000002' AND a.code = 'hund';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000003' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000003' AND sc.code = 'tp_sportpferde';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000003' AND m.code = 'm_tp_ultraschall';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000003' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000004' AND s.code = 'tierphysiotherapie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000004' AND sc.code = 'tp_seniorentiere';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000004' AND m.code = 'm_tp_tens';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000004' AND a.code IN ('hund', 'katze');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000005' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000005' AND sc.code = 'to_ruecken';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000005' AND m.code = 'm_to_parietal';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000005' AND a.code IN ('pferd', 'hund');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000006' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000006' AND sc.code = 'to_bewegung';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000006' AND m.code = 'm_to_viszeral';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000006' AND a.code IN ('hund', 'pferd');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000007' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000007' AND sc.code = 'to_becken';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000007' AND m.code = 'm_to_cranio';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000007' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000008' AND s.code = 'tierosteopathie';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000008' AND sc.code = 'to_craniosacral';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000008' AND m.code = 'm_to_cranio';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000008' AND a.code = 'hund';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000009' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000009' AND sc.code = 'th_allergien';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000009' AND m.code = 'm_th_akupunktur';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000009' AND a.code IN ('hund', 'katze');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-00000000000a' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-00000000000a' AND sc.code = 'th_darm';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-00000000000a' AND m.code = 'm_th_myko';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-00000000000a' AND a.code IN ('hund', 'katze', 'kleintiere');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-00000000000b' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-00000000000b' AND sc.code = 'th_immunsystem';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-00000000000b' AND m.code = 'm_th_bioresonanz';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-00000000000b' AND a.code IN ('hund', 'katze');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-00000000000c' AND s.code = 'tierheilpraktik';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-00000000000c' AND sc.code = 'th_schmerz';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-00000000000c' AND m.code = 'm_th_blutegel';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-00000000000c' AND a.code IN ('hund', 'pferd');

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-00000000000d' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-00000000000d' AND sc.code = 'hs_orthopaedie';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-00000000000d' AND m.code = 'm_hs_klebe';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-00000000000d' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-00000000000e' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-00000000000e' AND sc.code = 'hs_rehe';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-00000000000e' AND m.code = 'm_hs_winter';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-00000000000e' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-00000000000f' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-00000000000f' AND sc.code = 'hs_sportpferd';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-00000000000f' AND m.code = 'm_hs_alu';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-00000000000f' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000010' AND s.code = 'hufschmied';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000010' AND sc.code = 'hs_gangpferd';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000010' AND m.code = 'm_hs_duplo';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000010' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000011' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000011' AND sc.code = 'bh_umstellung';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000011' AND m.code = 'm_bh_umstellung_betreuung';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000011' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000012' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000012' AND sc.code = 'bh_hufreha';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000012' AND m.code = 'm_bh_rehe';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000012' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000013' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000013' AND sc.code = 'bh_ortho';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000013' AND m.code = 'm_bh_klebe_uebergang';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000013' AND a.code = 'pferd';

INSERT INTO public.directory_profile_specialties (directory_profile_id, directory_specialty_id, is_primary)
SELECT p.id, s.id, true FROM public.directory_profiles p, public.directory_specialties s
WHERE p.id = 'b2000000-0000-4000-8000-000000000014' AND s.code = 'barhufbearbeitung';
INSERT INTO public.directory_profile_subcategories (directory_profile_id, directory_subcategory_id)
SELECT p.id, sc.id FROM public.directory_profiles p, public.directory_subcategories sc
WHERE p.id = 'b2000000-0000-4000-8000-000000000014' AND sc.code = 'bh_fuehligkeit';
INSERT INTO public.directory_profile_methods (directory_profile_id, directory_method_id)
SELECT p.id, m.id FROM public.directory_profiles p, public.directory_methods m
WHERE p.id = 'b2000000-0000-4000-8000-000000000014' AND m.code = 'm_bh_hufschuhe';
INSERT INTO public.directory_profile_animal_types (directory_profile_id, directory_animal_type_id)
SELECT p.id, a.id FROM public.directory_profiles p, public.directory_animal_types a
WHERE p.id = 'b2000000-0000-4000-8000-000000000014' AND a.code = 'pferd';

-- Quellen
INSERT INTO public.directory_profile_sources (
  directory_profile_id,
  primary_source_url,
  source_type,
  data_quality,
  external_key
)
SELECT
  id,
  'https://example.invalid/' || slug,
  'manual_research',
  'reviewed',
  'rlp-seed-' || slug
FROM public.directory_profiles
WHERE id::text LIKE 'b2000000-0000-4000-8000-%';

-- Website je Profil
INSERT INTO public.directory_profile_social_links (directory_profile_id, platform, url, sort_order)
SELECT id, 'website', 'https://example.invalid/' || slug, 0
FROM public.directory_profiles
WHERE id::text LIKE 'b2000000-0000-4000-8000-%';

INSERT INTO public.directory_profile_social_links (directory_profile_id, platform, url, sort_order) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'instagram', 'https://instagram.com/testprofil_rheinblick', 1),
  ('b2000000-0000-4000-8000-000000000002', 'facebook', 'https://facebook.com/testprofil.moselpfote', 1),
  ('b2000000-0000-4000-8000-000000000005', 'instagram', 'https://instagram.com/testprofil.osteo.rheinmain', 1),
  ('b2000000-0000-4000-8000-000000000006', 'linkedin', 'https://linkedin.com/company/testprofil-osteopathie-pfalz', 1),
  ('b2000000-0000-4000-8000-000000000007', 'facebook', 'https://facebook.com/testprofil.osteopathie.westerwald', 1),
  ('b2000000-0000-4000-8000-00000000000a', 'instagram', 'https://instagram.com/testprofil.nahegarten', 1),
  ('b2000000-0000-4000-8000-00000000000b', 'facebook', 'https://facebook.com/testprofil.naturtierpraxis.alzey', 1),
  ('b2000000-0000-4000-8000-00000000000d', 'instagram', 'https://instagram.com/testprofil.hufschmiede.mittelrhein', 1),
  ('b2000000-0000-4000-8000-00000000000f', 'facebook', 'https://facebook.com/testprofil.sportbeschlag.pfalz', 1),
  ('b2000000-0000-4000-8000-000000000011', 'instagram', 'https://instagram.com/testprofil.barhufbalance', 1),
  ('b2000000-0000-4000-8000-000000000012', 'facebook', 'https://facebook.com/testprofil.barhufrehab.eifel', 1),
  ('b2000000-0000-4000-8000-000000000014', 'linkedin', 'https://linkedin.com/company/testprofil-barhufzentrum-rhein-lahn', 1);

-- Platzhalter-Logo wo JSON „bilder_vorhanden“: true
INSERT INTO public.directory_profile_media (directory_profile_id, media_type, url, sort_order, alt_text)
SELECT id, 'logo', 'https://picsum.photos/seed/rlp-dir-' || slug || '/200/200', 0, 'Test-Logo (Platzhalter)'
FROM public.directory_profiles
WHERE id IN (
  'b2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  'b2000000-0000-4000-8000-000000000005',
  'b2000000-0000-4000-8000-000000000008',
  'b2000000-0000-4000-8000-000000000009',
  'b2000000-0000-4000-8000-00000000000c',
  'b2000000-0000-4000-8000-00000000000d',
  'b2000000-0000-4000-8000-000000000011',
  'b2000000-0000-4000-8000-000000000014'
);
