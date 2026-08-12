/**
 * Server-only SQL migration helpers for Cloudflare Workers.
 * Never logs connection strings or statement parameters with secrets.
 */

import postgres from "postgres";

export const MIGRATION_FILES = [
  "001_initial_schema.sql",
  "002_business_factory.sql",
  "003_mvp_production.sql",
  "004_mollie_payments.sql",
] as const;

const IGNORABLE = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object
  "42701", // duplicate_column
  "42P16",
  "23505",
]);

function isIgnorable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code && IGNORABLE.has(e.code)) return true;
  const msg = String(e?.message || "").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate key") ||
    (msg.includes("policy") && msg.includes("already"))
  );
}

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
      while (i < sql.length && sql[i] !== "\n") buf += sql[i++];
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

export type MigrateFileResult = {
  file: string;
  statements: number;
  applied: number;
  skippedExisting: number;
};

export type MigrateResult = {
  ok: boolean;
  connected: boolean;
  files: MigrateFileResult[];
  tables: Record<string, boolean>;
  foreignKeys: number;
  indexes: number;
  policies: number;
  rlsDisabled: string[];
  error?: string;
};

const REQUIRED_TABLES = [
  "profiles",
  "businesses",
  "listings",
  "offers",
  "offer_events",
  "messages",
  "watchlists",
  "rental_requests",
  "transactions",
  "payments",
  "factory_projects",
  "factory_runs",
  "factory_outputs",
] as const;

export async function inspectAndMigrate(opts: {
  databaseUrl: string;
  migrations: Record<string, string>;
  apply: boolean;
}): Promise<MigrateResult> {
  const sql = postgres(opts.databaseUrl, {
    ssl: "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    onnotice: () => {},
  });

  const files: MigrateFileResult[] = [];

  try {
    await sql`select 1 as ok`;

    if (opts.apply) {
      for (const file of MIGRATION_FILES) {
        const body = opts.migrations[file];
        if (!body) {
          throw new Error(`Missing migration content: ${file}`);
        }
        const stmts = splitStatements(body);
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
            throw err;
          }
        }
        files.push({
          file,
          statements: stmts.length,
          applied,
          skippedExisting: skipped,
        });
      }
    }

    const tableRows = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY(${REQUIRED_TABLES as unknown as string[]})
    `;
    const present = new Set(tableRows.map((r) => r.tablename));
    const tables: Record<string, boolean> = {};
    for (const t of REQUIRED_TABLES) tables[t] = present.has(t);

    const fk = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
    `;
    const idx = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM pg_indexes WHERE schemaname = 'public'
    `;
    const pol = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM pg_policies WHERE schemaname = 'public'
    `;
    const rlsOff = await sql<{ relname: string }[]>`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
        AND c.relname = ANY(${REQUIRED_TABLES as unknown as string[]})
    `;

    return {
      ok: REQUIRED_TABLES.every((t) => tables[t]),
      connected: true,
      files,
      tables,
      foreignKeys: fk[0]?.n ?? 0,
      indexes: idx[0]?.n ?? 0,
      policies: pol[0]?.n ?? 0,
      rlsDisabled: rlsOff.map((r) => r.relname),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "migration_failed";
    // Never include connection string in error output
    const safe = message
      .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[redacted-db-url]")
      .replace(/password=[^\s]+/gi, "password=[redacted]");
    return {
      ok: false,
      connected: false,
      files,
      tables: {},
      foreignKeys: 0,
      indexes: 0,
      policies: 0,
      rlsDisabled: [],
      error: safe.slice(0, 300),
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
