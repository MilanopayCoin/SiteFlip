-- Link StarKey Move address for JIY fungible-asset gifts
ALTER TABLE near_profiles
  ADD COLUMN IF NOT EXISTS move_address TEXT;

CREATE INDEX IF NOT EXISTS idx_near_profiles_move_address
  ON near_profiles (move_address)
  WHERE move_address IS NOT NULL;
