-- Allow match-bet stakes in the shared Move spend ledger.
ALTER TABLE near_spent_move_txs DROP CONSTRAINT IF EXISTS near_spent_move_txs_purpose_check;
ALTER TABLE near_spent_move_txs
  ADD CONSTRAINT near_spent_move_txs_purpose_check
  CHECK (purpose IN ('gift', 'pot', 'bet'));
