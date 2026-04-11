-- Reparatur / Nachziehen: Public-Views für Subcategories & Methods + idempotente Referenz-Seeds.
--
-- Nutzen:
--   • 42P07 nach erneutem Ausführen von 20260410120000_* (Tabellen existieren schon) — diese Datei
--     enthält KEIN CREATE TABLE.
--   • Leere directory_public_subcategories-View: oft fehlen Zeilen in directory_subcategories
--     oder die View-Spalte directory_specialty_code fehlt — hier werden Views neu erzeugt und
--     Seeds per ON CONFLICT nachgezogen.
--
-- Voraussetzung: Tabellen directory_subcategories, directory_methods, directory_specialties existieren.

DROP VIEW IF EXISTS public.directory_public_methods;
DROP VIEW IF EXISTS public.directory_public_subcategories;

CREATE VIEW public.directory_public_subcategories
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.code,
  s.name,
  s.directory_specialty_id,
  sp.code AS directory_specialty_code,
  s.sort_order
FROM public.directory_subcategories s
INNER JOIN public.directory_specialties sp ON sp.id = s.directory_specialty_id
WHERE s.is_active = true
  AND sp.is_active = true;

CREATE VIEW public.directory_public_methods
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.code,
  m.name,
  m.directory_specialty_id,
  sp.code AS directory_specialty_code,
  m.sort_order
FROM public.directory_methods m
LEFT JOIN public.directory_specialties sp ON sp.id = m.directory_specialty_id
WHERE m.is_active = true
  AND (
    m.directory_specialty_id IS NULL
    OR (sp.id IS NOT NULL AND sp.is_active = true)
  );

GRANT SELECT ON public.directory_public_subcategories TO anon, authenticated;
GRANT SELECT ON public.directory_public_methods TO anon, authenticated;

-- Idempotent (gleiche Logik wie 20260410120000 Abschnitt 8–9)
INSERT INTO public.directory_subcategories (code, name, directory_specialty_id, sort_order, is_active)
SELECT v.code, v.name, sp.id, v.ord, true
FROM (VALUES
  ('tp_rehabilitation', 'Rehabilitation', 'tierphysiotherapie', 10),
  ('tp_muskelaufbau', 'Muskelaufbau', 'tierphysiotherapie', 20),
  ('tp_ganganalyse', 'Ganganalyse', 'tierphysiotherapie', 30),
  ('tp_neuro_reha', 'Neurologische Rehabilitation', 'tierphysiotherapie', 40),
  ('tp_schmerztherapie', 'Schmerztherapie', 'tierphysiotherapie', 50),
  ('tp_sportpferde', 'Sportpferde', 'tierphysiotherapie', 60),
  ('tp_seniorentiere', 'Seniorentiere', 'tierphysiotherapie', 70),
  ('to_ruecken', 'Rückenprobleme', 'tierosteopathie', 10),
  ('to_bewegung', 'Bewegungseinschränkungen', 'tierosteopathie', 20),
  ('to_becken', 'Beckenschiefstand', 'tierosteopathie', 30),
  ('to_kiefer', 'Kiefergelenk', 'tierosteopathie', 40),
  ('to_craniosacral', 'Craniosakrale Osteopathie', 'tierosteopathie', 50),
  ('to_viszeral', 'Viszerale Osteopathie', 'tierosteopathie', 60),
  ('th_allergien', 'Allergien', 'tierheilpraktik', 10),
  ('th_haut', 'Hautprobleme', 'tierheilpraktik', 20),
  ('th_stoffwechsel', 'Stoffwechsel', 'tierheilpraktik', 30),
  ('th_darm', 'Darmsanierung', 'tierheilpraktik', 40),
  ('th_immunsystem', 'Immunsystem', 'tierheilpraktik', 50),
  ('th_schmerz', 'Schmerztherapie', 'tierheilpraktik', 60),
  ('th_entgiftung', 'Entgiftung', 'tierheilpraktik', 70),
  ('hs_orthopaedie', 'Orthopädischer Beschlag', 'hufschmied', 10),
  ('hs_sportpferd', 'Sportpferdebeschlag', 'hufschmied', 20),
  ('hs_rehe', 'Rehebeschlag', 'hufschmied', 30),
  ('hs_korrektur', 'Korrekturbeschlag', 'hufschmied', 40),
  ('hs_gangpferd', 'Gangpferdebeschlag', 'hufschmied', 50),
  ('bh_umstellung', 'Barhufumstellung', 'barhufbearbeitung', 10),
  ('bh_hufreha', 'Hufrehabilitation', 'barhufbearbeitung', 20),
  ('bh_rehe', 'Rehebearbeitung', 'barhufbearbeitung', 30),
  ('bh_ortho', 'Huforthopädie', 'barhufbearbeitung', 40),
  ('bh_fuehligkeit', 'Fühligkeit', 'barhufbearbeitung', 50),
  ('bh_zwanghufe', 'Zwanghufe', 'barhufbearbeitung', 60)
) AS v(code, name, spec_code, ord)
INNER JOIN public.directory_specialties sp ON sp.code = v.spec_code
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  directory_specialty_id = EXCLUDED.directory_specialty_id,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

INSERT INTO public.directory_methods (code, name, directory_specialty_id, sort_order, is_active)
SELECT v.code, v.name, sp.id, v.ord, true
FROM (VALUES
  ('m_tp_massage', 'Massage', 'tierphysiotherapie', 10),
  ('m_tp_manuell', 'Manuelle Therapie', 'tierphysiotherapie', 20),
  ('m_tp_laser', 'Lasertherapie', 'tierphysiotherapie', 30),
  ('m_tp_ultraschall', 'Ultraschalltherapie', 'tierphysiotherapie', 40),
  ('m_tp_elektro', 'Elektrotherapie', 'tierphysiotherapie', 50),
  ('m_tp_tens', 'TENS', 'tierphysiotherapie', 60),
  ('m_tp_taping', 'Kinesiotaping', 'tierphysiotherapie', 70),
  ('m_tp_dry_needling', 'Dry Needling', 'tierphysiotherapie', 80),
  ('m_tp_faszien', 'Faszientherapie', 'tierphysiotherapie', 90),
  ('m_tp_uwl', 'Unterwasserlaufband', 'tierphysiotherapie', 100),
  ('m_to_parietal', 'Parietale Osteopathie', 'tierosteopathie', 10),
  ('m_to_cranio', 'Craniosakrale Osteopathie', 'tierosteopathie', 20),
  ('m_to_viszeral', 'Viszerale Osteopathie', 'tierosteopathie', 30),
  ('m_to_faszien', 'Faszientechniken', 'tierosteopathie', 40),
  ('m_to_gelenk', 'Gelenkmobilisation', 'tierosteopathie', 50),
  ('m_th_akupunktur', 'Akupunktur', 'tierheilpraktik', 10),
  ('m_th_blutegel', 'Blutegeltherapie', 'tierheilpraktik', 20),
  ('m_th_homoeo', 'Homöopathie', 'tierheilpraktik', 30),
  ('m_th_phyto', 'Phytotherapie', 'tierheilpraktik', 40),
  ('m_th_myko', 'Mykotherapie', 'tierheilpraktik', 50),
  ('m_th_bach', 'Bachblüten', 'tierheilpraktik', 60),
  ('m_th_bioresonanz', 'Bioresonanz', 'tierheilpraktik', 70),
  ('m_th_neural', 'Neuraltherapie', 'tierheilpraktik', 80),
  ('m_th_schuessler', 'Schüssler-Salze', 'tierheilpraktik', 90),
  ('m_th_spagyrik', 'Spagyrik', 'tierheilpraktik', 100),
  ('m_hs_klebe', 'Klebebeschlag', 'hufschmied', 10),
  ('m_hs_alu', 'Aluminium-Beschlag', 'hufschmied', 20),
  ('m_hs_kunststoff', 'Kunststoffbeschlag', 'hufschmied', 30),
  ('m_hs_duplo', 'Duplo-Beschlag', 'hufschmied', 40),
  ('m_hs_stollen', 'Stollenbeschlag', 'hufschmied', 50),
  ('m_hs_winter', 'Winterbeschlag', 'hufschmied', 60),
  ('m_bh_hufschuhe', 'Hufschuhe Beratung', 'barhufbearbeitung', 10),
  ('m_bh_klebe_uebergang', 'Klebebeschlag (Übergang)', 'barhufbearbeitung', 20),
  ('m_bh_rehe', 'Rehebearbeitung', 'barhufbearbeitung', 30),
  ('m_bh_umstellung_betreuung', 'Barhufumstellung Betreuung', 'barhufbearbeitung', 40)
) AS v(code, name, spec_code, ord)
INNER JOIN public.directory_specialties sp ON sp.code = v.spec_code
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  directory_specialty_id = EXCLUDED.directory_specialty_id,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
