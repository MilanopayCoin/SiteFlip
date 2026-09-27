/**
 * Apply SITEFLIP SQL migrations via Postgres (Session pooler).
 * Intended for external Node / authorized admin tooling — not routine Worker traffic.
 * Never logs connection secrets.
 */

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

export const MIGRATION_FILES = [
  "001_initial_schema.sql",
  "002_business_factory.sql",
  "003_mvp_production.sql",
  "004_mollie_payments.sql",
  "005_fix_profiles_rls_recursion.sql",
  "006_marketplace_core.sql",
] as const;

export const MARKETPLACE_CORE_TABLES = [
  "disputes",
  "payouts",
  "audit_logs",
] as const;

export const MARKETPLACE_CORE_COLUMNS = {
  listings: ["transfer_readiness", "moderation_note"],
  transactions: ["funds_state", "platform_fee", "commission_rate"],
} as const;

const IGNORABLE = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object
  "42701", // duplicate_column
  "42P16",
  "23505",
]);

function isIgnorable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code && IGNORABLE.has(e.code)) return true;
  const msg = String(e.message || "").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate key") ||
    (msg.includes("policy") && msg.includes("already"))
  );
}

/** Split SQL into statements without breaking dollar-quoted function bodies. */
export function splitStatements(sql: string): string[] {
  const stmts: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDollar: string | null = null;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (!inSingle && !inDollar && c === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        buf += sql[i++];
      }
      continue;
    }

    if (!inDollar && c === "'") {
      buf += c;
      if (inSingle && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      inSingle = !inSingle;
      i++;
      continue;
    }

    if (!inSingle) {
      if (!inDollar && c === "$") {
        const m = sql.slice(i).match(/^\$([A-Za-z0-9_]*)\$/);
        if (m) {
          inDollar = m[0];
          buf += m[0];
          i += m[0].length;
          continue;
        }
      } else if (inDollar && sql.startsWith(inDollar, i)) {
        buf += inDollar;
        i += inDollar.length;
        inDollar = null;
        continue;
      }
    }

    if (!inSingle && !inDollar && c === ";") {
      const s = buf.trim();
      if (s) stmts.push(s);
      buf = "";
      i++;
      continue;
    }

    buf += c;
    i++;
  }
  const tail = buf.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

function resolveConnection(dbUrl: string) {
  const raw = String(dbUrl).trim();
  let user = "";
  let password = "";
  let hostname = "";
  let port = 5432;
  let database = "postgres";

  try {
    const u = new URL(raw);
    user = decodeURIComponent(u.username);
    password = decodeURIComponent(u.password);
    hostname = u.hostname;
    port = Number(u.port || 5432);
    database = (u.pathname || "/postgres").replace(/^\//, "") || "postgres";
  } catch {
    /* fall through */
  }

  const manual = raw.match(
    /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]*)/
  );
  if (manual) {
    const manualPass = decodeURIComponent(manual[2]);
    if (!password || manualPass.length >= password.length) {
      user = decodeURIComponent(manual[1]);
      password = manualPass;
      hostname = manual[3];
      port = Number(manual[4] || 5432);
      database = manual[5] || "postgres";
    }
  }

  if (!hostname || !user || password == null) {
    throw new Error("Could not parse SUPABASE_DB_URL");
  }

  const m = hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (m) {
    const ref = m[1];
    return {
      host: "aws-0-eu-central-1.pooler.supabase.com",
      port: 5432,
      user: user.includes(".") ? user : `postgres.${ref}`,
      password,
      database,
    };
  }

  return { host: hostname, port, user, password, database };
}

function migrationsDir(): string {
  // OpenNext / Worker may not ship SQL files — prefer process.cwd()
  const candidates = [
    path.join(process.cwd(), "supabase", "migrations"),
    path.join(process.cwd(), "..", "supabase", "migrations"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error("supabase/migrations directory not found in Worker bundle");
}

export type MigrationApplyResult = {
  ok: boolean;
  results: Record<
    string,
    { applied: number; skipped: number; statements: number }
  >;
  marketplaceCore: {
    tables: Record<string, boolean>;
    columns: Record<string, Record<string, boolean>>;
  };
  error?: string;
};

async function verifyMarketplaceCore(
  sql: postgres.Sql
): Promise<MigrationApplyResult["marketplaceCore"]> {
  const tables: Record<string, boolean> = {};
  for (const t of MARKETPLACE_CORE_TABLES) {
    const rows = await sql`
      SELECT 1 AS ok
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = ${t}
      LIMIT 1
    `;
    tables[t] = rows.length > 0;
  }

  const columns: Record<string, Record<string, boolean>> = {};
  for (const [table, cols] of Object.entries(MARKETPLACE_CORE_COLUMNS)) {
    columns[table] = {};
    for (const col of cols) {
      const rows = await sql`
        SELECT 1 AS ok
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table}
          AND column_name = ${col}
        LIMIT 1
      `;
      columns[table][col] = rows.length > 0;
    }
  }
  return { tables, columns };
}

export async function applyMigrationsFromUrl(
  dbUrl: string,
  opts?: { files?: readonly string[]; sqlContents?: Record<string, string> }
): Promise<MigrationApplyResult> {
  const files = opts?.files ?? MIGRATION_FILES;
  const cfg = resolveConnection(dbUrl);
  const sql = postgres({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    username: cfg.user,
    password: cfg.password,
    ssl: "require",
    max: 1,
    connect_timeout: 20,
    idle_timeout: 5,
    prepare: false,
  });

  const results: MigrationApplyResult["results"] = {};
  try {
    for (const file of files) {
      let text = opts?.sqlContents?.[file];
      if (!text) {
        const full = path.join(migrationsDir(), file);
        text = fs.readFileSync(full, "utf8");
      }
      const stmts = splitStatements(text);
      let applied = 0;
      let skipped = 0;
      for (const stmt of stmts) {
        try {
          await sql.unsafe(stmt);
          applied++;
        } catch (err) {
          if (isIgnorable(err)) {
            skipped++;
            continue;
          }
          const preview = stmt.replace(/\s+/g, " ").slice(0, 120);
          const code =
            err && typeof err === "object" && "code" in err
              ? String((err as { code?: string }).code || "ERR")
              : "ERR";
          const message =
            err instanceof Error ? err.message : "unknown migration error";
          throw new Error(`${file} failed (${code}): ${message} :: ${preview}`);
        }
      }
      results[file] = { applied, skipped, statements: stmts.length };
    }

    const marketplaceCore = await verifyMarketplaceCore(sql);
    const tablesOk = MARKETPLACE_CORE_TABLES.every((t) => marketplaceCore.tables[t]);
    return { ok: tablesOk, results, marketplaceCore };
  } catch (err) {
    const message = err instanceof Error ? err.message : "migration failed";
    let marketplaceCore: MigrationApplyResult["marketplaceCore"] = {
      tables: {},
      columns: {},
    };
    try {
      marketplaceCore = await verifyMarketplaceCore(sql);
    } catch {
      /* ignore verify after failure */
    }
    return { ok: false, results, marketplaceCore, error: message };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
