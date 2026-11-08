import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";

export type NearWave = {
  fromWallet: string;
  toWallet: string;
  createdAt: string;
  /** free = Selam at; gift = Wave on-chain catalog gift */
  source: "free" | "gift";
};

const g = globalThis as unknown as {
  __jiyNearWaves?: NearWave[];
};

function waves() {
  if (!g.__jiyNearWaves) g.__jiyNearWaves = [];
  return g.__jiyNearWaves;
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

export async function recordWave(
  fromWallet: string,
  toWallet: string,
  source: "free" | "gift" = "free"
): Promise<NearWave> {
  const from = norm(fromWallet);
  const to = norm(toWallet);
  if (from === to) throw new Error("Cannot wave yourself");

  const existing = waves().find((w) => w.fromWallet === from && w.toWallet === to);
  if (existing) return existing;

  const rec: NearWave = {
    fromWallet: from,
    toWallet: to,
    createdAt: now(),
    source,
  };
  waves().unshift(rec);

  const client = await db();
  if (client) {
    const { error } = await client.from("near_waves").upsert(
      {
        from_wallet: from,
        to_wallet: to,
        source: rec.source,
        created_at: rec.createdAt,
      },
      { onConflict: "from_wallet,to_wallet" }
    );
    if (error && !isSchemaGap(error)) {
      // keep memory; surface non-schema errors lightly
      console.warn("[near.waves]", error.message);
    }
  }
  return rec;
}

export async function hasWaved(
  fromWallet: string,
  toWallet: string
): Promise<boolean> {
  const from = norm(fromWallet);
  const to = norm(toWallet);
  if (waves().some((w) => w.fromWallet === from && w.toWallet === to)) {
    return true;
  }
  const client = await db();
  if (!client) return false;
  const { data, error } = await client
    .from("near_waves")
    .select("from_wallet")
    .eq("from_wallet", from)
    .eq("to_wallet", to)
    .maybeSingle();
  if (error && isSchemaGap(error)) return false;
  return Boolean(data);
}

export async function isMutualWave(
  a: string,
  b: string
): Promise<boolean> {
  const [ab, ba] = await Promise.all([hasWaved(a, b), hasWaved(b, a)]);
  return ab && ba;
}

export type WaveSummary = {
  /** wallets I waved at */
  outgoing: string[];
  /** wallets that waved at me */
  incoming: string[];
  /** mutual unlocks */
  mutual: string[];
};

export async function listWaveSummary(wallet: string): Promise<WaveSummary> {
  const me = norm(wallet);
  const out = new Set<string>();
  const inn = new Set<string>();

  for (const w of waves()) {
    if (w.fromWallet === me) out.add(w.toWallet);
    if (w.toWallet === me) inn.add(w.fromWallet);
  }

  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("near_waves")
      .select("from_wallet,to_wallet")
      .or(`from_wallet.eq.${me},to_wallet.eq.${me}`)
      .limit(500);
    if (!error || !isSchemaGap(error)) {
      for (const row of data || []) {
        if (row.from_wallet === me) out.add(row.to_wallet);
        if (row.to_wallet === me) inn.add(row.from_wallet);
      }
    }
  }

  const mutual = [...out].filter((w) => inn.has(w));
  return {
    outgoing: [...out],
    incoming: [...inn],
    mutual,
  };
}
