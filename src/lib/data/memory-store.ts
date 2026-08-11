/**
 * In-process memory store for DEMO mode (no Supabase).
 * All records are treated as demo / non-verified.
 * Replaced by Supabase when NEXT_PUBLIC_SUPABASE_* is configured.
 */

import { nanoid } from "nanoid";
import type {
  Business,
  BusinessEvent,
  Listing,
  Offer,
  OfferStatus,
  Profile,
  Conversation,
  Message,
  Transaction,
  TransactionStatus,
} from "@/types/database";
import { slugify } from "@/lib/utils";

type WatchItem = { id: string; user_id: string; listing_id: string; created_at: string };
type RentalRequest = {
  id: string;
  listing_id: string;
  business_id: string;
  requester_id: string;
  owner_id: string;
  monthly_price: number;
  minimum_months: number | null;
  is_rent_to_own: boolean;
  credit_percent: number | null;
  purchase_price: number | null;
  message: string | null;
  status: "REQUESTED" | "ACCEPTED" | "REJECTED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  created_at: string;
  updated_at: string;
};

type OfferEvent = {
  id: string;
  offer_id: string;
  from_status: OfferStatus | null;
  to_status: OfferStatus;
  actor_id: string | null;
  amount: number | null;
  message: string | null;
  created_at: string;
};

const g = globalThis as unknown as {
  __sfMem?: {
    profiles: Map<string, Profile>;
    businesses: Map<string, Business>;
    listings: Map<string, Listing>;
    offers: Offer[];
    offerEvents: OfferEvent[];
    watchlist: WatchItem[];
    conversations: Conversation[];
    messages: Message[];
    events: BusinessEvent[];
    rentalRequests: RentalRequest[];
    transactions: Transaction[];
  };
};

function store() {
  if (!g.__sfMem) {
    g.__sfMem = {
      profiles: new Map(),
      businesses: new Map(),
      listings: new Map(),
      offers: [],
      offerEvents: [],
      watchlist: [],
      conversations: [],
      messages: [],
      events: [],
      rentalRequests: [],
      transactions: [],
    };
  }
  return g.__sfMem;
}

function now() {
  return new Date().toISOString();
}

export const memoryStore = {
  ensureDemoUser(userId = "demo-user", email = "demo@siteflip.local"): Profile {
    const s = store();
    const existing = s.profiles.get(userId);
    if (existing) return existing;
    const profile: Profile = {
      id: userId,
      email,
      full_name: "Demo User",
      avatar_url: null,
      bio: "Local demo profile (not Supabase Auth)",
      seller_score: 80,
      successful_transactions: 0,
      completed_rentals: 0,
      response_rate: 100,
      disputes: 0,
      is_verified: false,
      is_admin: false,
      member_since: now(),
      created_at: now(),
      updated_at: now(),
    };
    s.profiles.set(userId, profile);
    return profile;
  },

  getProfile(id: string) {
    return store().profiles.get(id) ?? null;
  },

  upsertProfile(profile: Profile) {
    store().profiles.set(profile.id, profile);
    return profile;
  },

  createBusiness(
    input: Partial<Business> & { name: string; category: string; current_owner_id: string }
  ): Business {
    const s = store();
    const id = `biz_${nanoid(10)}`;
    const business: Business = {
      id,
      slug: slugify(input.name) + "-" + id.slice(-4),
      name: input.name,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      category: input.category as Business["category"],
      lifecycle: input.lifecycle ?? "IDEA",
      website_url: input.website_url ?? null,
      domain: input.domain ?? null,
      domain_age_years: input.domain_age_years ?? null,
      technology_stack: input.technology_stack ?? [],
      asking_price: input.asking_price ?? null,
      currency: input.currency ?? "EUR",
      monthly_revenue: input.monthly_revenue ?? null,
      monthly_profit: input.monthly_profit ?? null,
      monthly_expenses: input.monthly_expenses ?? null,
      monthly_traffic: input.monthly_traffic ?? null,
      growth_rate: input.growth_rate ?? null,
      ai_score: input.ai_score ?? null,
      health_score: input.health_score ?? null,
      risk_score: input.risk_score ?? null,
      growth_score: input.growth_score ?? null,
      current_owner_id: input.current_owner_id,
      reason_for_selling: input.reason_for_selling ?? null,
      original_story: input.original_story ?? null,
      current_condition: input.current_condition ?? null,
      last_activity_at: now(),
      is_demo: true,
      created_at: now(),
      updated_at: now(),
    };
    s.businesses.set(id, business);
    s.events.push({
      id: `evt_${nanoid(8)}`,
      business_id: id,
      event_type: "created",
      title: "Business created",
      description: "Created in SITEFLIP dashboard",
      metadata: { source: "demo_memory" },
      occurred_at: now(),
      created_by: input.current_owner_id,
    });
    return business;
  },

  updateBusiness(id: string, patch: Partial<Business>) {
    const s = store();
    const b = s.businesses.get(id);
    if (!b) return null;
    const next = { ...b, ...patch, updated_at: now() };
    s.businesses.set(id, next);
    return next;
  },

  listBusinessesForOwner(ownerId: string) {
    return [...store().businesses.values()].filter(
      (b) => b.current_owner_id === ownerId
    );
  },

  getBusiness(idOrSlug: string) {
    const s = store();
    return (
      s.businesses.get(idOrSlug) ??
      [...s.businesses.values()].find((b) => b.slug === idOrSlug) ??
      null
    );
  },

  createListing(
    input: Partial<Listing> & {
      business_id: string;
      seller_id: string;
      listing_type: Listing["listing_type"];
      title: string;
    }
  ): Listing {
    const s = store();
    const id = `list_${nanoid(10)}`;
    const business = s.businesses.get(input.business_id);
    const seller = s.profiles.get(input.seller_id) ?? null;
    const listing: Listing = {
      id,
      business_id: input.business_id,
      seller_id: input.seller_id,
      listing_type: input.listing_type,
      status: input.status ?? "DRAFT",
      title: input.title,
      summary: input.summary ?? null,
      price: input.price ?? null,
      rental_price_monthly: input.rental_price_monthly ?? null,
      rent_to_own_credit_percent: input.rent_to_own_credit_percent ?? null,
      rent_to_own_period_months: input.rent_to_own_period_months ?? null,
      currency: input.currency ?? "EUR",
      featured: false,
      views: 0,
      published_at: input.status === "ACTIVE" ? now() : null,
      expires_at: null,
      is_demo: true,
      created_at: now(),
      updated_at: now(),
      business: business ?? undefined,
      seller: seller ?? undefined,
      verifications: [],
    };
    s.listings.set(id, listing);
    if (business && input.status === "ACTIVE") {
      s.events.push({
        id: `evt_${nanoid(8)}`,
        business_id: business.id,
        event_type: "listed",
        title: "Listed on SITEFLIP",
        description: `${input.listing_type} listing published`,
        metadata: { listing_id: id },
        occurred_at: now(),
        created_by: input.seller_id,
      });
    }
    return listing;
  },

  updateListing(id: string, patch: Partial<Listing>) {
    const s = store();
    const l = s.listings.get(id);
    if (!l) return null;
    const next = { ...l, ...patch, updated_at: now() };
    if (patch.status === "ACTIVE" && !l.published_at) {
      next.published_at = now();
    }
    // refresh joins
    next.business = s.businesses.get(next.business_id) ?? next.business;
    next.seller = s.profiles.get(next.seller_id) ?? next.seller;
    s.listings.set(id, next);
    return next;
  },

  listListings() {
    const s = store();
    return [...s.listings.values()].map((l) => ({
      ...l,
      business: s.businesses.get(l.business_id) ?? l.business,
      seller: s.profiles.get(l.seller_id) ?? l.seller,
    }));
  },

  listListingsForSeller(sellerId: string) {
    return memoryStore.listListings().filter((l) => l.seller_id === sellerId);
  },

  getListing(id: string) {
    const s = store();
    const l = s.listings.get(id);
    if (!l) return null;
    return {
      ...l,
      business: s.businesses.get(l.business_id) ?? l.business,
      seller: s.profiles.get(l.seller_id) ?? l.seller,
    };
  },

  listEvents(businessId: string) {
    return store().events.filter((e) => e.business_id === businessId);
  },

  addWatch(userId: string, listingId: string) {
    const s = store();
    if (s.watchlist.some((w) => w.user_id === userId && w.listing_id === listingId)) {
      return s.watchlist.find(
        (w) => w.user_id === userId && w.listing_id === listingId
      )!;
    }
    const item = {
      id: `w_${nanoid(8)}`,
      user_id: userId,
      listing_id: listingId,
      created_at: now(),
    };
    s.watchlist.push(item);
    return item;
  },

  removeWatch(userId: string, listingId: string) {
    const s = store();
    s.watchlist = s.watchlist.filter(
      (w) => !(w.user_id === userId && w.listing_id === listingId)
    );
  },

  listWatch(userId: string) {
    return store().watchlist.filter((w) => w.user_id === userId);
  },

  createOffer(input: {
    listing_id: string;
    buyer_id: string;
    seller_id: string;
    amount: number;
    message?: string;
    currency?: string;
  }) {
    const s = store();
    const offer: Offer = {
      id: `off_${nanoid(10)}`,
      listing_id: input.listing_id,
      buyer_id: input.buyer_id,
      seller_id: input.seller_id,
      amount: input.amount,
      currency: input.currency ?? "EUR",
      message: input.message ?? null,
      status: "PENDING",
      parent_offer_id: null,
      expires_at: null,
      created_at: now(),
      updated_at: now(),
    };
    s.offers.push(offer);
    s.offerEvents.push({
      id: `oe_${nanoid(8)}`,
      offer_id: offer.id,
      from_status: null,
      to_status: "PENDING",
      actor_id: input.buyer_id,
      amount: input.amount,
      message: input.message ?? null,
      created_at: now(),
    });
    return offer;
  },

  updateOfferStatus(
    offerId: string,
    to: OfferStatus,
    actorId: string,
    opts?: { amount?: number; message?: string }
  ) {
    const s = store();
    const offer = s.offers.find((o) => o.id === offerId);
    if (!offer) return null;
    const from = offer.status;
    offer.status = to;
    if (opts?.amount != null) offer.amount = opts.amount;
    if (opts?.message != null) offer.message = opts.message;
    offer.updated_at = now();
    s.offerEvents.push({
      id: `oe_${nanoid(8)}`,
      offer_id: offerId,
      from_status: from,
      to_status: to,
      actor_id: actorId,
      amount: opts?.amount ?? offer.amount,
      message: opts?.message ?? null,
      created_at: now(),
    });
    return offer;
  },

  listOffersForUser(userId: string) {
    return store().offers.filter(
      (o) => o.buyer_id === userId || o.seller_id === userId
    );
  },

  getOffer(id: string) {
    return store().offers.find((o) => o.id === id) ?? null;
  },

  listOfferEvents(offerId: string) {
    return store().offerEvents.filter((e) => e.offer_id === offerId);
  },

  getOrCreateConversation(input: {
    participant_ids: string[];
    listing_id?: string;
    offer_id?: string;
    business_id?: string;
  }) {
    const s = store();
    const key = [...input.participant_ids].sort().join(":");
    let conv = s.conversations.find((c) => {
      const k = [...c.participant_ids].sort().join(":");
      return (
        k === key &&
        (input.listing_id ? c.listing_id === input.listing_id : true) &&
        (input.offer_id ? c.offer_id === input.offer_id : true)
      );
    });
    if (!conv) {
      conv = {
        id: `conv_${nanoid(10)}`,
        listing_id: input.listing_id ?? null,
        offer_id: input.offer_id ?? null,
        business_id: input.business_id ?? null,
        transaction_id: null,
        rental_id: null,
        participant_ids: input.participant_ids,
        last_message_at: null,
        created_at: now(),
      };
      s.conversations.push(conv);
    }
    return conv;
  },

  listConversations(userId: string) {
    return store().conversations.filter((c) =>
      c.participant_ids.includes(userId)
    );
  },

  addMessage(conversationId: string, senderId: string, body: string) {
    const s = store();
    const conv = s.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (!conv.participant_ids.includes(senderId)) {
      throw new Error("Not a participant");
    }
    const msg: Message = {
      id: `msg_${nanoid(10)}`,
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      read_at: null,
      created_at: now(),
    };
    s.messages.push(msg);
    conv.last_message_at = msg.created_at;
    return msg;
  },

  listMessages(conversationId: string) {
    return store()
      .messages.filter((m) => m.conversation_id === conversationId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  },

  markMessagesRead(conversationId: string, userId: string) {
    const s = store();
    for (const m of s.messages) {
      if (
        m.conversation_id === conversationId &&
        m.sender_id !== userId &&
        !m.read_at
      ) {
        m.read_at = now();
      }
    }
  },

  unreadCount(userId: string) {
    const s = store();
    const convIds = s.conversations
      .filter((c) => c.participant_ids.includes(userId))
      .map((c) => c.id);
    return s.messages.filter(
      (m) =>
        convIds.includes(m.conversation_id) &&
        m.sender_id !== userId &&
        !m.read_at
    ).length;
  },

  createRentalRequest(input: Omit<RentalRequest, "id" | "created_at" | "updated_at" | "status"> & { status?: RentalRequest["status"] }) {
    const s = store();
    const row: RentalRequest = {
      ...input,
      id: `rr_${nanoid(10)}`,
      status: input.status ?? "REQUESTED",
      created_at: now(),
      updated_at: now(),
    };
    s.rentalRequests.push(row);
    return row;
  },

  listRentalRequests(userId: string) {
    return store().rentalRequests.filter(
      (r) => r.requester_id === userId || r.owner_id === userId
    );
  },

  updateRentalRequest(id: string, status: RentalRequest["status"]) {
    const s = store();
    const row = s.rentalRequests.find((r) => r.id === id);
    if (!row) return null;
    row.status = status;
    row.updated_at = now();
    return row;
  },

  createTransaction(input: {
    type: Transaction["type"];
    listing_id: string | null;
    business_id: string;
    buyer_id: string;
    seller_id: string;
    amount: number;
    currency?: string;
  }) {
    const s = store();
    const tx: Transaction = {
      id: `tx_${nanoid(10)}`,
      type: input.type,
      status: "INITIATED",
      listing_id: input.listing_id,
      business_id: input.business_id,
      buyer_id: input.buyer_id,
      seller_id: input.seller_id,
      amount: input.amount,
      currency: input.currency ?? "EUR",
      payment_provider: null,
      payment_ref: null,
      escrow_provider: null,
      notes: "Not escrow. Payment activation requires configuration.",
      created_at: now(),
      updated_at: now(),
      completed_at: null,
    };
    s.transactions.push(tx);
    return tx;
  },

  updateTransaction(id: string, status: TransactionStatus) {
    const s = store();
    const tx = s.transactions.find((t) => t.id === id);
    if (!tx) return null;
    tx.status = status;
    tx.updated_at = now();
    if (status === "COMPLETED") tx.completed_at = now();
    return tx;
  },

  listTransactions(userId: string) {
    return store().transactions.filter(
      (t) => t.buyer_id === userId || t.seller_id === userId
    );
  },
};
