-- Einstellungen pro Benutzer (Betriebsdaten, Rechnung, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE user_settings IS 'Betriebs- und Rechnungseinstellungen des Hufbearbeiters';
COMMENT ON COLUMN user_settings.settings IS 'JSON: persönliche Daten, Adresse, Steuer, Bank, Logo, Leistungen, etc.';

-- RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);
