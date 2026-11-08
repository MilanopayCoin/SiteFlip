import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { coarseCoord, distanceMeters, encodeGeohash } from "@/lib/near/geohash";
import { giftScore } from "@/lib/near/gifts";
import type {
  NearGiftBoardRow,
  NearGiftRecord,
  NearMessage,
  NearPeer,
  NearPresence,
  NearProfile,
  NearThread,
} from "@/lib/near/types";

const g = globalThis as unknown as {
  __jiyNearProfiles?: Map<string, NearProfile>;
  __jiyNearPresence?: Map<string, NearPresence>;
  __jiyNearThreads?: Map<string, NearThread>;
  __jiyNearMessages?: Map<string, NearMessage[]>;
  __jiyNearGifts?: NearGiftRecord[];
};

function profiles() {
  if (!g.__jiyNearProfiles) g.__jiyNearProfiles = new Map();
  return g.__jiyNearProfiles;
}
function presenceMap() {
  if (!g.__jiyNearPresence) g.__jiyNearPresence = new Map();
  return g.__jiyNearPresence;
}
function threads() {
  if (!g.__jiyNearThreads) g.__jiyNearThreads = new Map();
  return g.__jiyNearThreads;
}
function messages() {
  if (!g.__jiyNearMessages) g.__jiyNearMessages = new Map();
  return g.__jiyNearMessages;
}
function gifts() {
  if (!g.__jiyNearGifts) g.__jiyNearGifts = [];
  return g.__jiyNearGifts;
}

function now() {
  return new Date().toISOString();
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

/** Missing Near tables / PostgREST schema cache — fall back to memory. */
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

function normWallet(w: string) {
  return w.trim().toLowerCase();
}

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function upsertProfile(
  wallet: string,
  patch: Partial<
    Pick<NearProfile, "displayName" | "mood" | "bio" | "avatarEmoji">
  >
): Promise<NearProfile> {
  const w = normWallet(wallet);
  const ts = now();
  const existing = await getProfile(w);
  const profile: NearProfile = {
    wallet: w,
    displayName:
      (patch.displayName?.trim() || existing?.displayName || "").slice(0, 40) ||
      `${w.slice(0, 6)}…`,
    mood: (patch.mood ?? existing?.mood ?? "").slice(0, 48),
    bio: (patch.bio ?? existing?.bio ?? "").slice(0, 160),
    avatarEmoji: (patch.avatarEmoji ?? existing?.avatarEmoji ?? "✨").slice(
      0,
      8
    ),
    createdAt: existing?.createdAt || ts,
    updatedAt: ts,
  };
  profiles().set(w, profile);

  const client = await db();
  if (client) {
    const { error } = await client.from("near_profiles").upsert({
      wallet: profile.wallet,
      display_name: profile.displayName,
      mood: profile.mood,
      bio: profile.bio,
      avatar_emoji: profile.avatarEmoji,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    });
    if (error && !isSchemaGap(error)) throw new Error(error.message);
  }
  return profile;
}

export async function getProfile(wallet: string): Promise<NearProfile | null> {
  const w = normWallet(wallet);
  const mem = profiles().get(w);
  if (mem) return mem;
  const client = await db();
  if (!client) return null;
  const { data, error } = await client
    .from("near_profiles")
    .select("*")
    .eq("wallet", w)
    .maybeSingle();
  if (error && isSchemaGap(error)) return null;
  if (!data) return null;
  const p: NearProfile = {
    wallet: data.wallet,
    displayName: data.display_name,
    mood: data.mood || "",
    bio: data.bio || "",
    avatarEmoji: data.avatar_emoji || "✨",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
  profiles().set(w, p);
  return p;
}

export async function checkIn(
  wallet: string,
  lat: number,
  lng: number,
  ttlMinutes = 45
): Promise<NearPresence> {
  const w = normWallet(wallet);
  if (!(await getProfile(w))) {
    await upsertProfile(w, {});
  }
  const clat = coarseCoord(lat);
  const clng = coarseCoord(lng);
  const geohash = encodeGeohash(clat, clng, 5);
  const ts = now();
  const expiresAt = new Date(
    Date.now() + Math.min(120, Math.max(10, ttlMinutes)) * 60_000
  ).toISOString();
  const presence: NearPresence = {
    wallet: w,
    geohash,
    lat: clat,
    lng: clng,
    expiresAt,
    updatedAt: ts,
  };
  presenceMap().set(w, presence);

  const client = await db();
  if (client) {
    const { error } = await client.from("near_presence").upsert({
      wallet: w,
      geohash,
      lat: clat,
      lng: clng,
      expires_at: expiresAt,
      updated_at: ts,
    });
    if (error && !isSchemaGap(error)) throw new Error(error.message);
  }
  return presence;
}

export async function checkOut(wallet: string): Promise<void> {
  const w = normWallet(wallet);
  presenceMap().delete(w);
  const client = await db();
  if (client) {
    await client.from("near_presence").delete().eq("wallet", w);
  }
}

export async function getPresence(
  wallet: string
): Promise<NearPresence | null> {
  const w = normWallet(wallet);
  const mem = presenceMap().get(w);
  if (mem && new Date(mem.expiresAt).getTime() > Date.now()) return mem;
  const client = await db();
  if (!client) return mem || null;
  const { data } = await client
    .from("near_presence")
    .select("*")
    .eq("wallet", w)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  const p: NearPresence = {
    wallet: data.wallet,
    geohash: data.geohash,
    lat: data.lat,
    lng: data.lng,
    expiresAt: data.expires_at,
    updatedAt: data.updated_at,
  };
  presenceMap().set(w, p);
  return p;
}

export async function listNearby(
  wallet: string,
  maxMeters = 2500
): Promise<NearPeer[]> {
  const w = normWallet(wallet);
  const me = presenceMap().get(w);
  let myPresence = me;
  const client = await db();

  if (!myPresence && client) {
    const { data } = await client
      .from("near_presence")
      .select("*")
      .eq("wallet", w)
      .maybeSingle();
    if (data && new Date(data.expires_at).getTime() > Date.now()) {
      myPresence = {
        wallet: data.wallet,
        geohash: data.geohash,
        lat: data.lat,
        lng: data.lng,
        expiresAt: data.expires_at,
        updatedAt: data.updated_at,
      };
      presenceMap().set(w, myPresence);
    }
  }
  if (!myPresence) return [];

  const prefix = myPresence.geohash.slice(0, 4);
  const nowMs = Date.now();
  const peers: NearPeer[] = [];

  const consider = async (p: NearPresence) => {
    if (p.wallet === w) return;
    if (new Date(p.expiresAt).getTime() < nowMs) return;
    if (!p.geohash.startsWith(prefix)) return;
    const dist = distanceMeters(
      myPresence!.lat,
      myPresence!.lng,
      p.lat,
      p.lng
    );
    if (dist > maxMeters) return;
    const profile = (await getProfile(p.wallet)) || {
      wallet: p.wallet,
      displayName: `${p.wallet.slice(0, 6)}…`,
      mood: "",
      bio: "",
      avatarEmoji: "✨",
      createdAt: p.updatedAt,
      updatedAt: p.updatedAt,
    };
    peers.push({ ...profile, presence: p, distanceM: Math.round(dist) });
  };

  for (const p of presenceMap().values()) {
    await consider(p);
  }

  if (client) {
    const { data } = await client
      .from("near_presence")
      .select("*")
      .like("geohash", `${prefix}%`)
      .gt("expires_at", now());
    for (const row of data || []) {
      const p: NearPresence = {
        wallet: row.wallet,
        geohash: row.geohash,
        lat: row.lat,
        lng: row.lng,
        expiresAt: row.expires_at,
        updatedAt: row.updated_at,
      };
      presenceMap().set(p.wallet, p);
      await consider(p);
    }
  }

  peers.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  // de-dupe by wallet
  const seen = new Set<string>();
  return peers.filter((p) => {
    if (seen.has(p.wallet)) return false;
    seen.add(p.wallet);
    return true;
  });
}

export async function getOrCreateThread(
  walletA: string,
  walletB: string
): Promise<NearThread> {
  const [a, b] = pairKey(normWallet(walletA), normWallet(walletB));
  for (const t of threads().values()) {
    if (t.aWallet === a && t.bWallet === b) return t;
  }
  const client = await db();
  if (client) {
    const { data } = await client
      .from("near_threads")
      .select("*")
      .eq("a_wallet", a)
      .eq("b_wallet", b)
      .maybeSingle();
    if (data) {
      const t: NearThread = {
        id: data.id,
        aWallet: data.a_wallet,
        bWallet: data.b_wallet,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      threads().set(t.id, t);
      return t;
    }
  }
  const ts = now();
  const t: NearThread = {
    id: nanoid(16),
    aWallet: a,
    bWallet: b,
    createdAt: ts,
    updatedAt: ts,
  };
  threads().set(t.id, t);
  if (client) {
    const { error } = await client.from("near_threads").insert({
      id: t.id,
      a_wallet: a,
      b_wallet: b,
      created_at: ts,
      updated_at: ts,
    });
    if (error && error.code !== "23505" && !isSchemaGap(error)) {
      throw new Error(error.message);
    }
  }
  return t;
}

export async function listThreadsFor(wallet: string): Promise<
  Array<NearThread & { peerWallet: string; lastBody?: string }>
> {
  const w = normWallet(wallet);
  const out: Array<NearThread & { peerWallet: string; lastBody?: string }> = [];
  const client = await db();

  const collect = async (t: NearThread) => {
    if (t.aWallet !== w && t.bWallet !== w) return;
    const msgs = await listMessages(t.id, 1);
    out.push({
      ...t,
      peerWallet: t.aWallet === w ? t.bWallet : t.aWallet,
      lastBody: msgs[0]?.body,
    });
  };

  for (const t of threads().values()) await collect(t);

  if (client) {
    const { data } = await client
      .from("near_threads")
      .select("*")
      .or(`a_wallet.eq.${w},b_wallet.eq.${w}`)
      .order("updated_at", { ascending: false })
      .limit(50);
    for (const row of data || []) {
      const t: NearThread = {
        id: row.id,
        aWallet: row.a_wallet,
        bWallet: row.b_wallet,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      threads().set(t.id, t);
      await collect(t);
    }
  }

  const seen = new Set<string>();
  return out
    .filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function postMessage(
  threadId: string,
  fromWallet: string,
  body: string
): Promise<NearMessage> {
  const text = body.trim().slice(0, 1000);
  if (!text) throw new Error("Empty message");
  const w = normWallet(fromWallet);
  let thread = threads().get(threadId);
  const client = await db();
  if (!thread && client) {
    const { data } = await client
      .from("near_threads")
      .select("*")
      .eq("id", threadId)
      .maybeSingle();
    if (data) {
      thread = {
        id: data.id,
        aWallet: data.a_wallet,
        bWallet: data.b_wallet,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      threads().set(thread.id, thread);
    }
  }
  if (!thread) throw new Error("Thread not found");
  if (thread.aWallet !== w && thread.bWallet !== w) {
    throw new Error("Not a participant");
  }

  const msg: NearMessage = {
    id: nanoid(16),
    threadId,
    fromWallet: w,
    body: text,
    createdAt: now(),
  };
  const list = messages().get(threadId) || [];
  list.push(msg);
  messages().set(threadId, list);
  thread.updatedAt = msg.createdAt;
  threads().set(threadId, thread);

  if (client) {
    await client.from("near_messages").insert({
      id: msg.id,
      thread_id: threadId,
      from_wallet: w,
      body: text,
      created_at: msg.createdAt,
    });
    await client
      .from("near_threads")
      .update({ updated_at: msg.createdAt })
      .eq("id", threadId);
  }
  return msg;
}

export async function listMessages(
  threadId: string,
  limit = 100
): Promise<NearMessage[]> {
  const mem = messages().get(threadId) || [];
  if (mem.length) {
    return mem.slice(-limit);
  }
  const client = await db();
  if (!client) return [];
  const { data } = await client
    .from("near_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);
  const list: NearMessage[] = (data || []).map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    fromWallet: row.from_wallet,
    body: row.body,
    createdAt: row.created_at,
  }));
  messages().set(threadId, list);
  return list;
}

export async function recordGift(input: {
  fromWallet: string;
  toWallet: string;
  giftId: string;
  amountWei: string;
  txHash: string | null;
}): Promise<NearGiftRecord> {
  const rec: NearGiftRecord = {
    id: nanoid(16),
    fromWallet: normWallet(input.fromWallet),
    toWallet: normWallet(input.toWallet),
    giftId: input.giftId,
    amountWei: input.amountWei,
    txHash: input.txHash,
    createdAt: now(),
  };
  gifts().unshift(rec);
  const client = await db();
  if (client) {
    await client.from("near_gifts").insert({
      id: rec.id,
      from_wallet: rec.fromWallet,
      to_wallet: rec.toWallet,
      gift_id: rec.giftId,
      amount_wei: rec.amountWei,
      tx_hash: rec.txHash,
      created_at: rec.createdAt,
    });
  }
  return rec;
}

export async function listGiftsFor(wallet: string, limit = 30) {
  const w = normWallet(wallet);
  const mem = gifts().filter((g) => g.toWallet === w || g.fromWallet === w);
  if (mem.length) return mem.slice(0, limit);
  const client = await db();
  if (!client) return [];
  const { data, error } = await client
    .from("near_gifts")
    .select("*")
    .or(`to_wallet.eq.${w},from_wallet.eq.${w}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error && isSchemaGap(error)) return mem.slice(0, limit);
  return (data || []).map((row) => ({
    id: row.id,
    fromWallet: row.from_wallet,
    toWallet: row.to_wallet,
    giftId: row.gift_id,
    amountWei: row.amount_wei,
    txHash: row.tx_hash,
    createdAt: row.created_at,
  })) as NearGiftRecord[];
}

async function loadRecentGifts(limit = 400): Promise<NearGiftRecord[]> {
  const mem = gifts();
  const client = await db();
  if (!client) return mem.slice(0, limit);
  const { data, error } = await client
    .from("near_gifts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error && isSchemaGap(error)) return mem.slice(0, limit);
  const rows = (data || []).map((row) => ({
    id: row.id,
    fromWallet: row.from_wallet,
    toWallet: row.to_wallet,
    giftId: row.gift_id,
    amountWei: row.amount_wei,
    txHash: row.tx_hash,
    createdAt: row.created_at,
  })) as NearGiftRecord[];
  // Prefer memory for same-isolate freshness, then DB.
  const seen = new Set(mem.map((g) => g.id));
  return [...mem, ...rows.filter((r) => !seen.has(r.id))].slice(0, limit);
}

/** Top gift receivers — powers radar boost + night board UI. */
export async function listGiftLeaderboard(
  limit = 15
): Promise<NearGiftBoardRow[]> {
  const all = await loadRecentGifts(500);
  const agg = new Map<
    string,
    { count: number; wei: bigint; score: number }
  >();
  for (const g of all) {
    const cur = agg.get(g.toWallet) || {
      count: 0,
      wei: BigInt(0),
      score: 0,
    };
    cur.count += 1;
    try {
      cur.wei += BigInt(g.amountWei || "0");
    } catch {
      // ignore bad wei
    }
    cur.score += giftScore(g.giftId);
    agg.set(g.toWallet, cur);
  }
  const wallets = [...agg.keys()];
  const profilesByWallet = new Map<string, NearProfile>();
  await Promise.all(
    wallets.map(async (w) => {
      const p = await getProfile(w);
      if (p) profilesByWallet.set(w, p);
    })
  );
  return wallets
    .map((wallet) => {
      const a = agg.get(wallet)!;
      const p = profilesByWallet.get(wallet);
      return {
        wallet,
        displayName: p?.displayName || shortWallet(wallet),
        avatarEmoji: p?.avatarEmoji || "✨",
        receivedCount: a.count,
        receivedWei: a.wei.toString(),
        score: a.score,
      } satisfies NearGiftBoardRow;
    })
    .sort((a, b) => b.score - a.score || b.receivedCount - a.receivedCount)
    .slice(0, limit);
}

function shortWallet(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}
