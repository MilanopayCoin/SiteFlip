export type TimeLayer = "past" | "present" | "future";

export type SymbolId =
  | "gear"
  | "hammer"
  | "coal"
  | "clock"
  | "shield"
  | "sword"
  | "armor"
  | "smith"
  | "wild"
  | "scatter"
  | "iron"
  | "mystery";

export type ForgeTier = "none" | "bronze" | "silver" | "gold";

export type FurnaceChoice = "past" | "present" | "future";

export const REEL_COUNT = 5;
export const ROW_COUNT = 4;

export type Grid = SymbolId[][];

export type WinLine = {
  symbol: SymbolId;
  reels: number;
  ways: number;
  payout: number;
};

export type SpinResult = {
  grid: Grid;
  wins: WinLine[];
  totalWin: number;
  scatterCount: number;
  wildCount: number;
  ironCount: number;
  artifactFound: boolean;
  timeShift: boolean;
  fusion: boolean;
  mysteryReel: number | null;
  expandedWildReels: number[];
};

export type GamePhase =
  | "base"
  | "forge_pick"
  | "free_spins"
  | "grand_forge";
