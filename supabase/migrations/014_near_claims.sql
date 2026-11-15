-- JIY Near — ephemeral table / venue claims (pin in place room)

CREATE TABLE IF NOT EXISTS near_table_claims (
  id TEXT PRIMARY KEY,
  geohash TEXT NOT NULL,
  wallet TEXT NOT NULL,
  label TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_near_table_claims_wallet
  ON near_table_claims(wallet);

CREATE INDEX IF NOT EXISTS idx_near_table_claims_geo
  ON near_table_claims(geohash, expires_at DESC);

ALTER TABLE near_table_claims ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE near_table_claims IS
  'JIY Near table/venue pins — one active claim per wallet, TTL ~45m; API service role only.';
