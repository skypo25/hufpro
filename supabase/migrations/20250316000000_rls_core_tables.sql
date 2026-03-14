-- RLS für Kerntabellen: Nur eigener user_id-Zugriff (Multi-Tenant-Isolation).
-- Voraussetzung: Tabellen horses, customers, appointments, appointment_horses, hoof_records, hoof_photos existieren und haben user_id.
-- TO authenticated, anon: Supabase-Client sendet oft anon-Rolle mit JWT; auth.uid() bleibt durch JWT gesetzt.

-- horses
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own horses" ON horses;
CREATE POLICY "Users can manage own horses"
  ON horses FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own customers" ON customers;
CREATE POLICY "Users can manage own customers"
  ON customers FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own appointments" ON appointments;
CREATE POLICY "Users can manage own appointments"
  ON appointments FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- appointment_horses (Verknüpfung Termin <-> Pferde)
ALTER TABLE appointment_horses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own appointment_horses" ON appointment_horses;
CREATE POLICY "Users can manage own appointment_horses"
  ON appointment_horses FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- hoof_records
ALTER TABLE hoof_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own hoof_records" ON hoof_records;
CREATE POLICY "Users can manage own hoof_records"
  ON hoof_records FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- hoof_photos
ALTER TABLE hoof_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own hoof_photos" ON hoof_photos;
CREATE POLICY "Users can manage own hoof_photos"
  ON hoof_photos FOR ALL
  TO authenticated, anon
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
