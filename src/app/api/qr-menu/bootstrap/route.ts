import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import postgres from "postgres";

export const runtime = "nodejs";

/**
 * One-shot schema bootstrap for qr_menus (008 + 009).
 * Auth: Bearer must match Worker CLOUDFLARE_API_TOKEN or MIGRATE_TOKEN.
 */
function authorized(request: Request): boolean {
  const header = request.headers.get("authorization")?.trim() || "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!bearer) return false;
  const candidates = [
    process.env.QR_MENU_BOOTSTRAP_TOKEN?.trim(),
    process.env.MIGRATE_TOKEN?.trim(),
    process.env.CLOUDFLARE_API_TOKEN?.trim(),
  ].filter(Boolean) as string[];
  return candidates.some((t) => t === bearer);
}

const SQL = `
CREATE TABLE IF NOT EXISTS qr_menus (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR'
    CHECK (currency IN ('EUR', 'TRY', 'USD', 'GBP')),
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  edit_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qr_menus_slug ON qr_menus(slug);
CREATE INDEX IF NOT EXISTS idx_qr_menus_updated ON qr_menus(updated_at DESC);
ALTER TABLE qr_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_menus
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#D4FF3A',
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
`;

export async function POST(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) {
    return jsonError("Unauthorized", 401);
  }

  const dbUrl =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.SUPABASE_DB?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    return jsonError("SUPABASE_DB_URL missing on Worker", 503);
  }

  const sql = postgres(dbUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 12,
    prepare: false,
  });

  try {
    await sql.unsafe(SQL);
    // Probe
    const rows = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'qr_menus'
      ORDER BY ordinal_position
    `;
    return jsonOk({
      ok: true,
      table: "qr_menus",
      columns: rows.map((r) => r.column_name),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "bootstrap failed";
    console.error("qr-menu bootstrap failed", message);
    return jsonError("Bootstrap failed", 500, { detail: message.slice(0, 200) });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) return jsonError("Unauthorized", 401);
  return jsonOk({
    endpoint: "POST /api/qr-menu/bootstrap",
    applies: ["008_qr_menus", "009_qr_menus_brand"],
  });
}
