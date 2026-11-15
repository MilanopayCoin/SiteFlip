import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeTxHash, txHashLookupForms } from "@/lib/near/jiy-token";

export type SpentTxPurpose = "gift" | "pot" | "bet";

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

function isUniqueViolation(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  return (
    err.code === "23505" ||
    String(err.message || "").toLowerCase().includes("duplicate")
  );
}

function markSpentAliases(h: string, purpose: SpentTxPurpose) {
  for (const form of txHashLookupForms(h)) mem().set(form, purpose);
}

function clearSpentAliases(h: string) {
  for (const form of txHashLookupForms(h)) mem().delete(form);
}

/** True if this canonical hash was already used for a gift or pot credit. */
export async function isMoveTxSpent(txHash: string): Promise<boolean> {
  const h = normalizeTxHash(txHash);
  const forms = txHashLookupForms(h);
  if (forms.some((f) => mem().has(f))) return true;

  const client = await db();
  if (!client) return false;

  const { data: spent, error: spentErr } = await client
    .from("near_spent_move_txs")
    .select("tx_hash")
    .in("tx_hash", forms)
    .limit(1)
    .maybeSingle();
  if (!spentErr && spent) {
    markSpentAliases(h, "gift");
    return true;
  }
  const spentMissing = Boolean(spentErr && isSchemaGap(spentErr));
  if (spentErr && !spentMissing) {
    throw new Error(spentErr.message || "spent lookup failed");
  }

  // Verified Move gifts (pre- or post-spend-ledger) still count.
  const { data: gift } = await client
    .from("near_gifts")
    .select("id")
    .in("tx_hash", forms)
    .limit(1)
    .maybeSingle();
  if (gift) {
    markSpentAliases(h, "gift");
    return true;
  }

  // Pot events are only consulted when the spend ledger table is missing.
  // Verified pots write near_spent_move_txs via consumeMoveTx; unverified
  // pot hashes must never burn a real Move payment in the shared spend set.
  if (spentMissing) {
    const { data: pot } = await client
      .from("near_place_pot_events")
      .select("id")
      .in("tx_hash", forms)
      .limit(1)
      .maybeSingle();
    if (pot) {
      markSpentAliases(h, "pot");
      return true;
    }
  }

  return false;
}

/**
 * Atomically mark a verified Move tx as spent (DB PK).
 * Fail-closed when Supabase is configured but `near_spent_move_txs` is missing.
 */
export async function consumeMoveTx(
  txHash: string,
  purpose: SpentTxPurpose
): Promise<string> {
  const h = normalizeTxHash(txHash);
  if (txHashLookupForms(h).some((f) => mem().has(f))) {
    throw new Error("Bu txHash zaten kullanıldı");
  }

  // Reserve in-process before await to shrink same-isolate races.
  markSpentAliases(h, purpose);

  const client = await db();
  if (!client) {
    // Memory-only (no Supabase) — best-effort single isolate.
    return h;
  }

  const { error } = await client.from("near_spent_move_txs").insert({
    tx_hash: h,
    purpose,
    created_at: new Date().toISOString(),
  });

  if (error) {
    clearSpentAliases(h);
    if (isSchemaGap(error)) {
      throw new Error(
        "near_spent_move_txs yok — migration 017 uygula (Move tx spend zorunlu)"
      );
    }
    if (isUniqueViolation(error)) {
      throw new Error("Bu txHash zaten kullanıldı");
    }
    throw new Error(error.message || "tx spend failed");
  }

  return h;
}
