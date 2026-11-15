import { jiyToUnits, unitsToHex } from "@/lib/near/jiy-token";
import type { GiftCatalogItem } from "@/lib/near/types";

/** TikTok-style gift catalog — amounts in JIY (Supra Move FA, 6 decimals). */
export const GIFT_CATALOG: GiftCatalogItem[] = [
  {
    id: "wave",
    label: "Selam",
    emoji: "👋",
    amountJiy: 1,
    blurb: "İlk merhaba — radar’da nazik sinyal",
  },
  {
    id: "heart",
    label: "Kalp",
    emoji: "💗",
    amountJiy: 5,
    blurb: "Yumuşak vurgu — skor +5",
  },
  {
    id: "boost",
    label: "Boost",
    emoji: "🔥",
    amountJiy: 10,
    blurb: "Yakındakiler listesinde öne çık",
  },
  {
    id: "spotlight",
    label: "Spotlight",
    emoji: "💎",
    amountJiy: 50,
    blurb: "Odaya animasyon + sesli vurgu",
  },
  {
    id: "crown",
    label: "Taç",
    emoji: "👑",
    amountJiy: 100,
    blurb: "Gece tahtı — liderlik board’unda zirve",
  },
  {
    id: "rocket",
    label: "Roket",
    emoji: "🚀",
    amountJiy: 250,
    blurb: "TikTok vibe — 3D sahne + sesli odada patlama",
  },
  {
    id: "universe",
    label: "Evren",
    emoji: "🌌",
    amountJiy: 1000,
    blurb: "Mega gift — tüm odaya full-screen 3D show",
  },
];

/** Leaderboard weights — higher gifts dominate the board. */
export const GIFT_SCORE: Record<string, number> = {
  wave: 1,
  heart: 5,
  boost: 10,
  spotlight: 50,
  crown: 100,
  rocket: 250,
  universe: 500,
};

export function giftScore(giftId: string): number {
  return GIFT_SCORE[giftId] ?? 1;
}

export function getGift(id: string): GiftCatalogItem | undefined {
  return GIFT_CATALOG.find((g) => g.id === id);
}

/** One-tap openers for empty nearby chats. */
export const ICEBREAKERS = [
  "Bu civarda favori mekanın?",
  "Ne içiyorsun / yiyorsun?",
  "Kaç dakikardır buradasın?",
  "Radar’da mıydın yoksa davetle mi geldin?",
  "Bir boost hak ediyorum 🔥 — sen?",
] as const;

/** @deprecated use jiyToUnits — kept for pot ledger wei strings */
export function supraToWei(amount: number): string {
  return jiyToUnits(amount);
}

export function weiToHex(wei: string): `0x${string}` {
  return unitsToHex(wei);
}
