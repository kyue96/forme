-- Add 'system' as a valid theme_mode option
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_theme_mode_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_theme_mode_check CHECK (theme_mode IN ('light', 'dark', 'system'));
