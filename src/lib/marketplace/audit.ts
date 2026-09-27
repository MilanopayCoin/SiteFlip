import { createServiceClient, createClient } from "@/lib/supabase/server";

export async function writeAuditLog(input: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  const supabase =
    (await createServiceClient()) || (await createClient());
  if (!supabase) return { ok: false as const, error: "No DB client" };

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  });

  // Fallback to admin_actions if audit_logs migration not applied yet
  if (error) {
    const { error: fallbackError } = await supabase.from("admin_actions").insert({
      admin_id: input.actorId,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: {
        before: input.before,
        after: input.after,
        reason: input.reason,
      },
    });
    if (fallbackError) {
      return { ok: false as const, error: fallbackError.message };
    }
  }

  return { ok: true as const };
}
