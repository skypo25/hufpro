-- Nach Abo-Kündigung: 10 Tage Export/Lese-Zugang; danach keine Schreibzugriffe mehr (RLS).
-- post_cancel_access_until = Ende des Exportfensters (UTC).

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS post_cancel_access_until timestamptz;

COMMENT ON COLUMN billing_accounts.post_cancel_access_until IS
  'Nach Stripe subscription.canceled: bis zu diesem Zeitpunkt Lesen + Export; Schreiben gesperrt sobald status=canceled.';

CREATE OR REPLACE FUNCTION public.user_can_write_own_data()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT ba.subscription_status IS DISTINCT FROM 'canceled'
      FROM billing_accounts ba
      WHERE ba.user_id = auth.uid()
    ),
    true
  );
$$;

COMMENT ON FUNCTION public.user_can_write_own_data() IS
  'FALSE sobald Stripe-Abonnement gekündigt (canceled) — Read-only bis post_cancel_access_until, App sperrt danach.';

-- ─── horses ───
DROP POLICY IF EXISTS "Users can manage own horses" ON horses;
CREATE POLICY "Users can select own horses"
  ON horses FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own horses"
  ON horses FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own horses"
  ON horses FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own horses"
  ON horses FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── customers ───
DROP POLICY IF EXISTS "Users can manage own customers" ON customers;
CREATE POLICY "Users can select own customers"
  ON customers FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers"
  ON customers FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own customers"
  ON customers FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own customers"
  ON customers FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── appointments ───
DROP POLICY IF EXISTS "Users can manage own appointments" ON appointments;
CREATE POLICY "Users can select own appointments"
  ON appointments FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own appointments"
  ON appointments FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own appointments"
  ON appointments FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own appointments"
  ON appointments FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── appointment_horses ───
DROP POLICY IF EXISTS "Users can manage own appointment_horses" ON appointment_horses;
CREATE POLICY "Users can select own appointment_horses"
  ON appointment_horses FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own appointment_horses"
  ON appointment_horses FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own appointment_horses"
  ON appointment_horses FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own appointment_horses"
  ON appointment_horses FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── hoof_records ───
DROP POLICY IF EXISTS "Users can manage own hoof_records" ON hoof_records;
CREATE POLICY "Users can select own hoof_records"
  ON hoof_records FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hoof_records"
  ON hoof_records FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own hoof_records"
  ON hoof_records FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own hoof_records"
  ON hoof_records FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── hoof_photos ───
DROP POLICY IF EXISTS "Users can manage own hoof_photos" ON hoof_photos;
CREATE POLICY "Users can select own hoof_photos"
  ON hoof_photos FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hoof_photos"
  ON hoof_photos FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own hoof_photos"
  ON hoof_photos FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own hoof_photos"
  ON hoof_photos FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── documentation_records ───
DROP POLICY IF EXISTS "Users can manage own documentation_records" ON public.documentation_records;
CREATE POLICY "Users can select own documentation_records"
  ON public.documentation_records FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documentation_records"
  ON public.documentation_records FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own documentation_records"
  ON public.documentation_records FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own documentation_records"
  ON public.documentation_records FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── documentation_photos ───
DROP POLICY IF EXISTS "Users can manage own documentation_photos" ON public.documentation_photos;
CREATE POLICY "Users can select own documentation_photos"
  ON public.documentation_photos FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documentation_photos"
  ON public.documentation_photos FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own documentation_photos"
  ON public.documentation_photos FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own documentation_photos"
  ON public.documentation_photos FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── invoices ───
DROP POLICY IF EXISTS "Users can manage own invoices" ON invoices;
CREATE POLICY "Users can select own invoices"
  ON invoices FOR SELECT TO authenticated, anon
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices"
  ON invoices FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can update own invoices"
  ON invoices FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data())
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());
CREATE POLICY "Users can delete own invoices"
  ON invoices FOR DELETE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());

-- ─── invoice_items ───
DROP POLICY IF EXISTS "Users can manage items of own invoices" ON invoice_items;
CREATE POLICY "Users can select items of own invoices"
  ON invoice_items FOR SELECT TO authenticated, anon
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
CREATE POLICY "Users can insert items of own invoices"
  ON invoice_items FOR INSERT TO authenticated, anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
    AND public.user_can_write_own_data()
  );
CREATE POLICY "Users can update items of own invoices"
  ON invoice_items FOR UPDATE TO authenticated, anon
  USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
    AND public.user_can_write_own_data()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
    AND public.user_can_write_own_data()
  );
CREATE POLICY "Users can delete items of own invoices"
  ON invoice_items FOR DELETE TO authenticated, anon
  USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
    AND public.user_can_write_own_data()
  );

-- ─── user_settings ───
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT TO authenticated, anon
  WITH CHECK (auth.uid() = user_id AND public.user_can_write_own_data());

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE TO authenticated, anon
  USING (auth.uid() = user_id AND public.user_can_write_own_data());
