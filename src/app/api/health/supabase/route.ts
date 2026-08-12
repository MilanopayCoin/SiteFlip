import { NextResponse } from "next/server";
import {
  ensureCloudflareEnv,
  getSupabasePublicEnv,
  isSupabaseConfigured,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/env";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Public health probe — never returns secret values.
 */
export async function GET() {
  await ensureCloudflareEnv();

  const configured = isSupabaseConfigured();
  const publicEnv = getSupabasePublicEnv();
  const hasService = isSupabaseServiceConfigured();

  if (!configured || !publicEnv) {
    return NextResponse.json({
      ok: false,
      mode: "demo",
      supabaseConfigured: false,
      hasServiceRole: false,
      schema: null,
      message: "Supabase env not available — DEMO fallback active",
    });
  }

  let authReachable = false;
  let schema: Record<string, boolean> = {};
  let schemaReady = false;
  let serviceOk = false;
  let error: string | null = null;

  try {
    const health = await fetch(`${publicEnv.url}/auth/v1/health`, {
      headers: { apikey: publicEnv.anonKey },
    });
    authReachable = health.ok;
  } catch {
    authReachable = false;
    error = "auth_unreachable";
  }

  const tables = [
    "profiles",
    "businesses",
    "listings",
    "offers",
    "messages",
    "conversations",
    "watchlists",
    "rental_requests",
    "transactions",
  ];

  try {
    const supabase = await createClient();
    if (supabase) {
      for (const table of tables) {
        const { error: qErr } = await supabase.from(table).select("*").limit(0);
        // Empty select: missing table => error; existing => ok (even if RLS blocks rows)
        const missing =
          qErr?.code === "PGRST205" ||
          qErr?.message?.toLowerCase().includes("could not find the table");
        schema[table] = !missing;
      }
      schemaReady = tables.every((t) => schema[t]);
    }
  } catch {
    error = error ?? "schema_check_failed";
  }

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

  const mode = configured && authReachable ? "supabase" : "demo";

  return NextResponse.json({
    ok: configured && authReachable,
    mode,
    supabaseConfigured: configured,
    authReachable,
    hasServiceRole: hasService,
    serviceRoleUsable: hasService ? serviceOk : false,
    schemaReady,
    schema,
    urlHost: new URL(publicEnv.url).host,
    error,
  });
}
