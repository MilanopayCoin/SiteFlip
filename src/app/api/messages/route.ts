import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memoryStore } from "@/lib/data/memory-store";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";

const sendSchema = z.object({
  body: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
  recipientId: z.string().optional(),
  listingId: z.string().optional(),
  offerId: z.string().optional(),
  businessId: z.string().optional(),
  transactionId: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  if (user.mode === "supabase") {
    const supabase = await createClient();
    if (conversationId) {
      const { data: conv } = await supabase!
        .from("conversations")
        .select("id, participant_ids")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || !(conv.participant_ids ?? []).includes(user.id)) {
        return jsonError("Forbidden", 403);
      }

      const { data, error } = await supabase!
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) return jsonError("Failed to load messages", 500);

      await supabase!
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null);

      return jsonOk({ messages: data ?? [], mode: "supabase" });
    }

    const { data, error } = await supabase!
      .from("conversations")
      .select("*")
      .contains("participant_ids", [user.id])
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) return jsonError("Failed to load conversations", 500);
    return jsonOk({ conversations: data ?? [], mode: "supabase" });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  if (conversationId) {
    memoryStore.markMessagesRead(conversationId, user.id);
    return jsonOk({
      messages: memoryStore.listMessages(conversationId),
      mode: "demo",
    });
  }
  return jsonOk({
    conversations: memoryStore.listConversations(user.id),
    unread: memoryStore.unreadCount(user.id),
    mode: "demo",
  });
}

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const parsed = sendSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Validation failed", 400);

  const input = parsed.data;
  if (input.recipientId && input.recipientId === user.id) {
    return jsonError("Cannot message yourself", 400);
  }

  if (user.mode === "supabase") {
    const supabase = await createClient();
    let conversationId = input.conversationId ?? null;

    if (!conversationId) {
      if (!input.recipientId) {
        return jsonError("recipientId or conversationId required", 400);
      }
      const { data: conv, error: cErr } = await supabase!
        .from("conversations")
        .insert({
          listing_id: input.listingId ?? null,
          offer_id: input.offerId ?? null,
          business_id: input.businessId ?? null,
          transaction_id: input.transactionId ?? null,
          participant_ids: [user.id, input.recipientId],
        })
        .select("*")
        .single();
      if (cErr || !conv) return jsonError("Failed to create conversation", 500);
      conversationId = conv.id;
    } else {
      const { data: conv } = await supabase!
        .from("conversations")
        .select("participant_ids")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || !(conv.participant_ids ?? []).includes(user.id)) {
        return jsonError("Forbidden", 403);
      }
    }

    const { data: msg, error } = await supabase!
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: input.body,
      })
      .select("*")
      .single();
    if (error) return jsonError("Failed to send", 500);

    await supabase!
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return jsonOk({ message: msg, conversationId, mode: "supabase" }, 201);
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    if (!input.recipientId) {
      return jsonError("recipientId or conversationId required", 400);
    }
    const conv = memoryStore.getOrCreateConversation({
      participant_ids: [user.id, input.recipientId],
      listing_id: input.listingId,
      offer_id: input.offerId,
      business_id: input.businessId,
    });
    conversationId = conv.id;
  }

  try {
    const message = memoryStore.addMessage(conversationId, user.id, input.body);
    return jsonOk({ message, conversationId, mode: "demo" }, 201);
  } catch {
    return jsonError("Failed to send", 500);
  }
}
