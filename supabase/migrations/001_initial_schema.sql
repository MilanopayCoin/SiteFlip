-- SITEFLIP Database Schema
-- PostgreSQL / Supabase
-- The Operating System for Digital Business Acquisitions

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE business_lifecycle AS ENUM (
  'IDEA', 'BUILDING', 'LIVE', 'GROWING', 'FOR_SALE', 'FOR_RENT',
  'RENTED', 'ACQUIRED', 'REVIVING', 'REVIVED', 'SOLD', 'ARCHIVED'
);

CREATE TYPE listing_type AS ENUM ('BUY', 'RENT', 'RENT_TO_OWN', 'REVIVE', 'SELL');

CREATE TYPE listing_status AS ENUM (
  'DRAFT', 'ACTIVE', 'PAUSED', 'PENDING', 'SOLD', 'RENTED', 'EXPIRED', 'ARCHIVED'
);

CREATE TYPE offer_status AS ENUM (
  'PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'
);

CREATE TYPE transaction_type AS ENUM (
  'BUY', 'RENT', 'RENT_TO_OWN', 'SELL', 'REVIVE_ACQUISITION'
);

CREATE TYPE transaction_status AS ENUM (
  'INITIATED', 'OFFERED', 'ACCEPTED', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED',
  'TRANSFER_PENDING', 'INSPECTION', 'COMPLETED', 'DISPUTED', 'CANCELLED'
);

CREATE TYPE verification_type AS ENUM (
  'DOMAIN', 'OWNERSHIP', 'REVENUE', 'TRAFFIC', 'BUSINESS'
);

CREATE TYPE verification_status AS ENUM (
  'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'REVOKED'
);

CREATE TYPE verification_provider AS ENUM (
  'dns_txt', 'stripe', 'shopify', 'google_analytics',
  'google_search_console', 'paypal', 'cloudflare', 'manual'
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  seller_score NUMERIC(5,2) DEFAULT 0,
  successful_transactions INTEGER DEFAULT 0,
  completed_rentals INTEGER DEFAULT 0,
  response_rate NUMERIC(5,2) DEFAULT 100,
  disputes INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  member_since TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Businesses (core lifecycle entity)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  category TEXT NOT NULL,
  lifecycle business_lifecycle NOT NULL DEFAULT 'IDEA',
  website_url TEXT,
  domain TEXT,
  domain_age_years NUMERIC(6,2),
  technology_stack TEXT[] DEFAULT '{}',
  asking_price NUMERIC(14,2),
  currency TEXT DEFAULT 'EUR',
  monthly_revenue NUMERIC(14,2),
  monthly_profit NUMERIC(14,2),
  monthly_expenses NUMERIC(14,2),
  monthly_traffic INTEGER,
  growth_rate NUMERIC(8,2),
  ai_score NUMERIC(5,2),
  health_score NUMERIC(5,2),
  risk_score NUMERIC(5,2),
  growth_score NUMERIC(5,2),
  current_owner_id UUID REFERENCES profiles(id),
  reason_for_selling TEXT,
  original_story TEXT,
  current_condition TEXT,
  last_activity_at TIMESTAMPTZ,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_businesses_lifecycle ON businesses(lifecycle);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_owner ON businesses(current_owner_id);
CREATE INDEX idx_businesses_ai_score ON businesses(ai_score DESC NULLS LAST);

CREATE TABLE business_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revenue NUMERIC(14,2),
  profit NUMERIC(14,2),
  expenses NUMERIC(14,2),
  traffic INTEGER,
  source TEXT NOT NULL CHECK (source IN ('seller_claim', 'verified', 'ai_estimate'))
);

CREATE INDEX idx_business_metrics_business ON business_metrics(business_id, recorded_at DESC);

CREATE TABLE business_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_business_events_business ON business_events(business_id, occurred_at DESC);

CREATE TABLE business_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type verification_type NOT NULL,
  status verification_status NOT NULL DEFAULT 'PENDING',
  provider verification_provider NOT NULL,
  evidence JSONB,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_id, type, provider)
);

CREATE TABLE business_owners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  ownership_percentage NUMERIC(5,2) DEFAULT 100,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  transferred_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_business_owners_current ON business_owners(business_id) WHERE is_current = TRUE;

-- Listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id),
  listing_type listing_type NOT NULL,
  status listing_status NOT NULL DEFAULT 'DRAFT',
  title TEXT NOT NULL,
  summary TEXT,
  price NUMERIC(14,2),
  rental_price_monthly NUMERIC(14,2),
  rent_to_own_credit_percent NUMERIC(5,2),
  rent_to_own_period_months INTEGER,
  currency TEXT DEFAULT 'EUR',
  featured BOOLEAN DEFAULT FALSE,
  views INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_type_status ON listings(listing_type, status);
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_featured ON listings(featured) WHERE featured = TRUE;

CREATE TABLE listing_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Offers
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  message TEXT,
  status offer_status NOT NULL DEFAULT 'PENDING',
  parent_offer_id UUID REFERENCES offers(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offers_listing ON offers(listing_id);
CREATE INDEX idx_offers_buyer ON offers(buyer_id);

-- Rentals
CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  renter_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  monthly_price NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'DEFAULTED', 'CONVERTED')),
  is_rent_to_own BOOLEAN DEFAULT FALSE,
  credit_percent NUMERIC(5,2),
  purchase_price NUMERIC(14,2),
  remaining_balance NUMERIC(14,2),
  amount_credited NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rental_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  terms JSONB NOT NULL DEFAULT '{}',
  credit_toward_purchase BOOLEAN DEFAULT FALSE,
  credit_percent NUMERIC(5,2),
  contract_period_months INTEGER,
  purchase_option_price NUMERIC(14,2),
  is_legally_binding BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (provider-agnostic; escrow is optional via escrow_provider)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'INITIATED',
  listing_id UUID REFERENCES listings(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  payment_provider TEXT,
  payment_ref TEXT,
  escrow_provider TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE transaction_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  from_status transaction_status,
  to_status transaction_status NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messaging
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES listings(id),
  offer_id UUID REFERENCES offers(id),
  business_id UUID REFERENCES businesses(id),
  transaction_id UUID REFERENCES transactions(id),
  rental_id UUID REFERENCES rentals(id),
  participant_ids UUID[] NOT NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- Watchlists
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

-- Reviews (only after completed transactions)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  reviewee_id UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  transaction_type transaction_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (transaction_id, reviewer_id)
);

-- Valuations
CREATE TABLE valuations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  estimated_value NUMERIC(14,2) NOT NULL,
  minimum_value NUMERIC(14,2) NOT NULL,
  maximum_value NUMERIC(14,2) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  revenue_multiple NUMERIC(8,2),
  profit_multiple NUMERIC(8,2),
  growth_score NUMERIC(5,2),
  risk_score NUMERIC(5,2),
  category_benchmarks JSONB,
  methodology TEXT NOT NULL,
  disclaimer TEXT NOT NULL DEFAULT 'AI valuation is informational only and is not financial, investment, legal or tax advice.',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id),
  user_id UUID REFERENCES profiles(id),
  analysis_type TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB NOT NULL DEFAULT '{}',
  labeled_assumptions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  criteria JSONB NOT NULL,
  results JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE revival_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  revival_score NUMERIC(5,2) NOT NULL,
  why_failed TEXT NOT NULL,
  what_should_change TEXT NOT NULL,
  new_target_customer TEXT NOT NULL,
  new_positioning TEXT NOT NULL,
  new_pricing TEXT NOT NULL,
  new_brand_idea TEXT NOT NULL,
  seo_opportunity TEXT NOT NULL,
  marketing_strategy TEXT NOT NULL,
  plan_30_day TEXT[] DEFAULT '{}',
  plan_90_day TEXT[] DEFAULT '{}',
  verified_data JSONB DEFAULT '{}',
  seller_claims JSONB DEFAULT '{}',
  ai_assumptions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications & reports
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'business', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  provider TEXT NOT NULL,
  provider_ref TEXT,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE revival_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Public marketplace data
CREATE POLICY "Active listings are public"
  ON listings FOR SELECT USING (status = 'ACTIVE' OR seller_id = auth.uid());
CREATE POLICY "Sellers manage own listings"
  ON listings FOR ALL USING (seller_id = auth.uid());

CREATE POLICY "Businesses viewable if listed or owned"
  ON businesses FOR SELECT USING (
    current_owner_id = auth.uid()
    OR is_demo = true
    OR EXISTS (SELECT 1 FROM listings l WHERE l.business_id = businesses.id AND l.status = 'ACTIVE')
  );
CREATE POLICY "Owners manage businesses"
  ON businesses FOR ALL USING (current_owner_id = auth.uid());

CREATE POLICY "Listing images public with listing"
  ON listing_images FOR SELECT USING (
    EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND (l.status = 'ACTIVE' OR l.seller_id = auth.uid()))
  );

CREATE POLICY "Verifications public for listed businesses"
  ON business_verifications FOR SELECT USING (true);

CREATE POLICY "Metrics public for listed businesses"
  ON business_metrics FOR SELECT USING (true);

CREATE POLICY "Events public for listed businesses"
  ON business_events FOR SELECT USING (true);

CREATE POLICY "Reviews are public"
  ON reviews FOR SELECT USING (true);
CREATE POLICY "Reviews only by completed transaction parties"
  ON reviews FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND t.status = 'COMPLETED'
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- Private user data
CREATE POLICY "Users see own offers"
  ON offers FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "Buyers create offers"
  ON offers FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Parties update offers"
  ON offers FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users see own transactions"
  ON transactions FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "Users see own transaction events"
  ON transaction_events FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

CREATE POLICY "Conversation participants only"
  ON conversations FOR SELECT USING (auth.uid() = ANY(participant_ids));
CREATE POLICY "Message participants only"
  ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND auth.uid() = ANY(c.participant_ids)
    )
  );
CREATE POLICY "Send messages as self"
  ON messages FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND auth.uid() = ANY(c.participant_ids)
    )
  );

CREATE POLICY "Own watchlist"
  ON watchlists FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Own notifications"
  ON notifications FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Own AI matches"
  ON ai_matches FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Own AI analyses"
  ON ai_analyses FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Own subscriptions"
  ON subscriptions FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Own payments"
  ON payments FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Revival plans public"
  ON revival_plans FOR SELECT USING (true);

CREATE POLICY "Valuations public"
  ON valuations FOR SELECT USING (true);

CREATE POLICY "Own rentals"
  ON rentals FOR SELECT USING (renter_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "Rental contracts for parties"
  ON rental_contracts FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rentals r
      WHERE r.id = rental_id AND (r.renter_id = auth.uid() OR r.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can report"
  ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Users see own reports"
  ON reports FOR SELECT USING (reporter_id = auth.uid());

-- Admin policies (is_admin flag)
CREATE POLICY "Admins full access profiles"
  ON profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
