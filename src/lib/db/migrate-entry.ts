/**
 * Thin Cloudflare Worker entry for /api/admin/migrate.
 * Runs BEFORE OpenNext so Free-plan subrequest budget is not exhausted.
 * Never logs connection strings or secret values.
 */

import {
  buildDbUrlCandidates,
  inspectAndMigrate,
  MIGRATION_FILES,
} from "./migrate";
import { MIGRATION_SQL } from "./migration-sql";

type Env = Record<string, unknown>;

function readSecret(env: Env, ...names: string[]): string {
  for (const name of names) {
    const v = env[name];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function authorized(request: Request, env: Env): boolean {
  if (readSecret(env, "SITEFLIP_ALLOW_MIGRATE") !== "1") return false;
  const token = readSecret(env, "MIGRATE_TOKEN");
  if (!token) return false;
  const header = request.headers.get("x-migrate-token")?.trim();
  return Boolean(header && header === token);
}

function safeDbUrlShape(raw: string) {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  const expectedHost = "aws-0-eu-central-1.pooler.supabase.com";
  const expectedPort = "5432";
  const expectedDb = "postgres";
  if (!value) {
    return {
      present: false,
      length: 0,
      parseOk: false,
      scheme: null as string | null,
      host: null as string | null,
      port: null as string | null,
      database: null as string | null,
      hostKind: "none" as const,
      hasUser: false,
      hasPassword: false,
      hasDatabase: false,
      looksLikeJwt: false,
      looksLikeProjectRef: false,
      matchesExpectedHost: false,
      matchesExpectedPort: false,
      matchesExpectedDatabase: false,
      hint: "Set SUPABASE_DB_URL to Session pooler URI",
    };
  }
  const looksLikeJwt = value.startsWith("eyJ");
  const looksLikeProjectRef = /^[a-z0-9]{15,32}$/i.test(value);
  let parseOk = false;
  let scheme: string | null = null;
  let host: string | null = null;
  let port: string | null = null;
  let database: string | null = null;
  let hostKind: "db.supabase" | "pooler.supabase" | "other" | "none" = "none";
  let hasUser = false;
  let hasPassword = false;
  let hasDatabase = false;
  try {
    const u = new URL(value);
    parseOk = true;
    scheme = u.protocol.replace(":", "");
    host = u.hostname || null;
    port = u.port || (scheme?.startsWith("postgres") ? "5432" : null);
    database = (u.pathname || "/").replace(/^\//, "") || null;
    hasUser = Boolean(u.username);
    hasPassword = Boolean(u.password);
    hasDatabase = Boolean(database);
    if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(u.hostname)) hostKind = "db.supabase";
    else if (/pooler\.supabase\.com$/i.test(u.hostname)) hostKind = "pooler.supabase";
    else if (u.hostname) hostKind = "other";
  } catch {
    parseOk = false;
  }
  return {
    present: true,
    length: value.length,
    parseOk,
    scheme,
    host,
    port,
    database,
    hostKind,
    hasUser,
    hasPassword,
    hasDatabase,
    looksLikeJwt,
    looksLikeProjectRef,
    matchesExpectedHost: host === expectedHost,
    matchesExpectedPort: port === expectedPort,
    matchesExpectedDatabase: database === expectedDb,
  };
}

function dbSecretPresence(env: Env) {
  const describe = (v: unknown) => {
    if (typeof v === "string") {
      const t = v.trim();
      return { present: Boolean(t), length: t.length, type: "string" };
    }
    if (v == null) return { present: false, length: 0, type: v === null ? "null" : "undefined" };
    return { present: false, length: 0, type: typeof v };
  };
  const bindingKeys = Object.keys(env)
    .filter((k) => /supabase|migrate|database|mollie|groq|ai_/i.test(k))
    .sort();
  return {
    contextAvailable: true,
    bindingKeys,
    supabaseDb: describe(env.SUPABASE_DB),
    supabaseDbUrl: describe(env.SUPABASE_DB_URL),
    databaseUrl: describe(env.DATABASE_URL),
    rewriteCandidates: (() => {
      const raw = readSecret(env, "SUPABASE_DB_URL", "SUPABASE_DB", "DATABASE_URL");
      if (!raw) return 0;
      try {
        return buildDbUrlCandidates(raw).length;
      } catch {
        return 0;
      }
    })(),
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleAdminMigrate(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const presence = dbSecretPresence(env);
  const raw = readSecret(env, "SUPABASE_DB_URL", "SUPABASE_DB", "DATABASE_URL");
  const shape = safeDbUrlShape(raw);
  const apply = request.method === "POST";
  const action = apply ? "migrate" : "inspect";

  if (!raw) {
    return json(
      {
        ok: false,
        connected: false,
        action,
        error: "SUPABASE_DB_URL binding empty or missing at Worker runtime",
        dbUrlShape: shape,
        dbSecretPresence: presence,
      },
      503
    );
  }

  if (!shape.parseOk || shape.looksLikeJwt || shape.looksLikeProjectRef) {
    return json(
      {
        ok: false,
        connected: false,
        action,
        error: "Invalid URL string.",
        dbUrlShape: shape,
        dbSecretPresence: presence,
      },
      503
    );
  }

  const result = await inspectAndMigrate({
    databaseUrl: raw.replace(/^["']|["']$/g, ""),
    migrations: MIGRATION_SQL,
    apply,
  });

  return json({
    action,
    migrationFiles: MIGRATION_FILES,
    dbUrlShape: shape,
    dbSecretPresence: presence,
    expected: {
      host: "aws-0-eu-central-1.pooler.supabase.com",
      port: "5432",
      database: "postgres",
    },
    entry: "thin-worker",
    ...result,
  });
}
