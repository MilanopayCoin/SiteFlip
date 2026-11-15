import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeTxHash } from "@/lib/near/jiy-token";

export type SpentTxPurpose = "gift" | "pot";

const g = globalThis as unknown as {
  __jiyNearSpentTxs?: Map<string, SpentTxPurpose>;
};

function mem() {
  if (!g.__jiyNearSpentTxs) g.__jiyNearSpentTxs = new Map();
  return g.__jiyNearSpentTxs;
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

/** True if this canonical hash was already used for a gift or pot credit. */
export async function isMoveTxSpent(txHash: string): Promise<boolean> {
  const h = normalizeTxHash(txHash);
  if (mem().has(h)) return true;

  const client = await db();
  if (!client) return false;

  const { data: spent, error: spentErr } = await client
    .from("near_spent_move_txs")
    .select("tx_hash")
    .eq("tx_hash", h)
    .maybeSingle();
  if (!spentErr && spent) {
    mem().set(h, "gift");
    return true;
  }
  if (spentErr && !isSchemaGap(spentErr)) {
    // fall through to legacy tables
  }

  const { data: gift } = await client
    .from("near_gifts")
    .select("id")
    .eq("tx_hash", h)
    .maybeSingle();
  if (gift) {
    mem().set(h, "gift");
    return true;
  }

  const { data: pot } = await client
    .from("near_place_pot_events")
    .select("id")
    .eq("tx_hash", h)
    .maybeSingle();
  if (pot) {
    mem().set(h, "pot");
    return true;
  }

  return false;
}

/**
 * Atomically mark a verified Move tx as spent.
 * Throws if already consumed (memory or unique DB constraint).
 */
export async function consumeMoveTx(
  txHash: string,
  purpose: SpentTxPurpose
): Promise<string> {
  const h = normalizeTxHash(txHash);
  if (mem().has(h)) {
    throw new Error("Bu txHash zaten kullanıldı");
  }

  const client = await db();
  if (client) {
    const { error } = await client.from("near_spent_move_txs").insert({
      tx_hash: h,
      purpose,
      created_at: new Date().toISOString(),
    });
    if (error) {
      if (isSchemaGap(error)) {
        // Table missing — fall back to legacy uniqueness checks.
        if (await isMoveTxSpent(h)) {
          throw new Error("Bu txHash zaten kullanıldı");
        }
      } else if (
        error.code === "23505" ||
        String(error.message || "").toLowerCase().includes("duplicate")
      ) {
        throw new Error("Bu txHash zaten kullanıldı");
      } else {
        throw new Error(error.message || "tx spend failed");
      }
    }
  } else if (await isMoveTxSpent(h)) {
    throw new Error("Bu txHash zaten kullanıldı");
  }

  mem().set(h, purpose);
  return h;
}
