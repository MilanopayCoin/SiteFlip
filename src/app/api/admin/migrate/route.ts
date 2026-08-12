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

function safeDbUrlShape(raw: string | undefined | null): {
  present: boolean;
  length: number;
  parseOk: boolean;
  scheme: string | null;
  hostKind: "db.supabase" | "pooler.supabase" | "other" | "none";
  hasUser: boolean;
  hasPassword: boolean;
  hasDatabase: boolean;
  looksLikeJwt: boolean;
  looksLikeProjectRef: boolean;
  hint?: string;
} {
  const value = (raw || "").trim().replace(/^["']|["']$/g, "");
  if (!value) {
    return {
      present: false,
      length: 0,
      parseOk: false,
      scheme: null,
      hostKind: "none",
      hasUser: false,
      hasPassword: false,
      hasDatabase: false,
      looksLikeJwt: false,
      looksLikeProjectRef: false,
      hint: "Set SUPABASE_DB_URL (or SUPABASE_DB) to a postgresql:// connection URI",
    };
  }
  const looksLikeJwt = value.startsWith("eyJ");
  const looksLikeProjectRef = /^[a-z0-9]{15,32}$/i.test(value);
  let parseOk = false;
  let scheme: string | null = null;
  let hostKind: "db.supabase" | "pooler.supabase" | "other" | "none" = "none";
  let hasUser = false;
  let hasPassword = false;
  let hasDatabase = false;
  try {
    const u = new URL(value);
    parseOk = true;
    scheme = u.protocol.replace(":", "");
    hasUser = Boolean(u.username);
    hasPassword = Boolean(u.password);
    hasDatabase = Boolean(u.pathname && u.pathname !== "/");
    if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(u.hostname)) hostKind = "db.supabase";
    else if (/pooler\.supabase\.com$/i.test(u.hostname)) hostKind = "pooler.supabase";
    else if (u.hostname) hostKind = "other";
  } catch {
    parseOk = false;
  }
  let hint: string | undefined;
  if (looksLikeJwt) {
    hint = "Value looks like a JWT — use the Postgres connection URI, not the service role key";
  } else if (looksLikeProjectRef) {
    hint = "Value looks like a project ref — use the full postgresql:// URI from Database settings";
  } else if (!parseOk) {
    hint =
      "Value is not a valid URL. Expected postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres";
  } else if (!scheme?.startsWith("postgres")) {
    hint = `Scheme is ${scheme} — expected postgresql:// or postgres://`;
  } else if (!hasPassword) {
    hint = "Connection URI is missing a password";
  }
  return {
    present: true,
    length: value.length,
    parseOk,
    scheme,
    hostKind,
    hasUser,
    hasPassword,
    hasDatabase,
    looksLikeJwt,
    looksLikeProjectRef,
    hint,
  };
}

function normalizeDbUrl(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "");
}

/**
 * Server-only DB inspect / migrate.
 * Requires SITEFLIP_ALLOW_MIGRATE=1 and x-migrate-token.
 * Uses SUPABASE_DB_URL / SUPABASE_DB from Worker secrets only.
 */
export async function GET(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw =
    process.env.SUPABASE_DB_URL?.trim() || process.env.SUPABASE_DB?.trim();
  const shape = safeDbUrlShape(raw);
  if (!raw) {
    return NextResponse.json(
      {
        error: "SUPABASE_DB_URL not configured on Worker",
        hint: "Set SUPABASE_DB_URL (or SUPABASE_DB) as an encrypted Worker secret",
        dbUrlShape: shape,
      },
      { status: 503 }
    );
  }
  if (!shape.parseOk || shape.looksLikeJwt || shape.looksLikeProjectRef) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        action: "inspect",
        error: "Invalid URL string.",
        dbUrlShape: shape,
      },
      { status: 503 }
    );
  }
  const dbUrl = normalizeDbUrl(raw);
  const result = await inspectAndMigrate({
    databaseUrl: dbUrl,
    migrations: MIGRATION_SQL,
    apply: false,
  });
  return NextResponse.json({
    action: "inspect",
    migrationFiles: MIGRATION_FILES,
    dbUrlShape: shape,
    ...result,
  });
}

export async function POST(request: Request) {
  await ensureCloudflareEnv();
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw =
    process.env.SUPABASE_DB_URL?.trim() || process.env.SUPABASE_DB?.trim();
  const shape = safeDbUrlShape(raw);
  if (!raw) {
    return NextResponse.json(
      {
        error: "SUPABASE_DB_URL not configured on Worker",
        hint: "Set SUPABASE_DB_URL (or SUPABASE_DB) as an encrypted Worker secret",
        dbUrlShape: shape,
      },
      { status: 503 }
    );
  }
  if (!shape.parseOk || shape.looksLikeJwt || shape.looksLikeProjectRef) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        action: "migrate",
        error: "Invalid URL string.",
        dbUrlShape: shape,
      },
      { status: 503 }
    );
  }
  const dbUrl = normalizeDbUrl(raw);
  const result = await inspectAndMigrate({
    databaseUrl: dbUrl,
    migrations: MIGRATION_SQL,
    apply: true,
  });
  return NextResponse.json({
    action: "migrate",
    migrationFiles: MIGRATION_FILES,
    dbUrlShape: shape,
    ...result,
  });
}
