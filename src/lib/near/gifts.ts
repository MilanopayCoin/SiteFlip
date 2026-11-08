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
    id: "heart",
    label: "Kalp",
    emoji: "💗",
    amountSupra: 0.5,
    blurb: "Yumuşak vurgu — skor +5",
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
  {
    id: "crown",
    label: "Taç",
    emoji: "👑",
    amountSupra: 10,
    blurb: "Gece tahtı — liderlik board’unda zirve",
  },
];

/** Leaderboard weights — higher gifts dominate the board. */
export const GIFT_SCORE: Record<string, number> = {
  wave: 1,
  heart: 5,
  boost: 10,
  spotlight: 50,
  crown: 100,
};

export function giftScore(giftId: string): number {
  return GIFT_SCORE[giftId] ?? 1;
}

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
