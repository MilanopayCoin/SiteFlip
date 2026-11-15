-- Shared spend ledger for verified Move mainnet JIY payments (gifts + pots).
CREATE TABLE IF NOT EXISTS near_spent_move_txs (
  tx_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('gift', 'pot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_near_spent_move_txs_created
  ON near_spent_move_txs (created_at DESC);

ALTER TABLE near_spent_move_txs ENABLE ROW LEVEL SECURITY;

-- Harden legacy tables: one credit per normalized hash when present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_near_gifts_tx_hash_unique
  ON near_gifts (lower(tx_hash))
  WHERE tx_hash IS NOT NULL AND length(trim(tx_hash)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_near_pot_events_tx_hash_unique
  ON near_place_pot_events (lower(tx_hash))
  WHERE tx_hash IS NOT NULL AND length(trim(tx_hash)) > 0;
