import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { demoOffers } from "@/lib/api/demo-store";
import { getListingById } from "@/lib/data/demo";
import { offerSchema } from "@/lib/validations";

export async function GET() {
  return NextResponse.json({ offers: demoOffers });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = offerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const listing = getListingById(parsed.data.listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const offer = {
      id: `offer-${nanoid(10)}`,
      listing_id: parsed.data.listingId,
      buyer_id: "demo-buyer",
      seller_id: listing.seller_id,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      message: parsed.data.message ?? null,
      status: "PENDING" as const,
      parent_offer_id: null,
      expires_at: null,
      created_at: now,
      updated_at: now,
    };

    demoOffers.push(offer);

    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    console.error("[api/offers]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
