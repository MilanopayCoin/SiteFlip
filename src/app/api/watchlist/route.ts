import { createClient } from "@/lib/supabase/server";
import { memoryStore } from "@/lib/data/memory-store";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { fetchListingById } from "@/lib/data/marketplace-data";
import { getListingById } from "@/lib/data/demo";

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("watchlists")
      .select("*, listing:listings(*, business:businesses(*))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return jsonError("Failed to load watchlist", 500);
    return jsonOk({ items: data ?? [], mode: "supabase" });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const watches = memoryStore.listWatch(user.id);
  const items = watches.map((w) => {
    const listing =
      memoryStore.getListing(w.listing_id) ?? getListingById(w.listing_id);
    return { ...w, listing };
  });
  return jsonOk({ items, mode: "demo" });
}

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const body = await request.json().catch(() => ({}));
  const listingId = String(body.listingId ?? "");
  if (!listingId) return jsonError("listingId required");

  const { listing } = await fetchListingById(listingId);
  const found =
    listing ?? getListingById(listingId) ?? memoryStore.getListing(listingId);
  if (!found) return jsonError("Listing not found", 404);

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("watchlists")
      .upsert(
        { user_id: user.id, listing_id: listingId },
        { onConflict: "user_id,listing_id" }
      )
      .select("*")
      .single();
    if (error) return jsonError("Failed to save", 500);
    return jsonOk({ item: data, mode: "supabase" }, 201);
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const item = memoryStore.addWatch(user.id, listingId);
  return jsonOk({ item, mode: "demo" }, 201);
}

export async function DELETE(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const url = new URL(request.url);
  let listingId = url.searchParams.get("listingId");
  if (!listingId) {
    const body = await request.json().catch(() => ({}));
    listingId = String(body.listingId ?? "");
  }
  if (!listingId) return jsonError("listingId required");

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase!
      .from("watchlists")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);
    if (error) return jsonError("Failed to remove", 500);
    return jsonOk({ ok: true, mode: "supabase" });
  }

  memoryStore.removeWatch(user.id, listingId);
  return jsonOk({ ok: true, mode: "demo" });
}
