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

export function unitsToHex(units: string): `0x${string}` {
  return `0x${BigInt(units).toString(16)}` as `0x${string}`;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
