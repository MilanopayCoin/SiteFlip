import { NextResponse } from "next/server";
import {
  ensureCloudflareEnv,
  getSupabasePublicEnv,
  isSupabaseConfigured,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getSchemaStatus,
  invalidateSchemaStatusCache,
} from "@/lib/supabase/schema-ready";

export const runtime = "nodejs";

/**
 * Public health probe — HTTP Supabase only. Never returns secret values.
 * Never opens PostgreSQL TCP from the Worker.
 */
export async function GET() {
  await ensureCloudflareEnv();
  invalidateSchemaStatusCache();
  const status = await getSchemaStatus(true);
  const configured = isSupabaseConfigured();
  const publicEnv = getSupabasePublicEnv();
  const hasService = isSupabaseServiceConfigured();

  if (!configured || !publicEnv) {
    return NextResponse.json({
      ok: false,
      mode: "demo",
      supabaseConfigured: false,
      authReady: false,
      authReachable: false,
      hasServiceRole: false,
      serviceRoleUsable: false,
      schemaReady: false,
      productionPersistence: false,
      marketplaceReady: false,
      factoryPersistence: false,
      workerPostgresTcp: "disabled",
      runtimeDatabaseAccess: "none",
      schema: null,
      message: "Supabase env not available — DEMO fallback active",
    });
  }

  let serviceOk = false;
  if (hasService) {
    try {
      const service = await createServiceClient();
      if (service) {
        const { error: sErr } = await service.from("profiles").select("id").limit(0);
        serviceOk =
          !sErr ||
          !(
            sErr.code === "PGRST205" ||
            sErr.message?.toLowerCase().includes("could not find the table")
          );
      }
    } catch {
      serviceOk = false;
    }
  }

  const authReady = status.authReachable;
  const marketplaceReady =
    status.productionPersistence &&
    Boolean(status.tables.listings) &&
    Boolean(status.tables.offers) &&
    Boolean(status.tables.watchlists);
  const factoryPersistence =
    status.productionPersistence &&
    Boolean(status.tables.factory_projects) &&
    Boolean(status.tables.factory_runs) &&
    Boolean(status.tables.factory_outputs);

  return NextResponse.json({
    ok: configured && authReady,
    mode: status.productionPersistence
      ? "supabase"
      : authReady
        ? "supabase_auth_only"
        : "demo",
    supabaseConfigured: configured,
    authReady,
    authReachable: status.authReachable,
    hasServiceRole: hasService,
    serviceRoleUsable: hasService ? serviceOk : false,
    schemaReady: status.schemaReady,
    productionPersistence: status.productionPersistence,
    marketplaceReady,
    factoryPersistence,
    workerPostgresTcp: "disabled",
    runtimeDatabaseAccess: "supabase_http_postgrest",
    schema: status.tables,
    urlHost: new URL(publicEnv.url).host,
    error: status.reason || null,
    remainingDemoFallback: status.productionPersistence
      ? null
      : "DEMO/LOCAL memory paths remain until migrations 001–004 are applied via npm run db:migrate (external)",
  });
}
