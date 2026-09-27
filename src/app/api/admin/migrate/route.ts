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
} from "@/lib/supabase/run-migrations";
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
    // Worker TCP to Postgres hangs on this runtime (CF 1101).
    // Apply externally: SUPABASE_DB_URL=… npm run db:migrate
    return NextResponse.json(
      {
        ...(await statusPayload()),
        action: "apply",
        applied: false,
        error:
          "Worker PostgreSQL TCP apply is disabled (runtime hang). Run `npm run db:migrate` externally with Session pooler SUPABASE_DB_URL.",
      },
      { status: 501 }
    );
  }

  return NextResponse.json(
    { error: "Unknown action. Use status or apply." },
    { status: 400 }
  );
}
