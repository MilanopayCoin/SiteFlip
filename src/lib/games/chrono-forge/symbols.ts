import type { SymbolId, TimeLayer } from "./types";

export type SymbolDef = {
  id: SymbolId;
  label: string;
  emoji: string;
  tier: "low" | "high" | "special";
  pays: Record<number, number>;
};

/** Demo paytable: multiplier × bet per way for N consecutive reels (3–5). */
export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  gear: {
    id: "gear",
    label: "Çark",
    emoji: "⚙️",
    tier: "low",
    pays: { 3: 0.2, 4: 0.5, 5: 1.2 },
  },
  hammer: {
    id: "hammer",
    label: "Çekiç",
    emoji: "🔨",
    tier: "low",
    pays: { 3: 0.25, 4: 0.6, 5: 1.5 },
  },
  coal: {
    id: "coal",
    label: "Kömür",
    emoji: "🪨",
    tier: "low",
    pays: { 3: 0.3, 4: 0.7, 5: 1.8 },
  },
  clock: {
    id: "clock",
    label: "Dişli Saat",
    emoji: "🕰️",
    tier: "low",
    pays: { 3: 0.35, 4: 0.85, 5: 2 },
  },
  shield: {
    id: "shield",
    label: "Ejder Kalkanı",
    emoji: "🛡️",
    tier: "high",
    pays: { 3: 0.8, 4: 2.5, 5: 6 },
  },
  sword: {
    id: "sword",
    label: "Zaman Kılıcı",
    emoji: "⚔️",
    tier: "high",
    pays: { 3: 1, 4: 3, 5: 8 },
  },
  armor: {
    id: "armor",
    label: "Kristal Zırh",
    emoji: "💎",
    tier: "high",
    pays: { 3: 1.2, 4: 4, 5: 10 },
  },
  smith: {
    id: "smith",
    label: "Demirci Ustası",
    emoji: "👨‍🏭",
    tier: "high",
    pays: { 3: 1.5, 4: 5, 5: 15 },
  },
  wild: {
    id: "wild",
    label: "Zaman Çekici",
    emoji: "⏳",
    tier: "special",
    pays: {},
  },
  scatter: {
    id: "scatter",
    label: "Portal Kapısı",
    emoji: "🌀",
    tier: "special",
    pays: {},
  },
  iron: {
    id: "iron",
    label: "Demir",
    emoji: "🔩",
    tier: "special",
    pays: {},
  },
  mystery: {
    id: "mystery",
    label: "Örs Gölgesi",
    emoji: "❔",
    tier: "special",
    pays: {},
  },
};

export const PAYABLE: SymbolId[] = [
  "gear",
  "hammer",
  "coal",
  "clock",
  "shield",
  "sword",
  "armor",
  "smith",
];

export function layerForReel(reel: number): TimeLayer {
  if (reel <= 1) return "past";
  if (reel === 2) return "present";
  return "future";
}

export const LAYER_STYLES: Record<
  TimeLayer,
  { label: string; border: string; glow: string; bg: string }
> = {
  past: {
    label: "Geçmiş",
    border: "border-amber-700/60",
    glow: "shadow-[inset_0_0_24px_rgba(180,83,9,0.25)]",
    bg: "bg-amber-950/40",
  },
  present: {
    label: "Şimdi",
    border: "border-teal-600/50",
    glow: "shadow-[inset_0_0_24px_rgba(20,184,166,0.2)]",
    bg: "bg-teal-950/30",
  },
  future: {
    label: "Gelecek",
    border: "border-violet-600/50",
    glow: "shadow-[inset_0_0_24px_rgba(139,92,246,0.25)]",
    bg: "bg-violet-950/35",
  },
};

export const DEMO_RTP_NOTE =
  "Demo RTP hedefi %96.5 · Yüksek volatilite · Max win demo: 5000×";
