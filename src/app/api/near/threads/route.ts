import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import {
  getOrCreateThread,
  listMessages,
  listThreadsFor,
  postMessage,
} from "@/lib/near/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");
  if (threadId) {
    const messages = await listMessages(threadId, 200);
    return Response.json({ messages });
  }
  const threads = await listThreadsFor(wallet);
  return Response.json({ threads });
}

export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const wallet = await walletFromAuthHeader(
    request.headers.get("authorization")
  );
  if (!wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    peerWallet?: string;
    threadId?: string;
    text?: string;
  };

  if (body.peerWallet && !body.text) {
    const thread = await getOrCreateThread(wallet, body.peerWallet);
    return Response.json({ thread });
  }

  if (body.text && (body.threadId || body.peerWallet)) {
    let threadId = body.threadId;
    if (!threadId && body.peerWallet) {
      const thread = await getOrCreateThread(wallet, body.peerWallet);
      threadId = thread.id;
    }
    if (!threadId) {
      return Response.json({ error: "threadId required" }, { status: 400 });
    }
    const message = await postMessage(threadId, wallet, body.text);
    return Response.json({ message, threadId });
  }

  return Response.json({ error: "Invalid body" }, { status: 400 });
}
