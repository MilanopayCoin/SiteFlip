-- JIY Near — 60s gift score duels between mutual-Selam peers

CREATE TABLE IF NOT EXISTS near_duels (
  id TEXT PRIMARY KEY,
  a_wallet TEXT NOT NULL,
  b_wallet TEXT NOT NULL,
  a_score INTEGER NOT NULL DEFAULT 0,
  b_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  winner_wallet TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_duels_a ON near_duels(a_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_near_duels_b ON near_duels(b_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_near_duels_status ON near_duels(status);

ALTER TABLE near_duels ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE near_duels IS
  'JIY Near gift duels — 60s score race; gifts A→B credit A; API service role only.';
