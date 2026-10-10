-- JIY Quote — €1 PDF unlock orders (guest-friendly, no auth required)
-- Service-role API access only; RLS enabled with no public policies.

CREATE TABLE IF NOT EXISTS quote_orders (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_payment', 'paid', 'failed', 'canceled', 'expired')),
  mollie_payment_id TEXT,
  download_token TEXT NOT NULL,
  unlock_amount NUMERIC(14,2) NOT NULL DEFAULT 1.00,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_orders_mollie
  ON quote_orders(mollie_payment_id)
  WHERE mollie_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_orders_status
  ON quote_orders(status);

CREATE INDEX IF NOT EXISTS idx_quote_orders_created
  ON quote_orders(created_at DESC);

ALTER TABLE quote_orders ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: only service role (bypasses RLS) via API.
COMMENT ON TABLE quote_orders IS
  'JIY Quote PDF unlock orders. Paid status unlocks download only — not escrow, not e-sign.';
