const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("INVALID_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("INVALID_PROTOCOL");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) {
    throw new Error("BLOCKED_HOST");
  }
  if (isPrivateIpv4(host)) throw new Error("BLOCKED_HOST");
  return url;
}

export async function safeFetchText(
  rawUrl: string,
  opts?: { maxBytes?: number; timeoutMs?: number }
): Promise<{ url: string; text: string; contentType: string | null }> {
  const maxBytes = opts?.maxBytes ?? 512_000;
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const url = assertPublicHttpUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "JIY-Menu-Importer/1.0 (+https://jiy.app/qr-menu)",
      },
    });
    if (!res.ok) throw new Error(`FETCH_HTTP_${res.status}`);
    const contentType = res.headers.get("content-type");
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) throw new Error("RESPONSE_TOO_LARGE");
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { url: res.url || url.toString(), text, contentType };
  } finally {
    clearTimeout(timer);
  }
}
