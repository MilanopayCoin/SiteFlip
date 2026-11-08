import { nanoid } from "nanoid";

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

export type VoiceRoom = {
  id: string;
  /** Geohash-scoped place voice, or invite code room. */
  geohash: string | null;
  label: string;
  hostWallet: string;
  participants: VoiceParticipant[];
  /** TikTok-style room gift feed (last N). */
  recentGifts: VoiceGiftEvent[];
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

function normalizeRoom(room: VoiceRoom): VoiceRoom {
  if (!room.recentGifts) room.recentGifts = [];
  return room;
}

export function listVoiceRooms(limit = 30): VoiceRoom[] {
  return [...rooms().values()]
    .map(normalizeRoom)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function getVoiceRoom(id: string): VoiceRoom | null {
  const room = rooms().get(id);
  return room ? normalizeRoom(room) : null;
}

export function createVoiceRoom(input: {
  hostWallet: string;
  displayName: string;
  avatarEmoji: string;
  label?: string;
  geohash?: string | null;
}): VoiceRoom {
  const host = norm(input.hostWallet);
  const id = nanoid(10);
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
        joinedAt: now(),
      },
    ],
    recentGifts: [],
    createdAt: now(),
    updatedAt: now(),
  };
  rooms().set(id, room);
  return room;
}

export function joinVoiceRoom(input: {
  roomId: string;
  wallet: string;
  displayName: string;
  avatarEmoji: string;
}): VoiceRoom {
  const room = rooms().get(input.roomId);
  if (!room) throw new Error("Sesli oda yok");
  const w = norm(input.wallet);
  if (room.participants.some((p) => p.wallet === w)) {
    room.updatedAt = now();
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
  return room;
}

export function leaveVoiceRoom(roomId: string, wallet: string): VoiceRoom | null {
  const room = rooms().get(roomId);
  if (!room) return null;
  const w = norm(wallet);
  room.participants = room.participants.filter((p) => p.wallet !== w);
  room.updatedAt = now();
  if (room.participants.length === 0) {
    rooms().delete(roomId);
    return null;
  }
  if (room.hostWallet === w) {
    room.hostWallet = room.participants[0]!.wallet;
  }
  return room;
}

export function setVoiceMute(
  roomId: string,
  wallet: string,
  muted: boolean
): VoiceRoom {
  const room = rooms().get(roomId);
  if (!room) throw new Error("Sesli oda yok");
  const w = norm(wallet);
  room.participants = room.participants.map((p) =>
    p.wallet === w ? { ...p, muted } : p
  );
  room.updatedAt = now();
  return room;
}

export function setVoiceSpeaking(
  roomId: string,
  wallet: string,
  speaking: boolean
): VoiceRoom {
  const room = rooms().get(roomId);
  if (!room) throw new Error("Sesli oda yok");
  const w = norm(wallet);
  room.participants = room.participants.map((p) =>
    p.wallet === w ? { ...p, speaking } : p
  );
  room.updatedAt = now();
  return room;
}

export function pushVoiceGift(input: {
  roomId: string;
  fromWallet: string;
  fromName: string;
  toWallet: string;
  giftId: string;
}): VoiceRoom {
  const room = rooms().get(input.roomId);
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
  return room;
}

export function pushVoiceSignal(input: {
  roomId: string;
  fromWallet: string;
  toWallet: string;
  kind: VoiceSignal["kind"];
  payload: unknown;
}): VoiceSignal {
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

export function pullVoiceSignals(
  roomId: string,
  wallet: string,
  afterId: number
): VoiceSignal[] {
  const w = norm(wallet);
  return signals()
    .filter((s) => s.roomId === roomId && s.id > afterId && s.toWallet === w)
    .sort((a, b) => a.id - b.id)
    .slice(0, 100);
}
