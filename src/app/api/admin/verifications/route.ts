import { z } from "zod";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { writeAuditLog } from "@/lib/marketplace/audit";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1),
  type: z.enum([
    "DOMAIN",
    "OWNERSHIP",
    "REVENUE",
    "TRAFFIC",
    "BUSINESS",
    "ANALYTICS",
    "CODE_ASSETS",
    "IDENTITY",
  ]),
  status: z.enum(["VERIFIED", "FAILED"]),
  provider: z
    .enum([
      "dns_txt",
      "mollie",
      "shopify",
      "google_analytics",
      "google_search_console",
      "paypal",
      "cloudflare",
      "manual",
    ])
    .default("manual"),
  reason: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/verifications
 * Set business_verification status VERIFIED/FAILED for a type. Admin only.
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (!(user.mode === "supabase" && isSupabaseConfigured())) {
    return jsonError("Admin verifications require Supabase", 503);
  }

  const supabase = await createClient();
  if (!supabase) return jsonError("Database unavailable", 503);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return jsonError("Admin only", 403);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  const { businessId, type, status, provider, reason } = parsed.data;
  const writer = (await createServiceClient()) || supabase;
  const now = new Date().toISOString();

  const { data: existing } = await writer
    .from("business_verifications")
    .select("*")
    .eq("business_id", businessId)
    .eq("type", type)
    .eq("provider", provider)
    .maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await writer
      .from("business_verifications")
      .update({
        status,
        verified_at: status === "VERIFIED" ? now : null,
        evidence: {
          ...(typeof existing.evidence === "object" && existing.evidence
            ? existing.evidence
            : {}),
          admin_reason: reason ?? null,
          reviewed_by: user.id,
          reviewed_at: now,
        },
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return jsonError(error.message, 500);
    row = data;
  } else {
    const { data, error } = await writer
      .from("business_verifications")
      .insert({
        business_id: businessId,
        type,
        status,
        provider,
        verified_at: status === "VERIFIED" ? now : null,
        evidence: {
          admin_reason: reason ?? null,
          reviewed_by: user.id,
          reviewed_at: now,
        },
      })
      .select("*")
      .single();
    if (error) return jsonError(error.message, 500);
    row = data;
  }

  await writeAuditLog({
    actorId: user.id,
    action: `verification_${status.toLowerCase()}`,
    targetType: "business_verification",
    targetId: row.id,
    before: existing
      ? { status: existing.status, type: existing.type }
      : null,
    after: { status, type, businessId },
    reason: reason ?? null,
  });

  return jsonOk({ verification: row, mode: "supabase" });
}
