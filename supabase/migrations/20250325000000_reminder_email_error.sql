-- Letzte Fehlermeldung beim Erinnerungsversand (für Support / Nachvollziehbarkeit)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_email_error text;

COMMENT ON COLUMN appointments.reminder_email_error IS 'Letzter SMTP-/Versandfehler; nach erfolgreichem Versand geleert';
