import type { GiftCatalogItem } from "@/lib/near/types";

/** TikTok-style gift catalog — amounts in SUPRA (SupraEVM 18 decimals). */
export const GIFT_CATALOG: GiftCatalogItem[] = [
  {
    id: "wave",
    label: "Selam",
    emoji: "👋",
    amountSupra: 0.1,
    blurb: "İlk merhaba — radar’da nazik sinyal",
  },
  {
    id: "boost",
    label: "Boost",
    emoji: "🔥",
    amountSupra: 1,
    blurb: "Yakındakiler listesinde öne çık",
  },
  {
    id: "spotlight",
    label: "Spotlight",
    emoji: "💎",
    amountSupra: 5,
    blurb: "Odaya animasyon + sesli vurgu",
  },
];

export function getGift(id: string): GiftCatalogItem | undefined {
  return GIFT_CATALOG.find((g) => g.id === id);
}

/** Convert SUPRA amount to wei string (18 decimals). */
export function supraToWei(amount: number): string {
  const whole = Math.floor(amount);
  const frac = amount - whole;
  const fracStr = frac
    .toFixed(18)
    .slice(2)
    .padEnd(18, "0")
    .slice(0, 18);
  const wei =
    BigInt(whole) * BigInt(10) ** BigInt(18) + BigInt(fracStr);
  return wei.toString();
}

export function weiToHex(wei: string): `0x${string}` {
  return `0x${BigInt(wei).toString(16)}` as `0x${string}`;
}
