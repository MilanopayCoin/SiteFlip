-- JIY Near — proximity social (StarKey wallet identity)
-- Service-role API access only; RLS on, no public policies.

CREATE TABLE IF NOT EXISTS near_profiles (
  wallet TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_emoji TEXT NOT NULL DEFAULT '✨',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS near_presence (
  wallet TEXT PRIMARY KEY REFERENCES near_profiles(wallet) ON DELETE CASCADE,
  geohash TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_presence_geohash ON near_presence(geohash);
CREATE INDEX IF NOT EXISTS idx_near_presence_expires ON near_presence(expires_at);

CREATE TABLE IF NOT EXISTS near_threads (
  id TEXT PRIMARY KEY,
  a_wallet TEXT NOT NULL,
  b_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (a_wallet, b_wallet)
);

CREATE INDEX IF NOT EXISTS idx_near_threads_a ON near_threads(a_wallet);
CREATE INDEX IF NOT EXISTS idx_near_threads_b ON near_threads(b_wallet);

CREATE TABLE IF NOT EXISTS near_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES near_threads(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_messages_thread ON near_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS near_gifts (
  id TEXT PRIMARY KEY,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_gifts_to ON near_gifts(to_wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS near_sessions (
  token TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_sessions_wallet ON near_sessions(wallet);

ALTER TABLE near_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE near_profiles IS
  'JIY Near — StarKey wallet profiles. API via service role only.';
