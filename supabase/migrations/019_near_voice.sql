-- JIY Near — persistent voice rooms + short-TTL WebRTC signals

CREATE TABLE IF NOT EXISTS near_voice_rooms (
  id TEXT PRIMARY KEY,
  geohash TEXT,
  label TEXT NOT NULL,
  host_wallet TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent_gifts JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent_reactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_voice_rooms_updated
  ON near_voice_rooms (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_near_voice_rooms_geo
  ON near_voice_rooms (geohash)
  WHERE geohash IS NOT NULL;

CREATE TABLE IF NOT EXISTS near_voice_signals (
  id BIGSERIAL PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES near_voice_rooms(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_voice_signals_pull
  ON near_voice_signals (room_id, to_wallet, id);

CREATE INDEX IF NOT EXISTS idx_near_voice_signals_created
  ON near_voice_signals (created_at);

ALTER TABLE near_voice_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_voice_signals ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE near_voice_rooms IS
  'JIY Near voice rooms — JSON participants/gifts; service role API only.';
COMMENT ON TABLE near_voice_signals IS
  'JIY Near WebRTC signal queue — participants only; API prunes ~5m TTL + leave CASCADE.';
