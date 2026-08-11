import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { demoMessages } from "@/lib/api/demo-store";
import { messageSchema } from "@/lib/validations";

/**
 * Messaging architecture stub.
 * Production: Supabase realtime + RLS on conversations/messages tables.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  const messages = conversationId
    ? demoMessages.filter((m) => m.conversation_id === conversationId)
    : demoMessages;

  return NextResponse.json({
    conversations: [],
    messages,
    note: "Demo stub — messages are not persisted to Supabase.",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const message = {
      id: `msg-${nanoid(10)}`,
      conversation_id: parsed.data.conversationId,
      sender_id: "demo-user",
      body: parsed.data.body,
      read_at: null,
      created_at: now,
    };

    demoMessages.push(message);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("[api/messages]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
