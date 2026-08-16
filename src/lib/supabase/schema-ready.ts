/**
 * Schema readiness probe for production persistence.
 * Never logs secrets. Cached briefly to avoid hammering PostgREST.
 */

import { createServiceClient, createClient } from "./server";
import {
  ensureCloudflareEnv,
  isSupabaseConfigured,
  isSupabaseServiceConfigured,
} from "./env";

export const REQUIRED_PERSISTENCE_TABLES = [
  "profiles",
  "businesses",
  "listings",
  "offers",
  "offer_events",
  "messages",
  "conversations",
  "watchlists",
  "rental_requests",
  "transactions",
  "payments",
  "factory_projects",
  "factory_runs",
  "factory_outputs",
] as const;

export type SchemaStatus = {
  configured: boolean;
  authReachable: boolean;
  hasServiceRole: boolean;
  schemaReady: boolean;
  tables: Record<string, boolean>;
  mode: "supabase" | "demo";
  /** True when DEMO fallback must not be used */
  productionPersistence: boolean;
  reason?: string;
};

let cached: { at: number; value: SchemaStatus } | null = null;
const TTL_MS = 60_000;

async function tableExists(
  client: Awaited<ReturnType<typeof createClient>>,
  table: string
): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.from(table).select("*").limit(0);
  if (!error) return true;
  const missing =
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("could not find the table") ||
    error.message?.toLowerCase().includes("does not exist");
  return !missing;
}

export async function getSchemaStatus(force = false): Promise<SchemaStatus> {
  await ensureCloudflareEnv();
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.value;
  }

  const configured = isSupabaseConfigured();
  if (!configured) {
    const value: SchemaStatus = {
      configured: false,
      authReachable: false,
      hasServiceRole: false,
      schemaReady: false,
      tables: {},
      mode: "demo",
      productionPersistence: false,
      reason: "Supabase env not configured",
    };
    cached = { at: Date.now(), value };
    return value;
  }

  const { getSupabasePublicEnv } = await import("./env");
  const pub = getSupabasePublicEnv()!;
  let authReachable = false;
  try {
    const health = await fetch(`${pub.url}/auth/v1/health`, {
      headers: { apikey: pub.anonKey },
    });
    authReachable = health.ok;
  } catch {
    authReachable = false;
  }

  const hasServiceRole = isSupabaseServiceConfigured();
  const tables: Record<string, boolean> = {};
  // Prefer service role for existence checks (bypasses RLS, still no secrets leaked)
  const service = hasServiceRole ? await createServiceClient() : null;
  const anon = service ? null : await createClient();
  const client = service ?? anon;

  const checks = await Promise.all(
    REQUIRED_PERSISTENCE_TABLES.map(async (t) => [t, await tableExists(client, t)] as const)
  );
  for (const [t, ok] of checks) tables[t] = ok;
  const schemaReady = REQUIRED_PERSISTENCE_TABLES.every((t) => tables[t]);
  const productionPersistence = configured && authReachable && schemaReady;

  const value: SchemaStatus = {
    configured,
    authReachable,
    hasServiceRole,
    schemaReady,
    tables,
    mode: productionPersistence ? "supabase" : "demo",
    productionPersistence,
    reason: productionPersistence
      ? undefined
      : !authReachable
        ? "Auth unreachable"
        : !schemaReady
          ? "Schema not applied — run migrations 001–004"
          : "Not ready",
  };
  cached = { at: Date.now(), value };
  return value;
}

export function invalidateSchemaStatusCache() {
  cached = null;
}
