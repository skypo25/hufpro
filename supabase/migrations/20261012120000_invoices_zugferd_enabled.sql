-- Pro Rechnung: ZUGFeRD/E-Rechnung (EN 16931) einbetten oder nicht.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS zugferd_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN invoices.zugferd_enabled IS
  'Wenn true: PDF/E-Mail mit ZUGFeRD EN 16931; sonst normales PDF.';
