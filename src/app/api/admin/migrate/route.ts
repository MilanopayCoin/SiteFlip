import { NextResponse } from "next/server";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import {
  inspectAndMigrate,
  MIGRATION_FILES,
} from "@/lib/db/migrate";
import { MIGRATION_SQL } from "@/lib/db/migration-sql";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const allow = process.env.SITEFLIP_ALLOW_MIGRATE === "1";
  if (!allow) return false;
  const token = process.env.MIGRATE_TOKEN?.trim();
  if (!token) return false;
  const header = request.headers.get("x-migrate-token")?.trim();
  return Boolean(header && header === token);
}

/**
 * Server-only DB inspect / migrate.
 * Requires SITEFLIP_ALLOW_MIGRATE=1 and x-migrate-token.
 * Uses SUPABASE_DB_URL from Worker secrets only.
 */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUrl =
    process.env.SUPABASE_DB_URL?.trim() || process.env.SUPABASE_DB?.trim();
  if (!dbUrl) {
    return NextResponse.json(
      {
        error: "SUPABASE_DB_URL not configured on Worker",
        hint: "Set SUPABASE_DB_URL (or SUPABASE_DB) as an encrypted Worker secret",
      },
      { status: 503 }
    );
  }
  const result = await inspectAndMigrate({
    databaseUrl: dbUrl,
    migrations: MIGRATION_SQL,
    apply: false,
  });
  return NextResponse.json({
    action: "inspect",
    migrationFiles: MIGRATION_FILES,
    ...result,
  });
}

export async function POST(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUrl =
    process.env.SUPABASE_DB_URL?.trim() || process.env.SUPABASE_DB?.trim();
  if (!dbUrl) {
    return NextResponse.json(
      {
        error: "SUPABASE_DB_URL not configured on Worker",
        hint: "Set SUPABASE_DB_URL (or SUPABASE_DB) as an encrypted Worker secret",
      },
      { status: 503 }
    );
  }
  const result = await inspectAndMigrate({
    databaseUrl: dbUrl,
    migrations: MIGRATION_SQL,
    apply: true,
  });
  return NextResponse.json({
    action: "migrate",
    migrationFiles: MIGRATION_FILES,
    ...result,
  });
}
