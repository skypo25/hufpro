-- Termin-E-Mail-Erinnerungen: Vorlaufzeit pro Termin, Versandstatus (kein Doppelversand)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_minutes_before integer,
  ADD COLUMN IF NOT EXISTS reminder_email_sent_at timestamptz;

COMMENT ON COLUMN appointments.reminder_minutes_before IS 'Vorlauf bis zum Terminbeginn in Minuten (z. B. 1440 = 24h); NULL = keine automatische E-Mail-Erinnerung';
COMMENT ON COLUMN appointments.reminder_email_sent_at IS 'Zeitpunkt, zu dem die E-Mail-Erinnerung erfolgreich versendet wurde';

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_pending
  ON appointments (appointment_date)
  WHERE reminder_minutes_before IS NOT NULL AND reminder_email_sent_at IS NULL;
