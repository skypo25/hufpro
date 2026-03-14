-- Token für Kunden-Bestätigung von vorgeschlagenen Terminen (Link in E-Mail)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS confirmation_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_confirmation_token
  ON appointments (confirmation_token)
  WHERE confirmation_token IS NOT NULL;

COMMENT ON COLUMN appointments.confirmation_token IS 'Einmaliger Token für Bestätigungs-Link (E-Mail bei Status Vorgeschlagen)';
COMMENT ON COLUMN appointments.confirmation_token_expires_at IS 'Ablaufdatum des Bestätigungs-Links';
