import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { memoryStore } from "@/lib/data/memory-store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/deals/[id] — Deal Room payload.
 * AUTHORIZE: buyer, seller, or admin only (IDOR-safe).
 */
export async function GET(request: Request, context: Ctx) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const { id } = await context.params;
  if (!id) return jsonError("Missing deal id", 400);

  if (user.mode === "supabase" && isSupabaseConfigured()) {
    const supabase = await createClient();
    if (!supabase) return jsonError("Database unavailable", 503);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = Boolean(profile?.is_admin);

    const { data: tx, error } = await supabase
      .from("transactions")
      .select(
        `*, listing:listings(*, business:businesses(*)), business:businesses(*)`
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!tx) return jsonError("Deal not found", 404);

    const isParty = tx.buyer_id === user.id || tx.seller_id === user.id;
    if (!isParty && !isAdmin) {
      return jsonError("Forbidden", 403);
    }

    const [{ data: events }, { data: payments }, { data: offers }, { data: disputes }, { data: payouts }] =
      await Promise.all([
        supabase
          .from("transaction_events")
          .select("*")
          .eq("transaction_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("payments")
          .select("*")
          .eq("transaction_id", id)
          .order("created_at", { ascending: false }),
        tx.listing_id
          ? supabase
              .from("offers")
              .select("*")
              .eq("listing_id", tx.listing_id)
              .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as unknown[] }),
        supabase
          .from("disputes")
          .select("*")
          .eq("transaction_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("payouts")
          .select("*")
          .eq("transaction_id", id)
          .order("created_at", { ascending: false }),
      ]);

    return jsonOk({
      deal: tx,
      events: events ?? [],
      payments: payments ?? [],
      offers: offers ?? [],
      disputes: disputes ?? [],
      payouts: payouts ?? [],
      role: isAdmin
        ? "admin"
        : tx.buyer_id === user.id
          ? "buyer"
          : "seller",
      userId: user.id,
      mode: "supabase",
    });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const txs = memoryStore.listTransactions(user.id);
  const tx = txs.find((t) => t.id === id);
  if (!tx) return jsonError("Deal not found", 404);

  return jsonOk({
    deal: tx,
    events: [],
    payments: [],
    offers: [],
    disputes: [],
    payouts: [],
    role: tx.buyer_id === user.id ? "buyer" : "seller",
    userId: user.id,
    mode: "demo",
  });
}
