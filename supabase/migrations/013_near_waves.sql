-- JIY Near — mutual Selam / Wave unlock edges

CREATE TABLE IF NOT EXISTS near_waves (
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_wallet, to_wallet)
);

CREATE INDEX IF NOT EXISTS idx_near_waves_to
  ON near_waves(to_wallet, created_at DESC);

ALTER TABLE near_waves ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE near_waves IS
  'JIY Near mutual-wave unlock — free Selam or Wave gift; API service role only.';
