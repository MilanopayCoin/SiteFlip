import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

export type VoiceParticipant = {
  wallet: string;
  displayName: string;
  avatarEmoji: string;
  muted: boolean;
  speaking: boolean;
  joinedAt: string;
};

export type VoiceGiftEvent = {
  id: string;
  fromWallet: string;
  fromName: string;
  toWallet: string;
  giftId: string;
  at: string;
};

export type VoiceReactionEvent = {
  id: string;
  fromWallet: string;
  fromName: string;
  emoji: string;
  at: string;
};

export type VoiceRoom = {
  id: string;
  /** Geohash-scoped place voice, or invite code room. */
  geohash: string | null;
  label: string;
  hostWallet: string;
  participants: VoiceParticipant[];
  /** TikTok-style room gift feed (last N). */
  recentGifts: VoiceGiftEvent[];
  /** Free emoji reactions (Telegram-style). */
  recentReactions: VoiceReactionEvent[];
  createdAt: string;
  updatedAt: string;
};

export type VoiceSignal = {
  id: number;
  roomId: string;
  fromWallet: string;
  toWallet: string;
  kind: "offer" | "answer" | "ice" | "hangup";
  payload: unknown;
  createdAt: string;
};

const g = globalThis as unknown as {
  __jiyVoiceRooms?: Map<string, VoiceRoom>;
  __jiyVoiceSignals?: VoiceSignal[];
  __jiyVoiceSigSeq?: number;
};

function rooms() {
  if (!g.__jiyVoiceRooms) g.__jiyVoiceRooms = new Map();
  return g.__jiyVoiceRooms;
}
function signals() {
  if (!g.__jiyVoiceSignals) g.__jiyVoiceSignals = [];
  return g.__jiyVoiceSignals;
}
function now() {
  return new Date().toISOString();
}
function norm(w: string) {
  return w.trim().toLowerCase();
}

function isSchemaGap(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    err.code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

function normalizeRoom(room: VoiceRoom): VoiceRoom {
  if (!room.recentGifts) room.recentGifts = [];
  if (!room.recentReactions) room.recentReactions = [];
  return room;
}

function rowToRoom(row: Record<string, unknown>): VoiceRoom {
  return normalizeRoom({
    id: String(row.id),
    geohash: (row.geohash as string | null) || null,
    label: String(row.label || "Sesli oda"),
    hostWallet: String(row.host_wallet || "").toLowerCase(),
    participants: Array.isArray(row.participants)
      ? (row.participants as VoiceParticipant[])
      : [],
    recentGifts: Array.isArray(row.recent_gifts)
      ? (row.recent_gifts as VoiceGiftEvent[])
      : [],
    recentReactions: Array.isArray(row.recent_reactions)
      ? (row.recent_reactions as VoiceReactionEvent[])
      : [],
    createdAt: String(row.created_at || now()),
    updatedAt: String(row.updated_at || now()),
  });
}

async function persistRoom(room: VoiceRoom): Promise<void> {
  rooms().set(room.id, room);
  const client = await db();
  if (!client) return;
  const { error } = await client.from("near_voice_rooms").upsert({
    id: room.id,
    geohash: room.geohash,
    label: room.label,
    host_wallet: room.hostWallet,
    participants: room.participants,
    recent_gifts: room.recentGifts,
    recent_reactions: room.recentReactions,
    created_at: room.createdAt,
    updated_at: room.updatedAt,
  });
  if (error && !isSchemaGap(error)) {
    console.error("near_voice_rooms upsert", error.message);
  }
}

async function deletePersistedRoom(roomId: string): Promise<void> {
  rooms().delete(roomId);
  const client = await db();
  if (!client) return;
  await client.from("near_voice_rooms").delete().eq("id", roomId);
}

async function loadRoom(id: string): Promise<VoiceRoom | null> {
  const mem = rooms().get(id);
  if (mem) return normalizeRoom(mem);
  const client = await db();
  if (!client) return null;
  const { data, error } = await client
    .from("near_voice_rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error && isSchemaGap(error)) return null;
  if (!data) return null;
  const room = rowToRoom(data);
  rooms().set(room.id, room);
  return room;
}

export async function listVoiceRooms(limit = 30): Promise<VoiceRoom[]> {
  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_voice_rooms")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      const list = data.map((row) => rowToRoom(row));
      for (const r of list) rooms().set(r.id, r);
      return list;
    }
    if (error && !isSchemaGap(error)) {
      console.error("listVoiceRooms", error.message);
    }
  }
  return [...rooms().values()]
    .map(normalizeRoom)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function getVoiceRoom(id: string): Promise<VoiceRoom | null> {
  return loadRoom(id);
}

export async function createVoiceRoom(input: {
  hostWallet: string;
  displayName: string;
  avatarEmoji: string;
  label?: string;
  geohash?: string | null;
}): Promise<VoiceRoom> {
  const host = norm(input.hostWallet);
  const id = nanoid(10);
  const ts = now();
  const room: VoiceRoom = {
    id,
    geohash: input.geohash ? input.geohash.slice(0, 5) : null,
    label: (input.label || "Sesli oda").slice(0, 48),
    hostWallet: host,
    participants: [
      {
        wallet: host,
        displayName: input.displayName.slice(0, 40),
        avatarEmoji: input.avatarEmoji || "🎙️",
        muted: false,
        speaking: false,
        joinedAt: ts,
      },
    ],
    recentGifts: [],
    recentReactions: [],
    createdAt: ts,
    updatedAt: ts,
  };
  await persistRoom(room);
  return room;
}

export async function joinVoiceRoom(input: {
  roomId: string;
  wallet: string;
  displayName: string;
  avatarEmoji: string;
}): Promise<VoiceRoom> {
  const room = await loadRoom(input.roomId);
  if (!room) throw new Error("Sesli oda yok");
  const w = norm(input.wallet);
  if (room.participants.some((p) => p.wallet === w)) {
    room.updatedAt = now();
    await persistRoom(room);
    return room;
  }
  if (room.participants.length >= 12) throw new Error("Oda dolu (max 12)");
  room.participants.push({
    wallet: w,
    displayName: input.displayName.slice(0, 40),
    avatarEmoji: input.avatarEmoji || "🎙️",
    muted: false,
    speaking: false,
    joinedAt: now(),
  });
  room.updatedAt = now();
  await persistRoom(room);
  return room;
}

export async function leaveVoiceRoom(
  roomId: string,
  wallet: string
): Promise<VoiceRoom | null> {
  const room = await loadRoom(roomId);
  if (!room) return null;
  const w = norm(wallet);
  room.participants = room.participants.filter((p) => p.wallet !== w);
  room.updatedAt = now();
  if (room.participants.length === 0) {
    await deletePersistedRoom(roomId);
    return null;
  }
  if (room.hostWallet === w) {
    room.hostWallet = room.participants[0]!.wallet;
  }
  await persistRoom(room);
  return room;
}

export async function setVoiceMute(
  roomId: string,
  wallet: string,
  muted: boolean
): Promise<VoiceRoom> {
  const room = await loadRoom(roomId);
  if (!room) throw new Error("Sesli oda yok");
  const w = norm(wallet);
  room.participants = room.participants.map((p) =>
    p.wallet === w ? { ...p, muted } : p
  );
  room.updatedAt = now();
  await persistRoom(room);
  return room;
}

export async function setVoiceSpeaking(
  roomId: string,
  wallet: string,
  speaking: boolean
): Promise<VoiceRoom> {
  const room = await loadRoom(roomId);
  if (!room) throw new Error("Sesli oda yok");
  const w = norm(wallet);
  room.participants = room.participants.map((p) =>
    p.wallet === w ? { ...p, speaking } : p
  );
  room.updatedAt = now();
  await persistRoom(room);
  return room;
}

export async function pushVoiceGift(input: {
  roomId: string;
  fromWallet: string;
  fromName: string;
  toWallet: string;
  giftId: string;
}): Promise<VoiceRoom> {
  const room = await loadRoom(input.roomId);
  if (!room) throw new Error("Sesli oda yok");
  if (!room.recentGifts) room.recentGifts = [];
  const from = norm(input.fromWallet);
  const to = norm(input.toWallet);
  if (!room.participants.some((p) => p.wallet === from)) {
    throw new Error("Odada değilsin");
  }
  if (!room.participants.some((p) => p.wallet === to)) {
    throw new Error("Hedef odada değil");
  }
  const evt: VoiceGiftEvent = {
    id: nanoid(8),
    fromWallet: from,
    fromName: input.fromName.slice(0, 40),
    toWallet: to,
    giftId: input.giftId.slice(0, 32),
    at: now(),
  };
  room.recentGifts = [evt, ...room.recentGifts].slice(0, 40);
  room.updatedAt = now();
  await persistRoom(room);
  return room;
}

export async function pushVoiceReaction(input: {
  roomId: string;
  fromWallet: string;
  fromName: string;
  emoji: string;
}): Promise<VoiceRoom> {
  const room = await loadRoom(input.roomId);
  if (!room) throw new Error("Sesli oda yok");
  if (!room.recentReactions) room.recentReactions = [];
  const from = norm(input.fromWallet);
  if (!room.participants.some((p) => p.wallet === from)) {
    throw new Error("Odada değilsin");
  }
  const emoji = input.emoji.trim().slice(0, 8);
  if (!emoji) throw new Error("emoji required");
  const evt: VoiceReactionEvent = {
    id: nanoid(8),
    fromWallet: from,
    fromName: input.fromName.slice(0, 40),
    emoji,
    at: now(),
  };
  room.recentReactions = [evt, ...room.recentReactions].slice(0, 30);
  room.updatedAt = now();
  await persistRoom(room);
  return room;
}

export async function pushVoiceSignal(input: {
  roomId: string;
  fromWallet: string;
  toWallet: string;
  kind: VoiceSignal["kind"];
  payload: unknown;
}): Promise<VoiceSignal> {
  // Ensure room exists (also warms cache / validates FK for DB).
  const room = await loadRoom(input.roomId);
  if (!room) throw new Error("Sesli oda yok");

  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_voice_signals")
      .insert({
        room_id: input.roomId,
        from_wallet: norm(input.fromWallet),
        to_wallet: norm(input.toWallet),
        kind: input.kind,
        payload: input.payload ?? {},
        created_at: now(),
      })
      .select("id, room_id, from_wallet, to_wallet, kind, payload, created_at")
      .single();
    if (!error && data) {
      return {
        id: Number(data.id),
        roomId: data.room_id,
        fromWallet: data.from_wallet,
        toWallet: data.to_wallet,
        kind: data.kind as VoiceSignal["kind"],
        payload: data.payload,
        createdAt: data.created_at,
      };
    }
    if (error && !isSchemaGap(error)) {
      console.error("pushVoiceSignal", error.message);
    }
  }

  if (!g.__jiyVoiceSigSeq) g.__jiyVoiceSigSeq = 1;
  const sig: VoiceSignal = {
    id: g.__jiyVoiceSigSeq++,
    roomId: input.roomId,
    fromWallet: norm(input.fromWallet),
    toWallet: norm(input.toWallet),
    kind: input.kind,
    payload: input.payload,
    createdAt: now(),
  };
  signals().unshift(sig);
  if (signals().length > 2500) g.__jiyVoiceSignals = signals().slice(0, 1800);
  return sig;
}

export async function pullVoiceSignals(
  roomId: string,
  wallet: string,
  afterId: number
): Promise<VoiceSignal[]> {
  const w = norm(wallet);
  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_voice_signals")
      .select("id, room_id, from_wallet, to_wallet, kind, payload, created_at")
      .eq("room_id", roomId)
      .eq("to_wallet", w)
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(100);
    if (!error && data) {
      return data.map((row) => ({
        id: Number(row.id),
        roomId: row.room_id,
        fromWallet: row.from_wallet,
        toWallet: row.to_wallet,
        kind: row.kind as VoiceSignal["kind"],
        payload: row.payload,
        createdAt: row.created_at,
      }));
    }
    if (error && !isSchemaGap(error)) {
      console.error("pullVoiceSignals", error.message);
    }
  }
  return signals()
    .filter((s) => s.roomId === roomId && s.id > afterId && s.toWallet === w)
    .sort((a, b) => a.id - b.id)
    .slice(0, 100);
}
