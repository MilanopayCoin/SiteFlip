-- JIY QR Menu — free digital menus (guest edit-token ownership)
-- Service-role API access only; RLS on, no public policies.

CREATE TABLE IF NOT EXISTS qr_menus (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR'
    CHECK (currency IN ('EUR', 'TRY', 'USD', 'GBP')),
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  edit_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_menus_slug ON qr_menus(slug);
CREATE INDEX IF NOT EXISTS idx_qr_menus_updated ON qr_menus(updated_at DESC);

ALTER TABLE qr_menus ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE qr_menus IS
  'JIY QR Menu — free public digital menus. Edit via secret edit_token through API (service role).';
