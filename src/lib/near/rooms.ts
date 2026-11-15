import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

export type NearRoomMessage = {
  id: string;
  geohash: string;
  fromWallet: string;
  body: string;
  createdAt: string;
};

const g = globalThis as unknown as {
  __jiyNearRoomMsgs?: Map<string, NearRoomMessage[]>;
};

function bucket() {
  if (!g.__jiyNearRoomMsgs) g.__jiyNearRoomMsgs = new Map();
  return g.__jiyNearRoomMsgs;
}

function now() {
  return new Date().toISOString();
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
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

export async function listRoomMessages(
  geohash: string,
  limit = 80
): Promise<NearRoomMessage[]> {
  const key = geohash.slice(0, 5);
  const mem = bucket().get(key) || [];
  const client = await db();
  if (!client) return mem.slice(-limit);

  const { data, error } = await client
    .from("near_room_messages")
    .select("*")
    .eq("geohash", key)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (isSchemaGap(error)) return mem.slice(-limit);
    throw new Error(error.message);
  }

  const list: NearRoomMessage[] = (data || []).map((row) => ({
    id: row.id,
    geohash: row.geohash,
    fromWallet: row.from_wallet,
    body: row.body,
    createdAt: row.created_at,
  }));
  bucket().set(key, list);
  return list;
}

export async function postRoomMessage(input: {
  geohash: string;
  fromWallet: string;
  body: string;
}): Promise<NearRoomMessage> {
  const key = input.geohash.slice(0, 5);
  const text = input.body.trim().slice(0, 500);
  if (!text) throw new Error("Empty message");

  const msg: NearRoomMessage = {
    id: nanoid(16),
    geohash: key,
    fromWallet: input.fromWallet.toLowerCase(),
    body: text,
    createdAt: now(),
  };

  const list = bucket().get(key) || [];
  list.push(msg);
  bucket().set(key, list.slice(-200));

  const client = await db();
  if (client) {
    const { error } = await client.from("near_room_messages").insert({
      id: msg.id,
      geohash: key,
      from_wallet: msg.fromWallet,
      body: msg.body,
      created_at: msg.createdAt,
    });
    if (error && !isSchemaGap(error)) throw new Error(error.message);
  }
  return msg;
}
