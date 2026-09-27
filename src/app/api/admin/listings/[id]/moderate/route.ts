import { z } from "zod";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { writeAuditLog } from "@/lib/marketplace/audit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["VERIFY_LIVE", "REJECT", "SUSPEND"]),
  reason: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/listings/[id]/moderate
 * Admin only. VERIFY_LIVE: PENDING → ACTIVE (+ published_at).
 */
export async function POST(request: Request, context: Ctx) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (!(user.mode === "supabase" && isSupabaseConfigured())) {
    return jsonError("Admin moderation requires Supabase", 503);
  }

  const supabase = await createClient();
  if (!supabase) return jsonError("Database unavailable", 503);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return jsonError("Admin only", 403);

  const { id } = await context.params;
  if (!id) return jsonError("Missing listing id", 400);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  const writer = (await createServiceClient()) || supabase;
  const { data: listing } = await writer
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!listing) return jsonError("Listing not found", 404);

  const now = new Date().toISOString();
  const { action, reason } = parsed.data;

  let nextStatus = listing.status;
  let publishedAt = listing.published_at;

  if (action === "VERIFY_LIVE") {
    if (listing.status !== "PENDING" && listing.status !== "DRAFT") {
      return jsonError("VERIFY_LIVE expects PENDING (or DRAFT) listing", 400);
    }
    nextStatus = "ACTIVE";
    publishedAt = now;
  } else if (action === "REJECT") {
    nextStatus = "ARCHIVED";
  } else if (action === "SUSPEND") {
    nextStatus = "PAUSED";
  }

  const { data: updated, error } = await writer
    .from("listings")
    .update({
      status: nextStatus,
      published_at: publishedAt,
      moderation_note: reason ?? listing.moderation_note ?? null,
      reviewed_at: now,
      reviewed_by: user.id,
      updated_at: now,
    })
    .eq("id", id)
    .select(`*, business:businesses(*)`)
    .single();

  if (error) return jsonError(error.message, 500);

  if (action === "VERIFY_LIVE" && listing.business_id) {
    await writer.from("business_events").insert({
      business_id: listing.business_id,
      event_type: "listed",
      title: "Listing verified live on JIY.APP",
      description: `${listing.listing_type} listing approved`,
      created_by: user.id,
    });
  }

  await writeAuditLog({
    actorId: user.id,
    action: `listing_${action.toLowerCase()}`,
    targetType: "listing",
    targetId: id,
    before: { status: listing.status },
    after: { status: nextStatus },
    reason: reason ?? null,
  });

  return jsonOk({ listing: updated, mode: "supabase" });
}
