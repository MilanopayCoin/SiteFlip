import {
  PAYABLE,
  SYMBOLS,
  layerForReel,
} from "./symbols";
import type {
  FurnaceChoice,
  Grid,
  SpinResult,
  SymbolId,
  WinLine,
} from "./types";
import { REEL_COUNT, ROW_COUNT } from "./types";

function randInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function baseWeights(reel: number): Record<SymbolId, number> {
  const layer = layerForReel(reel);
  const w: Record<SymbolId, number> = {
    gear: 12,
    hammer: 12,
    coal: 10,
    clock: 10,
    shield: 6,
    sword: 5,
    armor: 4,
    smith: 3,
    wild: 2,
    scatter: 2,
    iron: 3,
    mystery: 0,
  };
  if (layer === "past") {
    w.gear += 8;
    w.hammer += 6;
    w.iron += 5;
    w.smith -= 2;
    w.armor -= 1;
  } else if (layer === "future") {
    w.shield += 4;
    w.sword += 4;
    w.armor += 3;
    w.smith += 3;
    w.wild += 1;
    w.gear -= 4;
  }
  return w;
}

function rollSymbol(reel: number, inFreeSpins: boolean): SymbolId {
  const w = { ...baseWeights(reel) };
  if (inFreeSpins) {
    w.wild += 2;
    w.scatter += 1;
  }
  if (Math.random() < 0.06) {
    w.mystery = 8;
  }
  return pickWeighted(w);
}

function buildGrid(inFreeSpins: boolean): Grid {
  const grid: Grid = [];
  for (let c = 0; c < REEL_COUNT; c++) {
    const col: SymbolId[] = [];
    for (let r = 0; r < ROW_COUNT; r++) {
      col.push(rollSymbol(c, inFreeSpins));
    }
    grid.push(col);
  }
  return grid;
}

function matchesSymbol(cell: SymbolId, target: SymbolId): boolean {
  if (cell === "wild") return true;
  if (cell === "mystery") return false;
  return cell === target;
}

function countOnReel(grid: Grid, reel: number, symbol: SymbolId): number {
  let n = 0;
  for (let r = 0; r < ROW_COUNT; r++) {
    const cell = grid[reel][r];
    if (matchesSymbol(cell, symbol)) n++;
  }
  return n;
}

function evaluateWays(grid: Grid, bet: number, multiplier: number): WinLine[] {
  const wins: WinLine[] = [];
  for (const symbol of PAYABLE) {
    let reels = 0;
    let ways = 1;
    for (let c = 0; c < REEL_COUNT; c++) {
      const onReel = countOnReel(grid, c, symbol);
      if (onReel === 0) break;
      reels++;
      ways *= onReel;
    }
    if (reels >= 3) {
      const payKey = reels as 3 | 4 | 5;
      const mult = SYMBOLS[symbol].pays[payKey] ?? 0;
      if (mult > 0) {
        wins.push({
          symbol,
          reels,
          ways,
          payout: bet * mult * ways * multiplier,
        });
      }
    }
  }
  return wins;
}

function resolveMystery(grid: Grid): { grid: Grid; mysteryReel: number | null } {
  const copy = grid.map((col) => [...col]);
  const mysteryReel = copy.findIndex((col) => col.some((s) => s === "mystery"));
  if (mysteryReel < 0) return { grid: copy, mysteryReel: null };

  const layer = layerForReel(mysteryReel);
  const revealPool: SymbolId[] =
    layer === "past"
      ? ["gear", "hammer", "iron", "wild"]
      : layer === "future"
        ? ["sword", "armor", "smith", "wild"]
        : ["shield", "sword", "clock", "wild"];

  const reveal = revealPool[randInt(revealPool.length)]!;
  for (let r = 0; r < ROW_COUNT; r++) {
    if (copy[mysteryReel]![r] === "mystery") {
      copy[mysteryReel]![r] = reveal;
    }
  }
  return { grid: copy, mysteryReel };
}

function expandWilds(grid: Grid): { grid: Grid; expandedWildReels: number[] } {
  const copy = grid.map((col) => [...col]);
  const expanded: number[] = [];
  for (let c = 0; c < REEL_COUNT; c++) {
    const hasWild = copy[c]!.some((s) => s === "wild");
    if (hasWild) {
      expanded.push(c);
      for (let r = 0; r < ROW_COUNT; r++) {
        copy[c]![r] = "wild";
      }
    }
  }
  return { grid: copy, expandedWildReels: expanded };
}

function swapPastFuture(grid: Grid): Grid {
  const copy = grid.map((col) => [...col]);
  const left = [copy[0], copy[1]] as const;
  copy[0] = left[1]!.slice() as SymbolId[];
  copy[1] = left[0]!.slice() as SymbolId[];
  const right = [copy[3], copy[4]] as const;
  copy[3] = right[1]!.slice() as SymbolId[];
  copy[4] = right[0]!.slice() as SymbolId[];
  return copy;
}

function fuseOuterReels(grid: Grid): Grid {
  return grid.map((col) => [...col]);
}

export function forgeTierFromMeter(meter: number): "none" | "bronze" | "silver" | "gold" {
  if (meter >= 100) return "gold";
  if (meter >= 66) return "silver";
  if (meter >= 33) return "bronze";
  return "none";
}

export function meterGainFromSpin(
  wildCount: number,
  ironCount: number,
  inFreeSpins: boolean
): number {
  const base = wildCount * 8 + ironCount * 5;
  return inFreeSpins ? base * 1.2 : base;
}

export type SpinOptions = {
  bet: number;
  inFreeSpins: boolean;
  winMultiplier: number;
  forceTimeShift?: boolean;
};

export function spin(options: SpinOptions): SpinResult {
  let grid = buildGrid(options.inFreeSpins);
  const timeShift =
    options.forceTimeShift ?? (Math.random() < (options.inFreeSpins ? 0.12 : 0.08));
  const fusion = timeShift && Math.random() < 0.22;

  if (timeShift) {
    grid = swapPastFuture(grid);
  }
  if (fusion) {
    grid = fuseOuterReels(grid);
  }

  const { grid: afterMystery, mysteryReel } = resolveMystery(grid);
  grid = afterMystery;

  const { grid: afterWild, expandedWildReels } = expandWilds(grid);
  grid = afterWild;

  let wildCount = 0;
  let ironCount = 0;
  let scatterCount = 0;
  for (const col of grid) {
    for (const s of col) {
      if (s === "wild") wildCount++;
      if (s === "iron") ironCount++;
      if (s === "scatter") scatterCount++;
    }
  }

  const wins = evaluateWays(grid, options.bet, options.winMultiplier);
  const totalWin = wins.reduce((s, w) => s + w.payout, 0);

  const artifactFound = Math.random() < 0.14;

  return {
    grid,
    wins,
    totalWin,
    scatterCount,
    wildCount,
    ironCount,
    artifactFound,
    timeShift,
    fusion,
    mysteryReel,
    expandedWildReels,
  };
}

export function scatterFreeSpins(count: number): number {
  if (count >= 5) return 20;
  if (count >= 4) return 15;
  if (count >= 3) return 10;
  return 0;
}

export function resolveForgePick(
  choice: FurnaceChoice,
  bet: number
): { payout: number; message: string } {
  const roll = Math.random();
  if (choice === "past") {
    const mult = roll < 0.5 ? 5 : roll < 0.85 ? 12 : 25;
    return {
      payout: bet * mult,
      message: `Geçmiş fırını: ${mult}× sticky wild enerjisi — ${mult}× ödeme`,
    };
  }
  if (choice === "present") {
    const mult = roll < 0.45 ? 8 : roll < 0.8 ? 18 : 35;
    return {
      payout: bet * mult,
      message: `Şimdi fırını: genişleyen wild + re-spin — ${mult}× ödeme`,
    };
  }
  const mult = roll < 0.35 ? 15 : roll < 0.7 ? 40 : roll < 0.92 ? 80 : 150;
  return {
    payout: bet * mult,
    message: `Gelecek fırını: cascade çarpanı — ${mult}× ödeme`,
  };
}

export function resolveGrandForge(bet: number): { payout: number; jackpot: boolean } {
  const roll = Math.random();
  if (roll < 0.02) {
    return { payout: bet * 500, jackpot: true };
  }
  if (roll < 0.25) return { payout: bet * 60, jackpot: false };
  if (roll < 0.6) return { payout: bet * 25, jackpot: false };
  return { payout: bet * 12, jackpot: false };
}

export function instantBronzeForge(bet: number): number {
  return bet * (3 + Math.floor(Math.random() * 8));
}
