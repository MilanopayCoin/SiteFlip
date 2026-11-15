-- JIY Near — football match bets (JIY + SUPRA balances)

CREATE TABLE IF NOT EXISTS near_match_balances (
  wallet TEXT PRIMARY KEY,
  supra DOUBLE PRECISION NOT NULL DEFAULT 2000,
  jiy DOUBLE PRECISION NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS near_match_bets (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  match_id TEXT NOT NULL,
  league TEXT NOT NULL,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  kickoff_utc TIMESTAMPTZ NOT NULL,
  pick TEXT NOT NULL CHECK (pick IN ('home', 'draw', 'away')),
  odds DOUBLE PRECISION NOT NULL,
  stake DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('jiy', 'supra')),
  potential_win DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost', 'void')),
  score_home INT,
  score_away INT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_near_match_bets_wallet
  ON near_match_bets (wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_near_match_bets_open
  ON near_match_bets (status, kickoff_utc)
  WHERE status = 'open';

ALTER TABLE near_match_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_match_bets ENABLE ROW LEVEL SECURITY;
