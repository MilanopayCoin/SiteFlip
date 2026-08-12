-- SITEFLIP Mollie payment enhancements
-- Extends payments table for transaction linkage + webhook idempotency.
-- Does not duplicate the payments table from 001.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_status TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_ref
  ON payments(provider, provider_ref)
  WHERE provider_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_transaction
  ON payments(transaction_id);

-- Buyers can insert their own payment rows
CREATE POLICY "Users insert own payments"
  ON payments FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own payments"
  ON payments FOR UPDATE USING (user_id = auth.uid());

-- Parties to a transaction can see related payments
CREATE POLICY "Transaction parties see payments"
  ON payments FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );
