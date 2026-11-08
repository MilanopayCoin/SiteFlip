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
