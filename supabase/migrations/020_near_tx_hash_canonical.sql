-- Replay protection: treat 0x-prefixed and bare hex as the same Move tx hash.
DROP INDEX IF EXISTS idx_near_gifts_tx_hash_unique;
DROP INDEX IF EXISTS idx_near_pot_events_tx_hash_unique;
DROP INDEX IF EXISTS idx_near_spent_move_txs_hex_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_near_gifts_tx_hash_unique
  ON near_gifts (lower(regexp_replace(tx_hash, '^0x', '', 'i')))
  WHERE tx_hash IS NOT NULL AND length(trim(tx_hash)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_near_pot_events_tx_hash_unique
  ON near_place_pot_events (lower(regexp_replace(tx_hash, '^0x', '', 'i')))
  WHERE tx_hash IS NOT NULL AND length(trim(tx_hash)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_near_spent_move_txs_hex_unique
  ON near_spent_move_txs (lower(regexp_replace(tx_hash, '^0x', '', 'i')));
