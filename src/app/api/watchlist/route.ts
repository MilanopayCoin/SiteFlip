import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { demoWatchlist } from "@/lib/api/demo-store";
import { getListingById } from "@/lib/data/demo";

const watchlistPostSchema = z.object({
  listingId: z.string().min(1),
});

/**
 * Watchlist architecture stub.
 * Production: user-scoped watchlist rows in Supabase.
 */
export async function GET() {
  return NextResponse.json({
    items: demoWatchlist.map((item) => ({
      ...item,
      listing: item.listing
        ? {
            id: item.listing.id,
            title: item.listing.title,
            price: item.listing.price,
          }
        : undefined,
    })),
    note: "Demo stub — watchlist is not persisted to Supabase.",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = watchlistPostSchema.safeParse(body);
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

    const existing = demoWatchlist.find(
      (w) => w.listing_id === parsed.data.listingId && w.user_id === "demo-user"
    );
    if (existing) {
      return NextResponse.json({ item: existing });
    }

    const item = {
      id: `watch-${nanoid(10)}`,
      user_id: "demo-user",
      listing_id: parsed.data.listingId,
      created_at: new Date().toISOString(),
      listing,
    };

    demoWatchlist.push(item);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[api/watchlist]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");
    const id = searchParams.get("id");

    if (!listingId && !id) {
      return NextResponse.json(
        { error: "Provide listingId or id query parameter" },
        { status: 400 }
      );
    }

    const index = demoWatchlist.findIndex((w) =>
      id ? w.id === id : w.listing_id === listingId && w.user_id === "demo-user"
    );

    if (index === -1) {
      return NextResponse.json({ error: "Watchlist item not found" }, { status: 400 });
    }

    const [removed] = demoWatchlist.splice(index, 1);
    return NextResponse.json({ removed: true, item: removed });
  } catch (error) {
    console.error("[api/watchlist]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
