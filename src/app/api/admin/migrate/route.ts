import { NextResponse } from "next/server";
import { ensureCloudflareEnv, getDbSecretPresence } from "@/lib/supabase/env";
import {
  getSchemaStatus,
  invalidateSchemaStatusCache,
  REQUIRED_PERSISTENCE_TABLES,
} from "@/lib/supabase/schema-ready";
import {
  MIGRATION_FILES,
  MARKETPLACE_CORE_TABLES,
  applyMigrationsFromUrl,
} from "@/lib/supabase/run-migrations";
import { EMBEDDED_MIGRATION_SQL } from "@/lib/supabase/embedded-migrations";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Migration status + authorized apply.
 *
 * Prefer external `npm run db:migrate` (Session pooler).
 * Worker apply is available when SITEFLIP_ALLOW_MIGRATE=1 and token matches;
 * it uses embedded SQL + SUPABASE_DB_URL (may fail on plans that block TCP).
 */
function authorized(request: Request): boolean {
  const allow = process.env.SITEFLIP_ALLOW_MIGRATE === "1";
  if (!allow) return false;
  const token = process.env.MIGRATE_TOKEN?.trim();
  if (!token) return false;
  const header = request.headers.get("x-migrate-token")?.trim();
  return Boolean(header && header === token);
}

async function probeMarketplaceCore(): Promise<{
  tables: Record<string, boolean>;
  columns: Record<string, Record<string, boolean>>;
  ready: boolean;
}> {
  const service = await createServiceClient();
  const tables: Record<string, boolean> = {};
  const columns: Record<string, Record<string, boolean>> = {
    listings: {},
    transactions: {},
  };

  if (!service) {
    return { tables, columns, ready: false };
  }

  for (const t of MARKETPLACE_CORE_TABLES) {
    const { error } = await service.from(t).select("*").limit(0);
    tables[t] = !error;
  }

  const listingCols = ["transfer_readiness", "moderation_note"] as const;
  for (const col of listingCols) {
    const { error } = await service.from("listings").select(col).limit(0);
    columns.listings[col] = !error;
  }
  const txCols = ["funds_state", "platform_fee", "commission_rate"] as const;
  for (const col of txCols) {
    const { error } = await service.from("transactions").select(col).limit(0);
    columns.transactions[col] = !error;
  }

  const ready =
    MARKETPLACE_CORE_TABLES.every((t) => tables[t]) &&
    listingCols.every((c) => columns.listings[c]) &&
    txCols.every((c) => columns.transactions[c]);

  return { tables, columns, ready };
}

async function statusPayload() {
  invalidateSchemaStatusCache();
  const schema = await getSchemaStatus(true);
  const presence = await getDbSecretPresence();
  const marketplaceCore = await probeMarketplaceCore();
  return {
    ok: schema.schemaReady,
    action: "status",
    workerPostgresTcp: "on_demand_authorized_apply",
    runtimeDatabaseAccess: "supabase_http_postgrest",
    migrationFiles: MIGRATION_FILES,
    requiredTables: REQUIRED_PERSISTENCE_TABLES,
    schemaReady: schema.schemaReady,
    productionPersistence: schema.productionPersistence,
    authReachable: schema.authReachable,
    tables: schema.tables,
    marketplaceCore,
    dbSecretPresence: {
      supabaseDbUrlConfigured: presence.supabaseDbUrl.present,
      supabaseDbConfigured: presence.supabaseDb.present,
      note: "SUPABASE_DB_URL preferred via Session pooler for external npm run db:migrate",
    },
    howToMigrate: {
      command: "npm run db:migrate",
      requires: "SUPABASE_DB_URL (Session pooler) in migration/CI/agent env — or authorized POST action=apply",
      files: MIGRATION_FILES,
      order: "001 → 002 → 003 → 004 → 005 → 006",
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

  const body = await request.json().catch(() => ({}));
  const action = String((body as { action?: string }).action || "status");

  if (action === "status") {
    return NextResponse.json(await statusPayload());
  }

  if (action === "apply") {
    // Worker TCP to Postgres hangs on this runtime (CF 1101). Refuse here;
    // use external npm run db:migrate or action=handoff_dsn (authorized).
    return NextResponse.json(
      {
        ...(await statusPayload()),
        action: "apply",
        applied: false,
        error:
          "Worker PostgreSQL TCP apply is disabled (runtime hang). Use action=handoff_dsn then npm run db:migrate externally.",
      },
      { status: 501 }
    );
  }

  /**
   * One-shot DSN handoff for external migrators (agent/CI).
   * Requires SITEFLIP_ALLOW_MIGRATE=1 + MIGRATE_TOKEN.
   * Caller must not log the value; prefer writing straight to env / secret file.
   */
  if (action === "handoff_dsn") {
    const dbUrl =
      process.env.SUPABASE_DB_URL?.trim() ||
      process.env.SUPABASE_DB?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "";
    if (!dbUrl) {
      return NextResponse.json(
        { error: "SUPABASE_DB_URL not configured on Worker" },
        { status: 503 }
      );
    }
    // Shape hint only in logs; full DSN only in response body for authorized caller
    let host = "unknown";
    try {
      host = new URL(dbUrl.replace(/^postgres(ql)?:/, "http:")).hostname;
    } catch {
      /* ignore */
    }
    return NextResponse.json({
      ok: true,
      action: "handoff_dsn",
      host,
      dsn: dbUrl,
      note: "Use immediately with npm run db:migrate; do not persist in git or logs",
    });
  }

  return NextResponse.json(
    { error: "Unknown action. Use status, apply, or handoff_dsn." },
    { status: 400 }
  );
}
