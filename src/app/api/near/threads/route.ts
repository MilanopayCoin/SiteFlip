import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import {
  getOrCreateThread,
  listMessages,
  listThreadsFor,
  postMessage,
} from "@/lib/near/store";
import { isMutualWave } from "@/lib/near/waves";

export const runtime = "nodejs";

async function peerFromThread(
  threadId: string,
  me: string
): Promise<string | null> {
  const threads = await listThreadsFor(me);
  const t = threads.find((x) => x.id === threadId);
  return t?.peerWallet || null;
}

export async function GET(request: Request) {
  try {
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
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Threads failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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
      const mutual = await isMutualWave(wallet, body.peerWallet);
      return Response.json({ thread, mutual });
    }

    if (body.text && (body.threadId || body.peerWallet)) {
      let threadId = body.threadId;
      let peer = body.peerWallet || null;
      if (!threadId && body.peerWallet) {
        const thread = await getOrCreateThread(wallet, body.peerWallet);
        threadId = thread.id;
      }
      if (!threadId) {
        return Response.json({ error: "threadId required" }, { status: 400 });
      }
      if (!peer) peer = await peerFromThread(threadId, wallet);
      if (!peer || !(await isMutualWave(wallet, peer))) {
        return Response.json(
          {
            error:
              "Karşılıklı Selam gerekli — önce Selam at veya Wave hediyesi gönder.",
            code: "MUTUAL_WAVE_REQUIRED",
          },
          { status: 403 }
        );
      }
      const message = await postMessage(threadId, wallet, body.text);
      return Response.json({ message, threadId });
    }

    return Response.json({ error: "Invalid body" }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Thread post failed" },
      { status: 500 }
    );
  }
}
