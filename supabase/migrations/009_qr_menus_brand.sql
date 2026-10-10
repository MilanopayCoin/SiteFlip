-- JIY Menu brand fields (accent + logo) + locale
ALTER TABLE qr_menus
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'tr'
    CHECK (locale IN ('tr', 'en')),
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#D4FF3A',
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
