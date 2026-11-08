import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import { getPresence } from "@/lib/near/store";
import {
  createVoiceRoom,
  getVoiceRoom,
  joinVoiceRoom,
  leaveVoiceRoom,
  listVoiceRooms,
  pullVoiceSignals,
  pushVoiceSignal,
  setVoiceMute,
  setVoiceSpeaking,
} from "@/lib/near/voice";
import type { VoiceSignal } from "@/lib/near/voice";

export const runtime = "nodejs";

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
    const roomId = url.searchParams.get("roomId");
    const after = Number(url.searchParams.get("after") || 0);
    if (roomId && url.searchParams.get("signals") === "1") {
      return Response.json({
        signals: pullVoiceSignals(roomId, wallet, after),
      });
    }
    if (roomId) {
      const room = getVoiceRoom(roomId);
      if (!room) {
        return Response.json({ error: "Oda yok" }, { status: 404 });
      }
      return Response.json({ room });
    }
    return Response.json({ rooms: listVoiceRooms() });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Voice failed" },
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
      action?: string;
      roomId?: string;
      label?: string;
      displayName?: string;
      avatarEmoji?: string;
      muted?: boolean;
      speaking?: boolean;
      toWallet?: string;
      kind?: VoiceSignal["kind"];
      payload?: unknown;
      usePresence?: boolean;
    };
    const name = body.displayName || wallet.slice(0, 8);
    const emoji = body.avatarEmoji || "🎙️";

    switch (body.action) {
      case "create": {
        let geohash: string | null = null;
        if (body.usePresence !== false) {
          const presence = await getPresence(wallet);
          geohash = presence?.geohash?.slice(0, 5) || null;
        }
        const room = createVoiceRoom({
          hostWallet: wallet,
          displayName: name,
          avatarEmoji: emoji,
          label: body.label,
          geohash,
        });
        return Response.json({ room });
      }
      case "join": {
        if (!body.roomId) {
          return Response.json({ error: "roomId required" }, { status: 400 });
        }
        const room = joinVoiceRoom({
          roomId: body.roomId,
          wallet,
          displayName: name,
          avatarEmoji: emoji,
        });
        return Response.json({ room });
      }
      case "leave": {
        if (!body.roomId) {
          return Response.json({ error: "roomId required" }, { status: 400 });
        }
        const room = leaveVoiceRoom(body.roomId, wallet);
        return Response.json({ room, ok: true });
      }
      case "mute": {
        if (!body.roomId || typeof body.muted !== "boolean") {
          return Response.json(
            { error: "roomId + muted required" },
            { status: 400 }
          );
        }
        const room = setVoiceMute(body.roomId, wallet, body.muted);
        return Response.json({ room });
      }
      case "speaking": {
        if (!body.roomId || typeof body.speaking !== "boolean") {
          return Response.json(
            { error: "roomId + speaking required" },
            { status: 400 }
          );
        }
        const room = setVoiceSpeaking(body.roomId, wallet, body.speaking);
        return Response.json({ room });
      }
      case "signal": {
        if (
          !body.roomId ||
          !body.toWallet ||
          !body.kind ||
          !/^0x[a-fA-F0-9]{40}$/.test(body.toWallet)
        ) {
          return Response.json({ error: "Invalid signal" }, { status: 400 });
        }
        const signal = pushVoiceSignal({
          roomId: body.roomId,
          fromWallet: wallet,
          toWallet: body.toWallet,
          kind: body.kind,
          payload: body.payload ?? {},
        });
        return Response.json({ signal });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Voice action failed" },
      { status: 500 }
    );
  }
}
