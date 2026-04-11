-- Directory: Spezialisierungen (Subcategories), Methoden/Leistungen, Profil-Zuordnungen,
-- Public-Views, RLS für Owner. Fachrichtungen-Seed an Zielbild angeglichen.
--
-- WICHTIG (Supabase SQL Editor / manuell): Diese Datei nur EINMAL als Migration laufen lassen.
-- Wenn directory_subcategories / directory_methods schon existieren → 42P07 „already exists“.
-- Dann NICHT den ganzen Inhalt erneut ausführen. Stattdessen:
--   • nur Public-Views: Migration 20260415120000_directory_public_taxonomy_specialty_code.sql
--   • Views + fehlende Referenz-Zeilen: 20260416100000_directory_taxonomy_repair_views_and_seeds.sql

-- ---------------------------------------------------------------------------
-- 1) Fachrichtungen: fünf Hauptkategorien + optionale (inaktive) Einträge
-- ---------------------------------------------------------------------------

-- Alte Gruppierung „Hufbearbeitung“ als Elternkategorie aus Listing ausblenden (FK-Stabilität).
UPDATE public.directory_specialties
SET is_active = false
WHERE code = 'hufbearbeitung';

-- Barhufbearbeitung ist eigenständige Hauptkategorie (nicht mehr Kind von hufbearbeitung).
UPDATE public.directory_specialties
SET parent_specialty_id = NULL,
    sort_order = 50,
    name = 'Barhufbearbeitung'
WHERE code = 'barhufbearbeitung';

UPDATE public.directory_specialties
SET sort_order = 10
WHERE code = 'tierphysiotherapie';

UPDATE public.directory_specialties
SET sort_order = 20
WHERE code = 'tierosteopathie';

UPDATE public.directory_specialties
SET sort_order = 30
WHERE code = 'tierheilpraktik';

UPDATE public.directory_specialties
SET sort_order = 40,
    name = 'Hufschmied'
WHERE code = 'hufschmied';

INSERT INTO public.directory_specialties (code, name, sort_order, is_active, parent_specialty_id)
VALUES
  ('tierchiropraktik', 'Tierchiropraktik', 60, false, NULL),
  ('tierernaehrungsberatung', 'Tierernährungsberatung', 70, false, NULL),
  ('tierverhaltenstherapie', 'Tierverhaltenstherapie', 80, false, NULL),
  ('tierzahnarzt', 'Tierzahnarzt / Pferdedentist', 90, false, NULL),
  ('sattler', 'Sattler', 100, false, NULL)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  parent_specialty_id = EXCLUDED.parent_specialty_id;

-- ---------------------------------------------------------------------------
-- 2) Referenz: Spezialisierungen (Unterkategorien je Fachrichtung)
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  directory_specialty_id uuid NOT NULL REFERENCES public.directory_specialties (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  CONSTRAINT directory_subcategories_code_unique UNIQUE (code),
  CONSTRAINT directory_subcategories_sort_order_check CHECK (sort_order >= 0)
);

CREATE INDEX directory_subcategories_specialty_idx
  ON public.directory_subcategories (directory_specialty_id);

COMMENT ON TABLE public.directory_subcategories IS
  'Verzeichnis: Spezialisierungen/Unterkategorien je Fachrichtung (Referenz + Filter).';

-- ---------------------------------------------------------------------------
-- 3) Referenz: Methoden / Leistungen (optional einer Fachrichtung zugeordnet)
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  directory_specialty_id uuid REFERENCES public.directory_specialties (id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  CONSTRAINT directory_methods_code_unique UNIQUE (code),
  CONSTRAINT directory_methods_sort_order_check CHECK (sort_order >= 0)
);

CREATE INDEX directory_methods_specialty_idx
  ON public.directory_methods (directory_specialty_id);

COMMENT ON TABLE public.directory_methods IS
  'Verzeichnis: Methoden/Leistungen; directory_specialty_id NULL = generisch oder UI-gruppiert.';

-- ---------------------------------------------------------------------------
-- 4) n:m Profil ↔ Spezialisierung / Methode
-- ---------------------------------------------------------------------------

CREATE TABLE public.directory_profile_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  directory_subcategory_id uuid NOT NULL REFERENCES public.directory_subcategories (id) ON DELETE RESTRICT,

  CONSTRAINT directory_profile_subcategories_profile_sub_unique
    UNIQUE (directory_profile_id, directory_subcategory_id)
);

CREATE INDEX directory_profile_subcategories_profile_idx
  ON public.directory_profile_subcategories (directory_profile_id);

CREATE INDEX directory_profile_subcategories_sub_idx
  ON public.directory_profile_subcategories (directory_subcategory_id);

COMMENT ON TABLE public.directory_profile_subcategories IS
  'Verzeichnis: n:m Profil ↔ Spezialisierung (Owner bearbeitbar nach Claim).';

CREATE TABLE public.directory_profile_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_profile_id uuid NOT NULL REFERENCES public.directory_profiles (id) ON DELETE CASCADE,
  directory_method_id uuid NOT NULL REFERENCES public.directory_methods (id) ON DELETE RESTRICT,

  CONSTRAINT directory_profile_methods_profile_method_unique
    UNIQUE (directory_profile_id, directory_method_id)
);

CREATE INDEX directory_profile_methods_profile_idx
  ON public.directory_profile_methods (directory_profile_id);

CREATE INDEX directory_profile_methods_method_idx
  ON public.directory_profile_methods (directory_method_id);

COMMENT ON TABLE public.directory_profile_methods IS
  'Verzeichnis: n:m Profil ↔ Methode/Leistung (Owner bearbeitbar nach Claim).';

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.directory_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_profile_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_profile_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY directory_subcategories_authenticated_select_active
  ON public.directory_subcategories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY directory_methods_authenticated_select_active
  ON public.directory_methods
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY directory_profile_subcategories_owner_select
  ON public.directory_profile_subcategories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_subcategories.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_subcategories_owner_insert
  ON public.directory_profile_subcategories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_subcategories.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_subcategories_owner_update
  ON public.directory_profile_subcategories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_subcategories.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_subcategories.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_subcategories_owner_delete
  ON public.directory_profile_subcategories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_subcategories.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_methods_owner_select
  ON public.directory_profile_methods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_methods.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_methods_owner_insert
  ON public.directory_profile_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_methods.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_methods_owner_update
  ON public.directory_profile_methods
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_methods.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_methods.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY directory_profile_methods_owner_delete
  ON public.directory_profile_methods
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.directory_profiles p
      WHERE p.id = directory_profile_methods.directory_profile_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Grants (anon: kein Direktzugriff; Public nur über Views)
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.directory_subcategories FROM PUBLIC;
REVOKE ALL ON public.directory_methods FROM PUBLIC;
REVOKE ALL ON public.directory_profile_subcategories FROM PUBLIC;
REVOKE ALL ON public.directory_profile_methods FROM PUBLIC;

GRANT SELECT ON public.directory_subcategories TO authenticated;
GRANT SELECT ON public.directory_methods TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_profile_subcategories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_profile_methods TO authenticated;

REVOKE ALL ON public.directory_subcategories FROM anon;
REVOKE ALL ON public.directory_methods FROM anon;
REVOKE ALL ON public.directory_profile_subcategories FROM anon;
REVOKE ALL ON public.directory_profile_methods FROM anon;

-- ---------------------------------------------------------------------------
-- 7) Öffentliche Views (nur published Profile)
-- ---------------------------------------------------------------------------

CREATE VIEW public.directory_public_subcategories
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.code,
  s.name,
  s.directory_specialty_id,
  s.sort_order
FROM public.directory_subcategories s
WHERE s.is_active = true;

CREATE VIEW public.directory_public_methods
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.code,
  m.name,
  m.directory_specialty_id,
  m.sort_order
FROM public.directory_methods m
WHERE m.is_active = true;

CREATE VIEW public.directory_public_profile_subcategories
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_subcategory_id
FROM public.directory_profile_subcategories j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text;

CREATE VIEW public.directory_public_profile_methods
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.directory_profile_id,
  j.directory_method_id
FROM public.directory_profile_methods j
INNER JOIN public.directory_profiles p ON p.id = j.directory_profile_id
WHERE p.listing_status = 'published'::text;

GRANT SELECT ON public.directory_public_subcategories TO anon, authenticated;
GRANT SELECT ON public.directory_public_methods TO anon, authenticated;
GRANT SELECT ON public.directory_public_profile_subcategories TO anon, authenticated;
GRANT SELECT ON public.directory_public_profile_methods TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8) Seeds: Spezialisierungen
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 9) Seeds: Methoden (directory_specialty_id zur Gruppierung / spätere Filter)
-- ---------------------------------------------------------------------------

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

COMMENT ON TABLE public.directory_specialties IS
  'Verzeichnis: Fachrichtungen. Aktive Hauptcodes: tierphysiotherapie, tierosteopathie, tierheilpraktik, hufschmied, barhufbearbeitung; hufbearbeitung historisch inaktiv; weitere Codes optional inaktiv.';
