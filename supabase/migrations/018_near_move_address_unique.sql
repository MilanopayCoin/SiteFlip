-- One EVM Near profile per Move payout address (blocks self-gift score farming).
CREATE UNIQUE INDEX IF NOT EXISTS idx_near_profiles_move_address_unique
  ON near_profiles (lower(move_address))
  WHERE move_address IS NOT NULL AND length(trim(move_address)) > 0;
