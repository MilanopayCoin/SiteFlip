import { NextResponse } from "next/server";
import { ensureCloudflareEnv, getDbSecretPresence } from "@/lib/supabase/env";
import {
  getSchemaStatus,
  invalidateSchemaStatusCache,
  REQUIRED_PERSISTENCE_TABLES,
} from "@/lib/supabase/schema-ready";

export const runtime = "nodejs";

/**
 * Migration status / guidance only.
 *
 * IMPORTANT (Cloudflare Free):
 * Do NOT open PostgreSQL TCP/TLS from the Worker.
 * Apply SQL with `npm run db:migrate` (or Supabase CLI) outside the Worker,
 * using Session pooler SUPABASE_DB_URL in the migration environment.
 */
function authorized(request: Request): boolean {
  const allow = process.env.SITEFLIP_ALLOW_MIGRATE === "1";
  if (!allow) return false;
  const token = process.env.MIGRATE_TOKEN?.trim();
  if (!token) return false;
  const header = request.headers.get("x-migrate-token")?.trim();
  return Boolean(header && header === token);
}

const MIGRATION_FILES = [
  "001_initial_schema.sql",
  "002_business_factory.sql",
  "003_mvp_production.sql",
  "004_mollie_payments.sql",
] as const;

async function statusPayload() {
  invalidateSchemaStatusCache();
  const schema = await getSchemaStatus(true);
  const presence = await getDbSecretPresence();
  return {
    ok: schema.schemaReady,
    action: "status",
    workerPostgresTcp: "disabled",
    runtimeDatabaseAccess: "supabase_http_postgrest",
    migrationFiles: MIGRATION_FILES,
    requiredTables: REQUIRED_PERSISTENCE_TABLES,
    schemaReady: schema.schemaReady,
    productionPersistence: schema.productionPersistence,
    authReachable: schema.authReachable,
    tables: schema.tables,
    dbSecretPresence: {
      // Never include values — presence only (for ops debugging)
      supabaseDbUrlConfigured: presence.supabaseDbUrl.present,
      supabaseDbConfigured: presence.supabaseDb.present,
      note: "SUPABASE_DB_URL is for external migration tooling only — Worker runtime must not open Postgres TCP",
    },
    howToMigrate: {
      command: "npm run db:migrate",
      requires: "SUPABASE_DB_URL (Session pooler) in migration/CI/agent env — not Worker runtime",
      files: MIGRATION_FILES,
      order: "001 → 002 → 003 → 004",
    },
    reason: schema.reason || null,
  };
}

export async function GET(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await statusPayload());
}

export async function POST(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Explicitly refuse Worker-side SQL apply (Free plan TLS/subrequest limits).
  const status = await statusPayload();
  return NextResponse.json(
    {
      ...status,
      action: "migrate",
      applied: false,
      error:
        "Worker PostgreSQL TCP migrations are disabled. Run `npm run db:migrate` outside the Worker with Session pooler SUPABASE_DB_URL.",
    },
    { status: 501 }
  );
}
