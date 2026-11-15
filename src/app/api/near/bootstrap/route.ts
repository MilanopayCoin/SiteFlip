import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DDL = `
CREATE TABLE IF NOT EXISTS near_profiles (
  wallet TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_emoji TEXT NOT NULL DEFAULT '✨',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS near_presence (
  wallet TEXT PRIMARY KEY REFERENCES near_profiles(wallet) ON DELETE CASCADE,
  geohash TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_near_presence_geohash ON near_presence(geohash);
CREATE TABLE IF NOT EXISTS near_threads (
  id TEXT PRIMARY KEY,
  a_wallet TEXT NOT NULL,
  b_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (a_wallet, b_wallet)
);
CREATE TABLE IF NOT EXISTS near_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES near_threads(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS near_gifts (
  id TEXT PRIMARY KEY,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS near_sessions (
  token TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Best-effort schema bootstrap via PostgREST is not possible for DDL.
 * This endpoint documents readiness: if tables missing, returns 503 with SQL hint.
 * Prefer: npm run db:migrate (010_near.sql) with SUPABASE_DB_URL.
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();
  const token = request.headers.get("x-near-bootstrap-token");
  const expected = process.env.QR_MENU_BOOTSTRAP_TOKEN || process.env.NEAR_BOOTSTRAP_TOKEN;
  if (!expected || token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await createServiceClient();
  if (!client) {
    return Response.json({ ok: false, ready: false, error: "Supabase not configured" }, { status: 503 });
  }
  const { error } = await client.from("near_profiles").select("wallet").limit(1);
  if (!error) {
    return Response.json({ ok: true, ready: true });
  }

  return Response.json(
    {
      ok: false,
      ready: false,
      error: error.message,
      hint: "Apply supabase/migrations/010_near.sql via npm run db:migrate",
      ddlPreview: DDL.slice(0, 200) + "…",
    },
    { status: 503 }
  );
}
