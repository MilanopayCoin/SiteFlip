-- JIY Near — ephemeral place chat rooms (geohash-scoped)

CREATE TABLE IF NOT EXISTS near_room_messages (
  id TEXT PRIMARY KEY,
  geohash TEXT NOT NULL,
  from_wallet TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_room_messages_geo
  ON near_room_messages(geohash, created_at DESC);

ALTER TABLE near_room_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE near_room_messages IS
  'JIY Near place rooms — messages scoped to check-in geohash; API service role only.';
