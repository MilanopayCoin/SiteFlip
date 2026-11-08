import { nanoid } from "nanoid";

/** European roulette reds. */
export const ROULETTE_REDS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteColor = "red" | "black" | "green";

export function colorOf(n: number): RouletteColor {
  if (n === 0) return "green";
  return ROULETTE_REDS.has(n) ? "red" : "black";
}

export type RoulettePhase = "lobby" | "betting" | "spinning" | "result";

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
  color: "red" | "black";
  amount: number;
  createdAt: string;
};

export type RouletteSpin = {
  number: number;
  color: RouletteColor;
  commitHash: string;
  revealSeed: string;
  spunAt: string;
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
  round: number;
  createdAt: string;
  updatedAt: string;
  /** Hidden until reveal — never send raw seed while betting. */
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

const SEAT_COUNT = 6;
const BETTING_MS = 25_000;
const SPINNING_MS = 8_000;
const RESULT_MS = 6_000;
const START_CHIPS = 1000;

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
  // Deterministic 0–36 from seed bytes
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 37;
}

export function toPublic(t: RouletteTable): RoulettePublic {
  const { _seed: _s, _commit: _c, ...rest } = t;
  return {
    ...rest,
    commitHash:
      t.phase === "betting" || t.phase === "spinning" || t.phase === "result"
        ? t._commit || t.lastSpin?.commitHash || null
        : t.lastSpin?.commitHash || null,
  };
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
    label: (input.label || "Near Rulet").slice(0, 40),
    phase: "lobby",
    phaseEndsAt: null,
    seats: emptySeats(),
    bets: [],
    balances: { [host]: START_CHIPS },
    lastSpin: null,
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

export function listOpenTables(limit = 20): RoulettePublic[] {
  return [...tables().values()]
    .filter((t) => t.phase !== "result" || true)
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

  // Already seated?
  const existing = t.seats.findIndex((s) => s?.wallet === w);
  if (existing >= 0) {
    if (!t.balances[w]) t.balances[w] = START_CHIPS;
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

  if (idx < 0) throw new Error("Masa dolu");

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
  t.seats = t.seats.map((s) => (s?.wallet === w ? null : s));
  t.bets = t.bets.filter((b) => b.wallet !== w);
  t.updatedAt = now();
  const occupied = t.seats.some((s) => s);
  if (!occupied) {
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
  t.seats = t.seats.map((s) =>
    s?.wallet === w ? { ...s, camOn } : s
  );
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
  if (t.phase !== "lobby" && t.phase !== "result") {
    throw new Error("Şu an bahis açılamaz");
  }
  const seated = t.seats.filter(Boolean).length;
  if (seated < 1) throw new Error("En az bir koltuk dolu olmalı");

  const seed = `${nanoid(24)}:${Date.now()}`;
  const commit = await sha256Hex(seed);
  t._seed = seed;
  t._commit = commit;
  t.bets = [];
  t.phase = "betting";
  t.phaseEndsAt = new Date(Date.now() + BETTING_MS).toISOString();
  t.round += 1;
  t.updatedAt = now();
  return toPublic(t);
}

export async function placeBet(input: {
  tableId: string;
  wallet: string;
  color: "red" | "black";
  amount: number;
}): Promise<RoulettePublic> {
  const t = tables().get(input.tableId);
  if (!t) throw new Error("Masa bulunamadı");
  await advancePhase(t);
  if (t.phase !== "betting") throw new Error("Bahis kapalı");
  const w = norm(input.wallet);
  if (!t.seats.some((s) => s?.wallet === w)) {
    throw new Error("Önce koltuğa otur");
  }
  const amount = Math.floor(input.amount);
  if (!Number.isFinite(amount) || amount < 10 || amount > 500) {
    throw new Error("Bahis 10–500 chip");
  }
  const bal = t.balances[w] ?? 0;
  // Replace previous bet this round — refund old
  const prev = t.bets.find((b) => b.wallet === w);
  let available = bal;
  if (prev) {
    available += prev.amount;
    t.bets = t.bets.filter((b) => b.wallet !== w);
  }
  if (amount > available) throw new Error("Yetersiz chip");
  t.balances[w] = available - amount;
  t.bets.push({
    id: nanoid(10),
    wallet: w,
    color: input.color,
    amount,
    createdAt: now(),
  });
  t.updatedAt = now();
  return toPublic(t);
}

async function settleAndSpin(t: RouletteTable): Promise<void> {
  const seed = t._seed || `${nanoid(24)}:fallback`;
  const commit = t._commit || (await sha256Hex(seed));
  const number = numberFromSeed(seed);
  const color = colorOf(number);

  // Payout: red/black even money (2x stake returned = +stake profit)
  for (const bet of t.bets) {
    const win = bet.color === color;
    if (win) {
      t.balances[bet.wallet] = (t.balances[bet.wallet] ?? 0) + bet.amount * 2;
    }
    // losses already deducted at placeBet
  }

  t.lastSpin = {
    number,
    color,
    commitHash: commit,
    revealSeed: seed,
    spunAt: now(),
  };
  t.phase = "spinning";
  t.phaseEndsAt = new Date(Date.now() + SPINNING_MS).toISOString();
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
  // cap
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
    .filter(
      (s) =>
        s.tableId === tableId &&
        s.id > afterId &&
        s.toWallet === w
    )
    .sort((a, b) => a.id - b.id)
    .slice(0, 80);
}

export const ROULETTE_CONST = {
  SEAT_COUNT,
  BETTING_MS,
  SPINNING_MS,
  RESULT_MS,
  START_CHIPS,
};
