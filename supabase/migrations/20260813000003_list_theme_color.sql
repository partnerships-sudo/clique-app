-- Add theme_color to lists so Gold members can customise their list accent colour
ALTER TABLE lists ADD COLUMN IF NOT EXISTS theme_color text DEFAULT NULL;
