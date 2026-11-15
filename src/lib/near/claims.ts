import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

export type NearTableClaim = {
  id: string;
  geohash: string;
  wallet: string;
  label: string;
  expiresAt: string;
  createdAt: string;
};

const g = globalThis as unknown as {
  __jiyNearClaims?: Map<string, NearTableClaim>;
};

function claims() {
  if (!g.__jiyNearClaims) g.__jiyNearClaims = new Map();
  return g.__jiyNearClaims;
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

function purgeExpired() {
  const t = Date.now();
  for (const [id, c] of claims()) {
    if (new Date(c.expiresAt).getTime() < t) claims().delete(id);
  }
}

export async function listClaims(
  geohash: string
): Promise<NearTableClaim[]> {
  purgeExpired();
  const key = geohash.slice(0, 5);
  const mem = [...claims().values()].filter(
    (c) => c.geohash === key && new Date(c.expiresAt).getTime() > Date.now()
  );

  const client = await db();
  if (!client) {
    return mem.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const { data, error } = await client
    .from("near_table_claims")
    .select("*")
    .eq("geohash", key)
    .gt("expires_at", now())
    .order("created_at", { ascending: false })
    .limit(40);

  if (error && isSchemaGap(error)) {
    return mem.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (error) throw new Error(error.message);

  const rows: NearTableClaim[] = (data || []).map((row) => ({
    id: row.id,
    geohash: row.geohash,
    wallet: row.wallet,
    label: row.label,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
  for (const r of rows) claims().set(r.id, r);
  // Merge memory (same-isolate freshness)
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const m of mem) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return [...byId.values()]
    .filter((c) => new Date(c.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function claimTable(input: {
  wallet: string;
  geohash: string;
  label: string;
  ttlMinutes?: number;
}): Promise<NearTableClaim> {
  purgeExpired();
  const w = norm(input.wallet);
  const key = input.geohash.slice(0, 5);
  const label = input.label.trim().slice(0, 32) || "Masa";
  const ttl = Math.min(90, Math.max(15, input.ttlMinutes ?? 45));
  const createdAt = now();
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();

  // One active claim per wallet — replace previous
  for (const [id, c] of claims()) {
    if (c.wallet === w) claims().delete(id);
  }

  const rec: NearTableClaim = {
    id: nanoid(14),
    geohash: key,
    wallet: w,
    label,
    expiresAt,
    createdAt,
  };
  claims().set(rec.id, rec);

  const client = await db();
  if (client) {
    await client.from("near_table_claims").delete().eq("wallet", w);
    const { error } = await client.from("near_table_claims").insert({
      id: rec.id,
      geohash: rec.geohash,
      wallet: rec.wallet,
      label: rec.label,
      expires_at: rec.expiresAt,
      created_at: rec.createdAt,
    });
    if (error && !isSchemaGap(error)) throw new Error(error.message);
  }
  return rec;
}

export async function releaseClaim(wallet: string): Promise<void> {
  const w = norm(wallet);
  for (const [id, c] of claims()) {
    if (c.wallet === w) claims().delete(id);
  }
  const client = await db();
  if (client) {
    const { error } = await client
      .from("near_table_claims")
      .delete()
      .eq("wallet", w);
    if (error && !isSchemaGap(error)) throw new Error(error.message);
  }
}

export async function myClaim(
  wallet: string
): Promise<NearTableClaim | null> {
  purgeExpired();
  const w = norm(wallet);
  for (const c of claims().values()) {
    if (c.wallet === w && new Date(c.expiresAt).getTime() > Date.now()) {
      return c;
    }
  }
  const client = await db();
  if (!client) return null;
  const { data, error } = await client
    .from("near_table_claims")
    .select("*")
    .eq("wallet", w)
    .gt("expires_at", now())
    .maybeSingle();
  if (error && isSchemaGap(error)) return null;
  if (!data) return null;
  const rec: NearTableClaim = {
    id: data.id,
    geohash: data.geohash,
    wallet: data.wallet,
    label: data.label,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
  claims().set(rec.id, rec);
  return rec;
}
