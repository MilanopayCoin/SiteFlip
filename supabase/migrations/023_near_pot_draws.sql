-- Persist gece çekilişi draws + payout audit; harden match-bet Move tx uniqueness.

CREATE TABLE IF NOT EXISTS near_pot_draws (
  id TEXT PRIMARY KEY,
  geohash TEXT NOT NULL,
  winner_wallet TEXT NOT NULL,
  entrants INT NOT NULL,
  total_wei TEXT NOT NULL,
  payout_jiy DOUBLE PRECISION NOT NULL,
  entropy_source TEXT NOT NULL,
  seed_commit TEXT NOT NULL,
  seed_reveal TEXT NOT NULL,
  proof JSONB NOT NULL DEFAULT '{}'::jsonb,
  payout_status TEXT NOT NULL DEFAULT 'credited'
    CHECK (payout_status IN ('credited', 'pending_move', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_pot_draws_geo
  ON near_pot_draws (geohash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_near_pot_draws_winner
  ON near_pot_draws (winner_wallet, created_at DESC);

ALTER TABLE near_pot_draws ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE near_pot_draws IS
  'JIY Near place-pot night draws — commit-reveal entropy; swap for Supra dVRF proof later.';

-- One Move stake per bet tx (when present).
CREATE UNIQUE INDEX IF NOT EXISTS idx_near_match_bets_tx_hash_unique
  ON near_match_bets (lower(regexp_replace(tx_hash, '^0x', '', 'i')))
  WHERE tx_hash IS NOT NULL AND length(trim(tx_hash)) > 0;
