import { NextResponse } from "next/server";
import {
  ensureCloudflareEnv,
  getSupabasePublicEnv,
  isSupabaseConfigured,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/server";
import { getSchemaStatus, invalidateSchemaStatusCache } from "@/lib/supabase/schema-ready";

export const runtime = "nodejs";

/**
 * Public health probe — never returns secret values.
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
      hasServiceRole: false,
      schemaReady: false,
      productionPersistence: false,
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

  return NextResponse.json({
    ok: configured && status.authReachable,
    mode: status.productionPersistence ? "supabase" : status.authReachable ? "supabase_auth_only" : "demo",
    supabaseConfigured: configured,
    authReachable: status.authReachable,
    hasServiceRole: hasService,
    serviceRoleUsable: hasService ? serviceOk : false,
    schemaReady: status.schemaReady,
    productionPersistence: status.productionPersistence,
    schema: status.tables,
    urlHost: new URL(publicEnv.url).host,
    error: status.reason || null,
    remainingDemoFallback: status.productionPersistence
      ? null
      : "DEMO/LOCAL memory paths remain until migrations 001–004 are applied",
  });
}
