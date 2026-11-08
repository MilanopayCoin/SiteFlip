/** Client-only soft safety — hide / report without server PII. */

const BLOCK_KEY = "jiy-near-blocked";
const REPORT_KEY = "jiy-near-reports";

function norm(w: string) {
  return w.trim().toLowerCase();
}

export function loadBlocked(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(BLOCK_KEY) || "[]") as string[];
    return Array.isArray(raw) ? raw.map(norm) : [];
  } catch {
    return [];
  }
}

export function blockWallet(wallet: string): string[] {
  const w = norm(wallet);
  const next = [...new Set([...loadBlocked(), w])];
  localStorage.setItem(BLOCK_KEY, JSON.stringify(next));
  return next;
}

export function unblockWallet(wallet: string): string[] {
  const w = norm(wallet);
  const next = loadBlocked().filter((x) => x !== w);
  localStorage.setItem(BLOCK_KEY, JSON.stringify(next));
  return next;
}

export function recordLocalReport(wallet: string, reason: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = JSON.parse(localStorage.getItem(REPORT_KEY) || "[]") as {
      wallet: string;
      reason: string;
      at: string;
    }[];
    prev.unshift({
      wallet: norm(wallet),
      reason: reason.slice(0, 80),
      at: new Date().toISOString(),
    });
    localStorage.setItem(REPORT_KEY, JSON.stringify(prev.slice(0, 50)));
  } catch {
    // ignore
  }
}

export const MOOD_PRESETS = [
  "Kahve ☕",
  "Sohbet",
  "Gece çıkışı",
  "Müzik",
  "Sadece radar",
] as const;

const STREAK_KEY = "jiy-near-streak";

export type NearStreak = {
  count: number;
  lastDay: string;
  geohash: string;
};

/** Calendar day in Europe/Amsterdam (YYYY-MM-DD). */
export function amsterdamDayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function loadStreak(): NearStreak | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || "null") as NearStreak | null;
    if (!raw || typeof raw.count !== "number") return null;
    return raw;
  } catch {
    return null;
  }
}

/** Call on successful check-in — consecutive Amsterdam midnights. */
export function recordCheckInStreak(geohash: string): NearStreak {
  const today = amsterdamDayKey();
  const prev = loadStreak();
  let count = 1;
  if (prev?.lastDay === today) {
    count = prev.count;
  } else if (prev) {
    const y = new Date(`${prev.lastDay}T12:00:00+01:00`);
    y.setDate(y.getDate() + 1);
    const expected = amsterdamDayKey(y);
    count = expected === today ? prev.count + 1 : 1;
  }
  const next: NearStreak = {
    count,
    lastDay: today,
    geohash: geohash.slice(0, 5),
  };
  localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  return next;
}

/** Blind radar label until mutual Selam unlock. */
export function blindLabel(wallet: string): string {
  const w = norm(wallet);
  const n = parseInt(w.slice(2, 6), 16) % 90;
  return `Sinyal · ${n}`;
}
