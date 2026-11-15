import { HexString, SupraClient } from "supra-l1-sdk";
import {
  isMoveAddress,
  JIY_TOKEN,
  jiyToUnits,
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

function normHash(h: string): string {
  const s = h.trim().toLowerCase();
  return s.startsWith("0x") ? s : `0x${s}`;
}

function normAddr(a: string): string {
  return a.trim().toLowerCase();
}

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

function normalizeMoveArgAddress(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (s.startsWith("0x") && s.length === 66) return s;
  if (s.startsWith("0x")) {
    const hex = s.slice(2).padStart(64, "0");
    return `0x${hex}`;
  }
  return `0x${s.padStart(64, "0")}`;
}

/**
 * Verify a Supra Move mainnet JIY FA transfer matches expected gift.
 * Uses RPC `/rpc/v3/transactions/{hash}` (+ SDK detail when available).
 */
export async function verifyJiyGiftTransfer(
  proof: JiyGiftTxProof
): Promise<VerifiedJiyGiftTx> {
  const txHash = normHash(proof.txHash);
  const fromMove = normAddr(proof.fromMove);
  const toMove = normAddr(proof.toMove);
  if (!/^0x[a-f0-9]{64}$/.test(txHash)) {
    throw new Error("Geçersiz tx hash");
  }
  if (!isMoveAddress(fromMove) || !isMoveAddress(toMove)) {
    throw new Error("Move adresleri gerekli");
  }
  const expectedUnits = jiyToUnits(proof.amountJiy);

  const client = await SupraClient.init(SUPRA_MOVE_MAINNET.rpcUrl);

  // Prefer SDK detail (parses status + insights).
  let detail: Awaited<ReturnType<SupraClient["getTransactionDetail"]>> = null;
  try {
    detail = await client.getTransactionDetail(
      HexString.ensure(fromMove),
      txHash
    );
  } catch {
    detail = null;
  }

  const status = detail?.status;
  if (detail && !isSuccessStatus(status)) {
    throw new Error(`JIY tx başarısız (${String(status)})`);
  }

  // Raw RPC for entry-function args (FA transfer not always in coin insights).
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
    status;
  if (!isSuccessStatus(rawStatus) && rawStatus !== undefined) {
    // Some nodes return executed without Success enum — allow SDK Success only.
    if (!detail || !isSuccessStatus(detail.status)) {
      throw new Error(`JIY tx henüz onaylı değil (${String(rawStatus)})`);
    }
  }

  const header = (raw.header || {}) as Record<string, unknown>;
  const senderRaw =
    (header.sender as { Move?: string } | undefined)?.Move ||
    (typeof header.sender === "string" ? header.sender : null) ||
    detail?.sender ||
    "";
  const sender = normalizeMoveArgAddress(String(senderRaw));
  if (sender !== fromMove) {
    throw new Error("Tx gönderen Move adresi eşleşmiyor");
  }

  const parsed = extractMovePayload(raw);
  if (!parsed?.functionFull) {
    throw new Error("Tx payload okunamadı");
  }
  const fn = parsed.functionFull.toLowerCase();
  const isFaTransfer =
    fn.includes("primary_fungible_store::transfer") ||
    fn.endsWith("::transfer");
  if (!isFaTransfer) {
    throw new Error("Tx JIY FA transfer değil");
  }

  const args = parsed.args.map(argToString);
  // Common layouts: [metadata, to, amount] or [to, metadata, amount]
  let meta = "";
  let recipient = "";
  let amount = "";
  if (args.length >= 3) {
    const a0 = normalizeMoveArgAddress(args[0]!);
    const a1 = normalizeMoveArgAddress(args[1]!);
    if (a0 === JIY_TOKEN.address.toLowerCase()) {
      meta = a0;
      recipient = a1;
      amount = args[2]!;
    } else if (a1 === JIY_TOKEN.address.toLowerCase()) {
      recipient = a0;
      meta = a1;
      amount = args[2]!;
    } else {
      // Prefer first 64-hex as meta if matches length
      meta = a0;
      recipient = a1;
      amount = args[2]!;
    }
  }

  if (meta && meta !== JIY_TOKEN.address.toLowerCase()) {
    throw new Error("Tx JIY metadata adresi değil");
  }
  if (recipient && recipient !== toMove) {
    throw new Error("Tx alıcı Move adresi eşleşmiyor");
  }

  let units = amount.replace(/^0+/, "") || "0";
  try {
    units = BigInt(amount).toString();
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
    status: String(rawStatus || status || "Success"),
  };
}
