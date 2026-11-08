-- JIY Near — WebRTC call signaling + place pots

CREATE TABLE IF NOT EXISTS near_calls (
  id TEXT PRIMARY KEY,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing', 'active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_calls_to ON near_calls(to_wallet, status);

CREATE TABLE IF NOT EXISTS near_call_signals (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES near_calls(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('offer', 'answer', 'ice', 'hangup')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_call_signals_call ON near_call_signals(call_id, id);

CREATE TABLE IF NOT EXISTS near_place_pots (
  geohash TEXT PRIMARY KEY,
  total_wei TEXT NOT NULL DEFAULT '0',
  gift_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS near_place_pot_events (
  id TEXT PRIMARY KEY,
  geohash TEXT NOT NULL,
  from_wallet TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_pot_events_geo ON near_place_pot_events(geohash, created_at DESC);

ALTER TABLE near_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_place_pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_place_pot_events ENABLE ROW LEVEL SECURITY;
