import { HexString, SupraClient } from "supra-l1-sdk";
import {
  isMoveAddress,
  JIY_TOKEN,
  jiyToUnits,
  normalizeMoveArgAddress,
  normalizeTxHash,
  SUPRA_MOVE_MAINNET,
} from "@/lib/near/jiy-token";

export type JiyGiftTxProof = {
  txHash: string;
  fromMove: string;
  toMove: string;
  amountJiy: number;
};

export type VerifiedJiyGiftTx = {
  txHash: string;
  fromMove: string;
  toMove: string;
  amountUnits: string;
  status: string;
};

export { normalizeMoveArgAddress, normalizeTxHash };

function isSuccessStatus(status: unknown): boolean {
  const s = String(status || "");
  return s === "Success" || s === "success" || s === "Executed";
}

function extractMovePayload(raw: Record<string, unknown>): {
  functionFull?: string;
  typeArgs: string[];
  args: unknown[];
} | null {
  const payload = (raw.payload || raw.transaction_payload || {}) as Record<
    string,
    unknown
  >;
  const move =
    (payload.Move as Record<string, unknown> | undefined) ||
    (payload as Record<string, unknown>);
  if (!move) return null;

  const entry =
    (move.EntryFunction as Record<string, unknown> | undefined) ||
    (move.type === "entry_function_payload" ? move : null) ||
    null;

  if (entry && typeof entry === "object") {
    if (typeof entry.function === "string") {
      return {
        functionFull: entry.function,
        typeArgs: Array.isArray(entry.type_arguments)
          ? (entry.type_arguments as string[])
          : [],
        args: Array.isArray(entry.arguments) ? entry.arguments : [],
      };
    }
    const mod = entry.module as { address?: string; name?: string } | undefined;
    const fn = entry.function as string | undefined;
    if (mod?.address && mod?.name && fn) {
      return {
        functionFull: `${mod.address}::${mod.name}::${fn}`,
        typeArgs: Array.isArray(entry.ty_args)
          ? (entry.ty_args as unknown[]).map(String)
          : [],
        args: Array.isArray(entry.args) ? entry.args : [],
      };
    }
  }

  if (typeof move.function === "string") {
    return {
      functionFull: move.function,
      typeArgs: Array.isArray(move.type_arguments)
        ? (move.type_arguments as string[])
        : [],
      args: Array.isArray(move.arguments) ? move.arguments : [],
    };
  }
  return null;
}

function argToString(arg: unknown): string {
  if (typeof arg === "string" || typeof arg === "number" || typeof arg === "bigint") {
    return String(arg);
  }
  if (arg && typeof arg === "object") {
    const o = arg as Record<string, unknown>;
    if ("Address" in o) return String(o.Address);
    if ("U64" in o) return String(o.U64);
    if ("inner" in o) return String(o.inner);
    if ("value" in o) return String(o.value);
  }
  return "";
}

function normalizeFunctionFull(fn: string): string {
  const parts = fn.toLowerCase().split("::");
  if (parts.length < 3) return fn.toLowerCase();
  const addr = normalizeMoveArgAddress(parts[0]!);
  return `${addr}::${parts.slice(1).join("::")}`;
}

const ALLOWED_FA_TRANSFER = normalizeFunctionFull(
  "0x1::primary_fungible_store::transfer"
);

/**
 * Verify a Supra Move mainnet JIY FA transfer matches expected gift.
 * Strict: only `0x1::primary_fungible_store::transfer` with JIY metadata,
 * exact recipient, and exact amount — all required (no empty skip).
 */
export async function verifyJiyGiftTransfer(
  proof: JiyGiftTxProof
): Promise<VerifiedJiyGiftTx> {
  const txHash = normalizeTxHash(proof.txHash);
  const fromMove = normalizeMoveArgAddress(proof.fromMove);
  const toMove = normalizeMoveArgAddress(proof.toMove);
  if (!isMoveAddress(fromMove) || !isMoveAddress(toMove)) {
    throw new Error("Move adresleri gerekli");
  }
  if (fromMove === toMove) {
    throw new Error("Move self-transfer kabul edilmez");
  }
  const expectedUnits = jiyToUnits(proof.amountJiy);
  const jiyMeta = normalizeMoveArgAddress(JIY_TOKEN.address);

  const client = await SupraClient.init(SUPRA_MOVE_MAINNET.rpcUrl);

  let detail: Awaited<ReturnType<SupraClient["getTransactionDetail"]>> = null;
  try {
    detail = await client.getTransactionDetail(
      HexString.ensure(fromMove),
      txHash
    );
  } catch {
    detail = null;
  }

  if (detail && !isSuccessStatus(detail.status)) {
    throw new Error(`JIY tx başarısız (${String(detail.status)})`);
  }

  const rpcRes = await fetch(
    `${SUPRA_MOVE_MAINNET.rpcUrl}/rpc/v3/transactions/${txHash}`,
    { cache: "no-store" }
  );
  if (!rpcRes.ok) {
    throw new Error("Move mainnet tx bulunamadı");
  }
  const raw = (await rpcRes.json()) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") {
    throw new Error("Move mainnet tx bulunamadı");
  }

  const rawStatus =
    raw.status ||
    (raw.header as { status?: string } | undefined)?.status ||
    detail?.status;
  if (!isSuccessStatus(rawStatus)) {
    throw new Error(`JIY tx henüz onaylı değil (${String(rawStatus)})`);
  }

  const header = (raw.header || {}) as Record<string, unknown>;
  const senderRaw =
    (header.sender as { Move?: string } | undefined)?.Move ||
    (typeof header.sender === "string" ? header.sender : null) ||
    detail?.sender ||
    "";
  const sender = normalizeMoveArgAddress(String(senderRaw));
  if (!sender || sender !== fromMove) {
    throw new Error("Tx gönderen Move adresi eşleşmiyor");
  }

  const parsed = extractMovePayload(raw);
  if (!parsed?.functionFull) {
    throw new Error("Tx payload okunamadı");
  }
  const fn = normalizeFunctionFull(parsed.functionFull);
  if (fn !== ALLOWED_FA_TRANSFER) {
    throw new Error(
      "Tx yalnızca 0x1::primary_fungible_store::transfer olmalı"
    );
  }

  // Type arg should be fungible_asset::Metadata when present.
  if (parsed.typeArgs.length > 0) {
    const joined = parsed.typeArgs.map((t) => String(t).toLowerCase()).join(" ");
    if (!joined.includes("fungible_asset::metadata")) {
      throw new Error("Tx Metadata type arg eksik");
    }
  }

  if (parsed.args.length < 3) {
    throw new Error("Tx FA transfer argümanları eksik");
  }

  const a0 = normalizeMoveArgAddress(argToString(parsed.args[0]));
  const a1 = normalizeMoveArgAddress(argToString(parsed.args[1]));
  const amountRaw = argToString(parsed.args[2]);

  // Canonical layout: [metadata, recipient, amount]
  let meta = "";
  let recipient = "";
  if (a0 === jiyMeta) {
    meta = a0;
    recipient = a1;
  } else if (a1 === jiyMeta) {
    // Rare alternate layout — still require JIY meta present.
    meta = a1;
    recipient = a0;
  } else {
    throw new Error("Tx JIY metadata adresi değil");
  }

  if (!meta || meta !== jiyMeta) {
    throw new Error("Tx JIY metadata adresi değil");
  }
  if (!recipient || recipient !== toMove) {
    throw new Error("Tx alıcı Move adresi eşleşmiyor");
  }
  if (!amountRaw) {
    throw new Error("Tx miktarı okunamadı");
  }

  let units: string;
  try {
    units = BigInt(amountRaw).toString();
  } catch {
    throw new Error("Tx miktarı okunamadı");
  }
  if (units !== expectedUnits) {
    throw new Error(
      `Tx miktarı uyuşmuyor · beklenen ${expectedUnits} units, gelen ${units}`
    );
  }

  return {
    txHash,
    fromMove,
    toMove,
    amountUnits: units,
    status: String(rawStatus || "Success"),
  };
}
