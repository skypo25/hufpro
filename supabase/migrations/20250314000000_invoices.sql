-- Rechnungen (§14 UStG / GoBD-konform)
-- Rechnungsnummer eindeutig pro User, fortlaufend

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  service_date_from date,
  service_date_to date,
  payment_due_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  intro_text text,
  footer_text text,
  buyer_name text,
  buyer_company text,
  buyer_street text,
  buyer_zip text,
  buyer_city text,
  buyer_country text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, invoice_number)
);

COMMENT ON COLUMN invoices.buyer_name IS 'Rechnungsadresse: Name (wenn kein customer_id oder Snapshot)';
COMMENT ON COLUMN invoices.buyer_street IS 'Rechnungsadresse: Straße';
COMMENT ON COLUMN invoices.buyer_zip IS 'Rechnungsadresse: PLZ';
COMMENT ON COLUMN invoices.buyer_city IS 'Rechnungsadresse: Ort';
COMMENT ON COLUMN invoices.buyer_country IS 'Rechnungsadresse: Land';

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);

COMMENT ON TABLE invoices IS 'Rechnungen; §14 UStG / GoBD';
COMMENT ON COLUMN invoices.invoice_number IS 'Eindeutige Rechnungsnummer (z.B. HUF-2026-0001)';
COMMENT ON COLUMN invoices.service_date_from IS 'Leistungszeitraum Beginn';
COMMENT ON COLUMN invoices.service_date_to IS 'Leistungszeitraum Ende';

-- Rechnungspositionen (Art, Menge, Einzelpreis, Betrag)
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 1,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price_cents int NOT NULL,
  amount_cents int NOT NULL,
  tax_rate_percent numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

COMMENT ON TABLE invoice_items IS 'Rechnungspositionen; Nettopreise in Cent';
COMMENT ON COLUMN invoice_items.unit_price_cents IS 'Nettopreis pro Einheit in Cent';
COMMENT ON COLUMN invoice_items.amount_cents IS 'Gesamtbetrag Position in Cent (quantity * unit_price)';
COMMENT ON COLUMN invoice_items.tax_rate_percent IS '0 = Kleinunternehmer; sonst z.B. 19';

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invoices"
  ON invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage items of own invoices"
  ON invoice_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())
  );
