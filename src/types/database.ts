/** SITEFLIP database types — mirrors Supabase schema */

export type BusinessLifecycle =
  | "IDEA"
  | "BUILDING"
  | "LIVE"
  | "GROWING"
  | "FOR_SALE"
  | "FOR_RENT"
  | "RENTED"
  | "ACQUIRED"
  | "REVIVING"
  | "REVIVED"
  | "SOLD"
  | "ARCHIVED";

export type BusinessCategory =
  | "saas"
  | "ai_tools"
  | "ecommerce"
  | "shopify"
  | "affiliate"
  | "blog"
  | "newsletter"
  | "mobile_apps"
  | "chrome_extensions"
  | "web_apps"
  | "domains"
  | "digital_products"
  | "abandoned_saas"
  | "failed_startup"
  | "dead_website"
  | "unused_domain"
  | "old_app"
  | "unmaintained_tool"
  | "failed_ecommerce"
  | "side_project"
  | "developer_project";

export type ListingType = "BUY" | "RENT" | "RENT_TO_OWN" | "REVIVE" | "SELL";

export type ListingStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "PENDING"
  | "SOLD"
  | "RENTED"
  | "EXPIRED"
  | "ARCHIVED";

export type OfferStatus =
  | "PENDING"
  | "COUNTERED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export type TransactionType =
  | "BUY"
  | "RENT"
  | "RENT_TO_OWN"
  | "SELL"
  | "REVIVE_ACQUISITION";

export type TransactionStatus =
  | "INITIATED"
  | "OFFERED"
  | "ACCEPTED"
  | "PAYMENT_PENDING"
  | "PAYMENT_RECEIVED"
  | "TRANSFER_PENDING"
  | "INSPECTION"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED";

export type VerificationType =
  | "DOMAIN"
  | "OWNERSHIP"
  | "REVENUE"
  | "TRAFFIC"
  | "BUSINESS";

export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "FAILED"
  | "EXPIRED"
  | "REVOKED";

export type VerificationProvider =
  | "dns_txt"
  | "stripe"
  | "shopify"
  | "google_analytics"
  | "google_search_console"
  | "paypal"
  | "cloudflare"
  | "manual";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name?: string | null;
  username?: string | null;
  avatar_url: string | null;
  bio: string | null;
  country?: string | null;
  seller_score: number;
  successful_transactions: number;
  completed_rentals: number;
  response_rate: number;
  disputes: number;
  is_verified: boolean;
  is_admin: boolean;
  member_since: string;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: BusinessCategory;
  lifecycle: BusinessLifecycle;
  website_url: string | null;
  domain: string | null;
  domain_age_years: number | null;
  technology_stack: string[];
  asking_price: number | null;
  currency: string;
  monthly_revenue: number | null;
  monthly_profit: number | null;
  monthly_expenses: number | null;
  monthly_traffic: number | null;
  growth_rate: number | null;
  ai_score: number | null;
  health_score: number | null;
  risk_score: number | null;
  growth_score: number | null;
  current_owner_id: string | null;
  reason_for_selling: string | null;
  original_story: string | null;
  current_condition: string | null;
  last_activity_at: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessMetrics {
  id: string;
  business_id: string;
  recorded_at: string;
  revenue: number | null;
  profit: number | null;
  expenses: number | null;
  traffic: number | null;
  source: "seller_claim" | "verified" | "ai_estimate";
}

export interface BusinessEvent {
  id: string;
  business_id: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_by: string | null;
}

export interface BusinessVerification {
  id: string;
  business_id: string;
  type: VerificationType;
  status: VerificationStatus;
  provider: VerificationProvider;
  evidence: Record<string, unknown> | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface BusinessOwner {
  id: string;
  business_id: string;
  user_id: string;
  ownership_percentage: number;
  acquired_at: string;
  transferred_at: string | null;
  is_current: boolean;
}

export interface Listing {
  id: string;
  business_id: string;
  seller_id: string;
  listing_type: ListingType;
  status: ListingStatus;
  title: string;
  summary: string | null;
  price: number | null;
  rental_price_monthly: number | null;
  rent_to_own_credit_percent: number | null;
  rent_to_own_period_months: number | null;
  currency: string;
  featured: boolean;
  views: number;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
  // Joined
  business?: Business;
  seller?: Profile;
  verifications?: BusinessVerification[];
  images?: ListingImage[];
}

export interface ListingImage {
  id: string;
  listing_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface Offer {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  message: string | null;
  status: OfferStatus;
  parent_offer_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rental {
  id: string;
  listing_id: string;
  business_id: string;
  renter_id: string;
  owner_id: string;
  monthly_price: number;
  currency: string;
  start_date: string;
  end_date: string | null;
  status: "ACTIVE" | "ENDED" | "DEFAULTED" | "CONVERTED";
  is_rent_to_own: boolean;
  credit_percent: number | null;
  purchase_price: number | null;
  remaining_balance: number | null;
  amount_credited: number;
  created_at: string;
}

export interface RentalContract {
  id: string;
  rental_id: string;
  terms: Record<string, unknown>;
  credit_toward_purchase: boolean;
  credit_percent: number | null;
  contract_period_months: number | null;
  purchase_option_price: number | null;
  /** Flexible architecture — NOT legally binding by default */
  is_legally_binding: boolean;
  signed_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  listing_id: string | null;
  business_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  /** Payment provider ref — not escrow unless using regulated escrow provider */
  payment_provider: string | null;
  payment_ref: string | null;
  escrow_provider: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TransactionEvent {
  id: string;
  transaction_id: string;
  from_status: TransactionStatus | null;
  to_status: TransactionStatus;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  offer_id: string | null;
  business_id: string | null;
  transaction_id: string | null;
  rental_id: string | null;
  participant_ids: string[];
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
  listing?: Listing;
}

export interface Review {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  body: string | null;
  transaction_type: TransactionType;
  created_at: string;
}

export interface Valuation {
  id: string;
  business_id: string;
  estimated_value: number;
  minimum_value: number;
  maximum_value: number;
  confidence: number;
  revenue_multiple: number | null;
  profit_multiple: number | null;
  growth_score: number | null;
  risk_score: number | null;
  category_benchmarks: Record<string, unknown> | null;
  methodology: string;
  disclaimer: string;
  created_by: string | null;
  created_at: string;
}

export interface AiAnalysis {
  id: string;
  business_id: string | null;
  user_id: string | null;
  analysis_type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  labeled_assumptions: string[];
  created_at: string;
}

export interface AiMatch {
  id: string;
  user_id: string;
  criteria: Record<string, unknown>;
  results: Array<{ listing_id: string; match_percent: number; reasons: string[] }>;
  created_at: string;
}

export interface RevivalPlan {
  id: string;
  business_id: string;
  revival_score: number;
  why_failed: string;
  what_should_change: string;
  new_target_customer: string;
  new_positioning: string;
  new_pricing: string;
  new_brand_idea: string;
  seo_opportunity: string;
  marketing_strategy: string;
  plan_30_day: string[];
  plan_90_day: string[];
  verified_data: Record<string, unknown>;
  seller_claims: Record<string, unknown>;
  ai_assumptions: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: "free" | "pro" | "business" | "enterprise";
  status: "active" | "cancelled" | "past_due" | "trialing";
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
}

export interface MarketplaceFilters {
  listingType?: ListingType | "ALL";
  category?: BusinessCategory | "ALL";
  minPrice?: number;
  maxPrice?: number;
  minRevenue?: number;
  maxRevenue?: number;
  minProfit?: number;
  minTraffic?: number;
  minAiScore?: number;
  maxRisk?: number;
  verifiedOnly?: boolean;
  sort?: "ai" | "price" | "revenue" | "growth" | "newest";
  search?: string;
}

export interface BusinessBlueprint {
  name: string;
  businessModel: string;
  targetAudience: string;
  problem: string;
  solution: string;
  pricing: string;
  revenueProjection: string;
  landingPage: {
    hero: string;
    sections: string[];
    cta: string;
  };
  marketingPlan: string[];
  technologyStack: string[];
  growthStrategy: string[];
  domainIdeas: string[];
  seoStrategy: string[];
}
