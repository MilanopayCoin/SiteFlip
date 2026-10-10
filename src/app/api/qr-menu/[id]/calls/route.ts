import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import { waiterCallSchema } from "@/lib/qr-menu/types";
import {
  ackWaiterCall,
  createWaiterCall,
  getMenuById,
  listWaiterCalls,
} from "@/lib/qr-menu/store";

export const runtime = "nodejs";

/** Guest: create a waiter call. Owner: list with ?token= */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return jsonError("Edit token required", 401);

  try {
    const calls = await listWaiterCalls(id, token);
    return jsonOk({ calls });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return jsonError("Invalid edit token", 403);
    }
    return jsonError("Failed to list calls", 500);
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const menu = await getMenuById(id);
  if (!menu || !menu.published) return jsonError("Menu not found", 404);

  const parsed = waiterCallSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  try {
    const call = await createWaiterCall({
      menuId: id,
      tableLabel: parsed.data.tableLabel,
      note: parsed.data.note,
    });
    return jsonOk({ call, notice: "Garson çağrısı gönderildi." }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return jsonError("Menu not found", 404);
    }
    console.error("waiter call failed", err);
    return jsonError("Failed to create call", 500);
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const editToken = String((body as { editToken?: string }).editToken || "");
  const callId = String((body as { callId?: string }).callId || "");
  if (!editToken || !callId) return jsonError("editToken and callId required", 400);

  try {
    const call = await ackWaiterCall({ menuId: id, callId, editToken });
    if (!call) return jsonError("Call not found", 404);
    return jsonOk({ call });
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return jsonError("Invalid edit token", 403);
    }
    return jsonError("Failed to update call", 500);
  }
}
