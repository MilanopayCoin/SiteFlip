/** Official JIY fungible asset on Supra Move mainnet (suprascan.io). */
export const JIY_TOKEN = {
  name: "Jiy",
  symbol: "JIY",
  decimals: 6,
  /** Metadata / FA object address */
  address:
    "0x66a44e6a5ca3d8d6d00d86759d39ad026e109f2d537bc128dc0aa544f1b6447a",
  explorerUrl:
    "https://suprascan.io/token/0x66a44e6a5ca3d8d6d00d86759d39ad026e109f2d537bc128dc0aa544f1b6447a",
  totalSupplyLabel: "1B",
} as const;

export const SUPRA_MOVE_MAINNET = {
  chainId: "8",
  rpcUrl: "https://rpc-mainnet.supra.com",
  explorerUrl: "https://suprascan.io",
} as const;

const MOVE_ADDR_RE = /^0x[a-fA-F0-9]{64}$/;

export function isMoveAddress(addr: string | null | undefined): boolean {
  return Boolean(addr && MOVE_ADDR_RE.test(addr));
}

/** Human JIY → base units (6 decimals). */
export function jiyToUnits(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid JIY amount");
  const whole = Math.floor(amount);
  const frac = amount - whole;
  const fracStr = frac
    .toFixed(JIY_TOKEN.decimals)
    .slice(2)
    .padEnd(JIY_TOKEN.decimals, "0")
    .slice(0, JIY_TOKEN.decimals);
  const units =
    BigInt(whole) * BigInt(10) ** BigInt(JIY_TOKEN.decimals) + BigInt(fracStr || "0");
  return units.toString();
}

/** Base units (6 decimals) → human JIY number. */
export function unitsToJiy(units: string | number | bigint): number {
  let u: bigint;
  try {
    u = typeof units === "bigint" ? units : BigInt(units || "0");
  } catch {
    return 0;
  }
  if (u < BigInt(0)) return 0;
  const base = BigInt(10) ** BigInt(JIY_TOKEN.decimals);
  const whole = u / base;
  const frac = u % base;
  return Number(whole) + Number(frac) / Number(base);
}

/** Compact display: 1000 → "1.000", 1.5 → "1.5". */
export function formatJiy(amount: number, maxFrac = 2): string {
  if (!Number.isFinite(amount)) return "0";
  if (amount >= 1000) {
    return amount.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  }
  const rounded =
    Math.round(amount * Math.pow(10, maxFrac)) / Math.pow(10, maxFrac);
  return String(rounded);
}

export function unitsToHex(units: string): `0x${string}` {
  return `0x${BigInt(units).toString(16)}` as `0x${string}`;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Canonical 0x + 64 hex lowercase for Move tx hashes. */
export function normalizeTxHash(h: string): string {
  const s = h.trim().toLowerCase();
  const with0x = s.startsWith("0x") ? s : `0x${s}`;
  if (!/^0x[a-f0-9]{64}$/.test(with0x)) {
    throw new Error("Geçersiz tx hash");
  }
  return with0x;
}

/**
 * Lookup forms for legacy rows that may store bare hex or `0x` + hex.
 * Always store new rows with {@link normalizeTxHash}.
 */
export function txHashLookupForms(txHash: string): string[] {
  const canonical = normalizeTxHash(txHash);
  const bare = canonical.slice(2);
  return [canonical, bare];
}

/** Pad Move address to 0x + 64 hex. */
export function normalizeMoveArgAddress(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (!/^[a-f0-9]+$/.test(hex) || hex.length > 64) return "";
  return `0x${hex.padStart(64, "0")}`;
}

/** SupraScan tx deep link (Move mainnet). */
export function jiyTxExplorerUrl(txHash: string): string {
  const h = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  return `${SUPRA_MOVE_MAINNET.explorerUrl}/tx/${h}`;
}

/** SupraScan account deep link. */
export function jiyAccountExplorerUrl(moveAddress: string): string {
  return `${SUPRA_MOVE_MAINNET.explorerUrl}/account/${moveAddress}`;
}
