-- SITEFLIP MVP Production Upgrade
-- Extends 001/002 without duplicating tables.
-- Adds profile fields, missing RLS write policies, rental requests, offer history.

-- Profile fields for marketplace identity
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- Backfill display_name from full_name
UPDATE profiles
SET display_name = COALESCE(display_name, full_name)
WHERE display_name IS NULL AND full_name IS NOT NULL;

-- Update signup trigger to populate new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name, avatar_url, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Listings: draft publish helpers
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS monthly_profit NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS monthly_traffic INTEGER,
  ADD COLUMN IF NOT EXISTS minimum_rental_months INTEGER,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_listings_demo ON listings(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_businesses_demo ON businesses(is_demo) WHERE is_demo = true;

-- Offer event history
CREATE TABLE IF NOT EXISTS offer_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  from_status offer_status,
  to_status offer_status NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  amount NUMERIC(14,2),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE offer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offer parties see offer events"
  ON offer_events FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

CREATE POLICY "Offer parties insert offer events"
  ON offer_events FOR INSERT WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM offers o
      WHERE o.id = offer_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Rental requests (pre-contract)
DO $$ BEGIN
  CREATE TYPE rental_request_status AS ENUM (
    'REQUESTED', 'ACCEPTED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS rental_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  monthly_price NUMERIC(14,2) NOT NULL,
  minimum_months INTEGER,
  is_rent_to_own BOOLEAN DEFAULT FALSE,
  credit_percent NUMERIC(5,2),
  purchase_price NUMERIC(14,2),
  message TEXT,
  status rental_request_status NOT NULL DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental request parties can view"
  ON rental_requests FOR SELECT USING (
    requester_id = auth.uid() OR owner_id = auth.uid()
  );
CREATE POLICY "Buyers create rental requests"
  ON rental_requests FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Parties update rental requests"
  ON rental_requests FOR UPDATE USING (
    requester_id = auth.uid() OR owner_id = auth.uid()
  );

-- =====================
-- Missing write policies
-- =====================

-- Profiles: allow insert for own row (trigger usually handles this)
CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Businesses
CREATE POLICY "Authenticated create businesses"
  ON businesses FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND current_owner_id = auth.uid()
  );

-- Business owners
CREATE POLICY "Owners see ownership rows"
  ON business_owners FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_id AND b.current_owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners insert ownership"
  ON business_owners FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update ownership"
  ON business_owners FOR UPDATE USING (user_id = auth.uid());

-- Listing images
CREATE POLICY "Sellers manage listing images"
  ON listing_images FOR ALL USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

-- Conversations
CREATE POLICY "Participants create conversations"
  ON conversations FOR INSERT WITH CHECK (
    auth.uid() = ANY(participant_ids)
  );
CREATE POLICY "Participants update conversations"
  ON conversations FOR UPDATE USING (
    auth.uid() = ANY(participant_ids)
  );

-- Rentals write
CREATE POLICY "Parties create rentals"
  ON rentals FOR INSERT WITH CHECK (
    renter_id = auth.uid() OR owner_id = auth.uid()
  );
CREATE POLICY "Parties update rentals"
  ON rentals FOR UPDATE USING (
    renter_id = auth.uid() OR owner_id = auth.uid()
  );

CREATE POLICY "Parties create rental contracts"
  ON rental_contracts FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM rentals r
      WHERE r.id = rental_id
        AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
    )
  );

-- Transactions write
CREATE POLICY "Parties create transactions"
  ON transactions FOR INSERT WITH CHECK (
    buyer_id = auth.uid() OR seller_id = auth.uid()
  );
CREATE POLICY "Parties update transactions"
  ON transactions FOR UPDATE USING (
    buyer_id = auth.uid() OR seller_id = auth.uid()
  );
CREATE POLICY "Parties insert transaction events"
  ON transaction_events FOR INSERT WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- Valuations / AI / revival inserts by authenticated users
CREATE POLICY "Users create valuations"
  ON valuations FOR INSERT WITH CHECK (
    created_by = auth.uid() OR created_by IS NULL
  );
CREATE POLICY "Users create AI analyses"
  ON ai_analyses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users create revival plans"
  ON revival_plans FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_id AND b.current_owner_id = auth.uid()
    )
  );

-- Business metrics/events/verifications owner write
CREATE POLICY "Owners write metrics"
  ON business_metrics FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_id AND b.current_owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners write events"
  ON business_events FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_id AND b.current_owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners write verifications"
  ON business_verifications FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_id AND b.current_owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners update verifications"
  ON business_verifications FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = business_id AND b.current_owner_id = auth.uid()
    )
  );

-- Factory missing write policies
CREATE POLICY "Owners manage factory runs"
  ON factory_runs FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners manage factory changes"
  ON factory_changes FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners manage factory builds"
  ON factory_builds FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners manage factory deployments"
  ON factory_deployments FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners manage factory usage"
  ON factory_usage FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners manage factory costs"
  ON factory_costs FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners manage factory versions"
  ON factory_versions FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- Public demo listings readable always
CREATE POLICY "Demo listings always public"
  ON listings FOR SELECT USING (is_demo = true OR status = 'ACTIVE' OR seller_id = auth.uid());

-- Drop conflicting older public listing policy if needed is handled by OR in existing policy;
-- Keep both: Postgres ORs permissive policies.
