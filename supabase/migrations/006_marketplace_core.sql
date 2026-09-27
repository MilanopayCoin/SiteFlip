-- JIY.APP Marketplace Core
-- Additive only. Does not DROP factory_* or existing marketplace tables.
-- Maps Deal Room to transactions + transaction_events.
-- Adds disputes, payouts, commission snapshots, audit_logs.

-- Commission snapshot on transactions (immutable once set)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS payment_fee NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS seller_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS funds_state TEXT,
  ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terms_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS delivery_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_window_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transactions_funds_state ON transactions(funds_state);
CREATE INDEX IF NOT EXISTS idx_transactions_offer ON transactions(offer_id);

-- Listing moderation note (status enum already has PENDING for SUBMITTED/UNDER_REVIEW)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS moderation_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS transfer_readiness TEXT DEFAULT 'NOT_READY'
    CHECK (transfer_readiness IS NULL OR transfer_readiness IN ('READY', 'NOT_READY'));

-- Extend verification types safely
DO $$ BEGIN
  ALTER TYPE verification_type ADD VALUE IF NOT EXISTS 'ANALYTICS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE verification_type ADD VALUE IF NOT EXISTS 'CODE_ASSETS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE verification_type ADD VALUE IF NOT EXISTS 'IDENTITY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES profiles(id),
  against_user_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'PARTIAL', 'CLOSED'
    )),
  resolution_note TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_open_tx
  ON disputes(transaction_id)
  WHERE status IN ('OPEN', 'UNDER_REVIEW');

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispute parties can view"
  ON disputes FOR SELECT USING (
    opened_by = auth.uid()
    OR against_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Parties open disputes"
  ON disputes FOR INSERT WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- Payouts
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ELIGIBLE', 'PROCESSING', 'PAID', 'FAILED', 'BLOCKED')),
  blocked_reason TEXT,
  provider TEXT,
  provider_ref TEXT,
  eligible_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_seller ON payouts(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_tx ON payouts(transaction_id);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers see own payouts"
  ON payouts FOR SELECT USING (
    seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Immutable audit log (append-only for app usage)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Admin can update listings for moderation (service role preferred; policy for admin sessions)
CREATE POLICY "Admins moderate listings"
  ON listings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Admins write verifications"
  ON business_verifications FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
