import { nanoid } from "nanoid";

/** European roulette reds. */
export const ROULETTE_REDS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/** Physical European wheel order (clockwise). */
export const EUROPEAN_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export type RouletteColor = "red" | "black" | "green";

export function colorOf(n: number): RouletteColor {
  if (n === 0) return "green";
  return ROULETTE_REDS.has(n) ? "red" : "black";
}

export type RoulettePhase = "lobby" | "betting" | "spinning" | "result";

export type RouletteBetKind =
  | "straight"
  | "split"
  | "street"
  | "corner"
  | "line"
  | "dozen"
  | "column"
  | "red"
  | "black"
  | "even"
  | "odd"
  | "low"
  | "high";

/** Profit multiplier (stake returned + profit*stake on win). */
export const PAYOUT: Record<RouletteBetKind, number> = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  line: 5,
  dozen: 2,
  column: 2,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
};

export const CHIP_DENOMS = [10, 25, 50, 100, 250, 500] as const;

export type RouletteSeat = {
  index: number;
  wallet: string;
  displayName: string;
  avatarEmoji: string;
  seatedAt: string;
  camOn: boolean;
};

export type RouletteBet = {
  id: string;
  wallet: string;
  kind: RouletteBetKind;
  /** Covered numbers (empty for pure outside when derived). */
  numbers: number[];
  /** dozen/column index 1–3 when relevant */
  meta?: number;
  amount: number;
  label: string;
  createdAt: string;
};

export type RouletteSpin = {
  number: number;
  color: RouletteColor;
  commitHash: string;
  revealSeed: string;
  spunAt: string;
};

export type RouletteRoundNet = {
  wallet: string;
  /** Net chip change this round (won - lost stake). */
  net: number;
  staked: number;
  returned: number;
};

export type RouletteTable = {
  id: string;
  hostWallet: string;
  label: string;
  phase: RoulettePhase;
  phaseEndsAt: string | null;
  seats: (RouletteSeat | null)[];
  bets: RouletteBet[];
  balances: Record<string, number>;
  lastSpin: RouletteSpin | null;
  history: RouletteSpin[];
  /** Per-wallet net for the spin currently shown. */
  lastRoundNets: RouletteRoundNet[];
  /** Host: when result ends, auto open next betting round. */
  autoStart: boolean;
  round: number;
  createdAt: string;
  updatedAt: string;
  _seed?: string;
  _commit?: string;
};

export type RoulettePublic = Omit<RouletteTable, "_seed" | "_commit"> & {
  commitHash: string | null;
};

export type RouletteSignal = {
  id: number;
  tableId: string;
  fromWallet: string;
  toWallet: string;
  kind: "offer" | "answer" | "ice" | "hangup";
  payload: unknown;
  createdAt: string;
};

const SEAT_COUNT = 8;
const BETTING_MS = 30_000;
const SPINNING_MS = 9_000;
const RESULT_MS = 8_000;
const START_CHIPS = 5_000;
const MAX_BETS_PER_PLAYER = 40;
const MAX_TOTAL_STAKE = 2_500;

const g = globalThis as unknown as {
  __jiyRouletteTables?: Map<string, RouletteTable>;
  __jiyRouletteSignals?: RouletteSignal[];
  __jiyRouletteSigSeq?: number;
};

function tables() {
  if (!g.__jiyRouletteTables) g.__jiyRouletteTables = new Map();
  return g.__jiyRouletteTables;
}
function signals() {
  if (!g.__jiyRouletteSignals) g.__jiyRouletteSignals = [];
  return g.__jiyRouletteSignals;
}
function now() {
  return new Date().toISOString();
}
function norm(w: string) {
  return w.trim().toLowerCase();
}
function emptySeats(): (RouletteSeat | null)[] {
  return Array.from({ length: SEAT_COUNT }, () => null);
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const dig = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(dig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function numberFromSeed(seed: string): number {
  const data = new TextEncoder().encode(seed);
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 37;
}

export function toPublic(t: RouletteTable): RoulettePublic {
  const { _seed: _s, _commit: _c, ...rest } = t;
  return {
    ...rest,
    history: t.history || [],
    bets: t.bets || [],
    lastRoundNets: t.lastRoundNets || [],
    autoStart: Boolean(t.autoStart),
    commitHash:
      t.phase === "betting" || t.phase === "spinning" || t.phase === "result"
        ? t._commit || t.lastSpin?.commitHash || null
        : t.lastSpin?.commitHash || null,
  };
}

export async function setAutoStart(
  tableId: string,
  wallet: string,
  autoStart: boolean
): Promise<RoulettePublic> {
  const t = tables().get(tableId);
  if (!t) throw new Error("Masa bulunamadı");
  if (norm(wallet) !== t.hostWallet) throw new Error("Sadece host");
  t.autoStart = autoStart;
  t.updatedAt = now();
  return toPublic(t);
}

function dozenNumbers(d: number): number[] {
  if (d === 1) return range(1, 12);
  if (d === 2) return range(13, 24);
  return range(25, 36);
}

function columnNumbers(c: number): number[] {
  if (c === 3) return range(1, 36).filter((n) => n % 3 === 0);
  return range(1, 36).filter((n) => n % 3 === c);
}

function range(a: number, b: number) {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

export function resolveBetNumbers(bet: Pick<RouletteBet, "kind" | "numbers" | "meta">): number[] {
  switch (bet.kind) {
    case "straight":
    case "split":
    case "street":
    case "corner":
    case "line":
      return bet.numbers;
    case "dozen":
      return dozenNumbers(bet.meta || 1);
    case "column":
      return columnNumbers(bet.meta || 1);
    case "red":
      return [...ROULETTE_REDS];
    case "black":
      return range(1, 36).filter((n) => !ROULETTE_REDS.has(n));
    case "even":
      return range(1, 36).filter((n) => n % 2 === 0);
    case "odd":
      return range(1, 36).filter((n) => n % 2 === 1);
    case "low":
      return range(1, 18);
    case "high":
      return range(19, 36);
    default:
      return [];
  }
}

export function betWins(bet: RouletteBet, n: number): boolean {
  if (n === 0) {
    // European: 0 loses outside even-money & dozens/columns; straight 0 wins
    if (bet.kind === "straight") return bet.numbers.includes(0);
    if (
      bet.kind === "split" ||
      bet.kind === "street" ||
      bet.kind === "corner" ||
      bet.kind === "line"
    ) {
      return bet.numbers.includes(0);
    }
    return false;
  }
  return resolveBetNumbers(bet).includes(n);
}

function validateInside(kind: RouletteBetKind, numbers: number[]): boolean {
  const uniq = [...new Set(numbers)].filter((n) => n >= 0 && n <= 36);
  if (kind === "straight") return uniq.length === 1;
  if (kind === "split") return uniq.length === 2;
  if (kind === "street") return uniq.length === 3;
  if (kind === "corner") return uniq.length === 4;
  if (kind === "line") return uniq.length === 6;
  return true;
}

function labelFor(
  kind: RouletteBetKind,
  numbers: number[],
  meta?: number
): string {
  switch (kind) {
    case "straight":
      return `Düz ${numbers[0]}`;
    case "split":
      return `Split ${numbers.join("-")}`;
    case "street":
      return `Street ${numbers[0]}-${numbers[2]}`;
    case "corner":
      return `Corner ${numbers[0]}`;
    case "line":
      return `Line ${numbers[0]}-${numbers[5]}`;
    case "dozen":
      return meta === 1 ? "1st 12" : meta === 2 ? "2nd 12" : "3rd 12";
    case "column":
      return meta === 1 ? "2:1 Col1" : meta === 2 ? "2:1 Col2" : "2:1 Col3";
    case "red":
      return "Kırmızı";
    case "black":
      return "Siyah";
    case "even":
      return "Çift";
    case "odd":
      return "Tek";
    case "low":
      return "1–18";
    case "high":
      return "19–36";
    default:
      return kind;
  }
}

export async function createTable(input: {
  hostWallet: string;
  displayName: string;
  avatarEmoji: string;
  label?: string;
}): Promise<RoulettePublic> {
  const host = norm(input.hostWallet);
  const id = nanoid(10);
  const t: RouletteTable = {
    id,
    hostWallet: host,
    label: (input.label || "European Roulette").slice(0, 40),
    phase: "lobby",
    phaseEndsAt: null,
    seats: emptySeats(),
    bets: [],
    balances: { [host]: START_CHIPS },
    lastSpin: null,
    history: [],
    lastRoundNets: [],
    autoStart: true,
    round: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  t.seats[0] = {
    index: 0,
    wallet: host,
    displayName: input.displayName.slice(0, 40) || host.slice(0, 8),
    avatarEmoji: input.avatarEmoji || "🎰",
    seatedAt: now(),
    camOn: false,
  };
  tables().set(id, t);
  return toPublic(t);
}

export function getTable(id: string): RouletteTable | null {
  return tables().get(id) || null;
}

export function listOpenTables(limit = 24): RoulettePublic[] {
  return [...tables().values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map(toPublic);
}

export async function joinTable(input: {
  tableId: string;
  wallet: string;
  displayName: string;
  avatarEmoji: string;
  seatIndex?: number;
}): Promise<RoulettePublic> {
  const t = tables().get(input.tableId);
  if (!t) throw new Error("Masa bulunamadı");
  await advancePhase(t);
  const w = norm(input.wallet);

  const existing = t.seats.findIndex((s) => s?.wallet === w);
  if (existing >= 0) {
    if (t.balances[w] == null) t.balances[w] = START_CHIPS;
    t.updatedAt = now();
    return toPublic(t);
  }

  let idx =
    typeof input.seatIndex === "number" &&
    input.seatIndex >= 0 &&
    input.seatIndex < SEAT_COUNT &&
    !t.seats[input.seatIndex]
      ? input.seatIndex
      : t.seats.findIndex((s) => s == null);

  if (idx < 0) throw new Error("Masa dolu (8 koltuk)");

  t.seats[idx] = {
    index: idx,
    wallet: w,
    displayName: input.displayName.slice(0, 40) || w.slice(0, 8),
    avatarEmoji: input.avatarEmoji || "🎰",
    seatedAt: now(),
    camOn: false,
  };
  if (t.balances[w] == null) t.balances[w] = START_CHIPS;
  t.updatedAt = now();
  return toPublic(t);
}

export async function leaveTable(
  tableId: string,
  wallet: string
): Promise<RoulettePublic | null> {
  const t = tables().get(tableId);
  if (!t) return null;
  const w = norm(wallet);
  // Refund open bets if leaving mid-betting
  if (t.phase === "betting") {
    for (const b of t.bets.filter((x) => x.wallet === w)) {
      t.balances[w] = (t.balances[w] ?? 0) + b.amount;
    }
    t.bets = t.bets.filter((b) => b.wallet !== w);
  }
  t.seats = t.seats.map((s) => (s?.wallet === w ? null : s));
  t.updatedAt = now();
  if (!t.seats.some(Boolean)) {
    tables().delete(tableId);
    return null;
  }
  if (t.hostWallet === w) {
    const next = t.seats.find((s) => s);
    if (next) t.hostWallet = next.wallet;
  }
  return toPublic(t);
}

export async function setCam(
  tableId: string,
  wallet: string,
  camOn: boolean
): Promise<RoulettePublic> {
  const t = tables().get(tableId);
  if (!t) throw new Error("Masa bulunamadı");
  const w = norm(wallet);
  t.seats = t.seats.map((s) => (s?.wallet === w ? { ...s, camOn } : s));
  t.updatedAt = now();
  return toPublic(t);
}

export async function startBetting(
  tableId: string,
  wallet: string
): Promise<RoulettePublic> {
  const t = tables().get(tableId);
  if (!t) throw new Error("Masa bulunamadı");
  if (norm(wallet) !== t.hostWallet) throw new Error("Sadece host başlatır");
  await advancePhase(t);
  if (t.phase === "betting") return toPublic(t);
  if (t.phase !== "lobby" && t.phase !== "result") {
    throw new Error("Şu an bahis açılamaz");
  }
  if (!t.seats.some(Boolean)) throw new Error("Koltuk boş");
  await beginBettingRound(t);
  return toPublic(t);
}

export async function placeBet(input: {
  tableId: string;
  wallet: string;
  kind: RouletteBetKind;
  amount: number;
  numbers?: number[];
  meta?: number;
}): Promise<RoulettePublic> {
  const t = tables().get(input.tableId);
  if (!t) throw new Error("Masa bulunamadı");
  await advancePhase(t);
  if (t.phase !== "betting") throw new Error("Bahis kapalı");

  const w = norm(input.wallet);
  if (!t.seats.some((s) => s?.wallet === w)) throw new Error("Önce koltuğa otur");

  const amount = Math.floor(input.amount);
  if (amount < 10 || amount > 1000) throw new Error("Bahis 10–1000 chip");

  const kind = input.kind;
  if (!PAYOUT[kind]) throw new Error("Geçersiz bahis türü");

  const numbers = [...new Set(input.numbers || [])].filter(
    (n) => Number.isInteger(n) && n >= 0 && n <= 36
  );

  if (["straight", "split", "street", "corner", "line"].includes(kind)) {
    if (!validateInside(kind, numbers)) throw new Error("Geçersiz sayı kombinasyonu");
  }
  if (kind === "dozen" || kind === "column") {
    const m = input.meta;
    if (m !== 1 && m !== 2 && m !== 3) throw new Error("dozen/column 1–3");
  }

  const mine = t.bets.filter((b) => b.wallet === w);
  if (mine.length >= MAX_BETS_PER_PLAYER) throw new Error("Çok fazla bahis");
  const stake = mine.reduce((s, b) => s + b.amount, 0);
  if (stake + amount > MAX_TOTAL_STAKE) throw new Error("Tur limit aşıldı");

  const bal = t.balances[w] ?? 0;
  if (amount > bal) throw new Error("Yetersiz chip");

  t.balances[w] = bal - amount;
  t.bets.push({
    id: nanoid(10),
    wallet: w,
    kind,
    numbers,
    meta: input.meta,
    amount,
    label: labelFor(kind, numbers, input.meta),
    createdAt: now(),
  });
  t.updatedAt = now();
  return toPublic(t);
}

export async function undoBet(
  tableId: string,
  wallet: string
): Promise<RoulettePublic> {
  const t = tables().get(tableId);
  if (!t) throw new Error("Masa bulunamadı");
  await advancePhase(t);
  if (t.phase !== "betting") throw new Error("Bahis kapalı");
  const w = norm(wallet);
  for (let i = t.bets.length - 1; i >= 0; i--) {
    if (t.bets[i]!.wallet === w) {
      const [b] = t.bets.splice(i, 1);
      t.balances[w] = (t.balances[w] ?? 0) + b!.amount;
      t.updatedAt = now();
      return toPublic(t);
    }
  }
  throw new Error("Geri alınacak bahis yok");
}

export async function clearBets(
  tableId: string,
  wallet: string
): Promise<RoulettePublic> {
  const t = tables().get(tableId);
  if (!t) throw new Error("Masa bulunamadı");
  await advancePhase(t);
  if (t.phase !== "betting") throw new Error("Bahis kapalı");
  const w = norm(wallet);
  let refund = 0;
  t.bets = t.bets.filter((b) => {
    if (b.wallet !== w) return true;
    refund += b.amount;
    return false;
  });
  t.balances[w] = (t.balances[w] ?? 0) + refund;
  t.updatedAt = now();
  return toPublic(t);
}

async function settleAndSpin(t: RouletteTable): Promise<void> {
  const seed = t._seed || `${nanoid(24)}:fallback`;
  const commit = t._commit || (await sha256Hex(seed));
  const number = numberFromSeed(seed);
  const color = colorOf(number);

  const byWallet = new Map<string, { staked: number; returned: number }>();
  for (const bet of t.bets) {
    const cur = byWallet.get(bet.wallet) || { staked: 0, returned: 0 };
    cur.staked += bet.amount;
    if (betWins(bet, number)) {
      const mult = PAYOUT[bet.kind];
      const ret = bet.amount * (mult + 1);
      cur.returned += ret;
      t.balances[bet.wallet] = (t.balances[bet.wallet] ?? 0) + ret;
    }
    byWallet.set(bet.wallet, cur);
  }

  t.lastRoundNets = [...byWallet.entries()].map(([wallet, v]) => ({
    wallet,
    staked: v.staked,
    returned: v.returned,
    net: v.returned - v.staked,
  }));

  const spin: RouletteSpin = {
    number,
    color,
    commitHash: commit,
    revealSeed: seed,
    spunAt: now(),
  };
  t.lastSpin = spin;
  t.history = [spin, ...t.history].slice(0, 24);
  t.phase = "spinning";
  t.phaseEndsAt = new Date(Date.now() + SPINNING_MS).toISOString();
  t.updatedAt = now();
}

async function beginBettingRound(t: RouletteTable): Promise<void> {
  const seedBytes = new Uint8Array(32);
  crypto.getRandomValues(seedBytes);
  const seed = [...seedBytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const commit = await sha256Hex(seed);
  t._seed = seed;
  t._commit = commit;
  t.bets = [];
  t.phase = "betting";
  t.phaseEndsAt = new Date(Date.now() + BETTING_MS).toISOString();
  t.round += 1;
  t.updatedAt = now();
}

async function advancePhase(t: RouletteTable): Promise<void> {
  if (!t.phaseEndsAt) return;
  if (new Date(t.phaseEndsAt).getTime() > Date.now()) return;

  if (t.phase === "betting") {
    await settleAndSpin(t);
    return;
  }
  if (t.phase === "spinning") {
    t.phase = "result";
    t.phaseEndsAt = new Date(Date.now() + RESULT_MS).toISOString();
    t.updatedAt = now();
    return;
  }
  if (t.phase === "result") {
    t.phase = "lobby";
    t.phaseEndsAt = null;
    t.bets = [];
    t._seed = undefined;
    t._commit = undefined;
    t.updatedAt = now();
    if (t.autoStart && t.seats.some(Boolean)) {
      await beginBettingRound(t);
    }
  }
}

export async function tickTable(tableId: string): Promise<RoulettePublic> {
  const t = tables().get(tableId);
  if (!t) throw new Error("Masa bulunamadı");
  await advancePhase(t);
  return toPublic(t);
}

export function pushRouletteSignal(input: {
  tableId: string;
  fromWallet: string;
  toWallet: string;
  kind: RouletteSignal["kind"];
  payload: unknown;
}): RouletteSignal {
  if (!g.__jiyRouletteSigSeq) g.__jiyRouletteSigSeq = 1;
  const sig: RouletteSignal = {
    id: g.__jiyRouletteSigSeq++,
    tableId: input.tableId,
    fromWallet: norm(input.fromWallet),
    toWallet: norm(input.toWallet),
    kind: input.kind,
    payload: input.payload,
    createdAt: now(),
  };
  signals().unshift(sig);
  if (signals().length > 2000) g.__jiyRouletteSignals = signals().slice(0, 1500);
  return sig;
}

export function pullRouletteSignals(
  tableId: string,
  wallet: string,
  afterId: number
): RouletteSignal[] {
  const w = norm(wallet);
  return signals()
    .filter((s) => s.tableId === tableId && s.id > afterId && s.toWallet === w)
    .sort((a, b) => a.id - b.id)
    .slice(0, 80);
}

export const ROULETTE_CONST = {
  SEAT_COUNT,
  BETTING_MS,
  SPINNING_MS,
  RESULT_MS,
  START_CHIPS,
  MAX_BETS_PER_PLAYER,
  MAX_TOTAL_STAKE,
  PAYOUT,
  CHIP_DENOMS,
  EUROPEAN_WHEEL_ORDER,
};
