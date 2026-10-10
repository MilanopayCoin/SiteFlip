-- JIY Menu smart guest features: specials + waiter calls
ALTER TABLE qr_menus
  ADD COLUMN IF NOT EXISTS special JSONB;

CREATE TABLE IF NOT EXISTS qr_menu_calls (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES qr_menus(id) ON DELETE CASCADE,
  table_label TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acked', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_menu_calls_menu
  ON qr_menu_calls(menu_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_menu_calls_open
  ON qr_menu_calls(menu_id, status)
  WHERE status = 'open';

ALTER TABLE qr_menu_calls ENABLE ROW LEVEL SECURITY;
