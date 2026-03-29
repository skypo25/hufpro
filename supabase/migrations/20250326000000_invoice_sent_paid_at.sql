-- Nachvollziehbarkeit Zahlungsfluss (Versand / Zahlungseingang)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN invoices.sent_at IS 'Zeitpunkt, ab dem die Rechnung als versendet (offen) geführt wird; gesetzt beim ersten Übergang in Status „sent“';
COMMENT ON COLUMN invoices.paid_at IS 'Zeitpunkt des Zahlungseingangs; gesetzt bei Status „paid“, geleert bei erneut „offen“';
