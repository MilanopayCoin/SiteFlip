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

function safeDbError(err: unknown): string {
  const message = err instanceof Error ? err.message : "migration_failed";
  return message
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[redacted-db-url]")
    .replace(/password=[^\s]+/gi, "password=[redacted]")
    .slice(0, 300);
}

/**
 * Build candidate connection strings. Direct db.* hosts are often IPv6-only
 * and blocked from some runtimes; Supabase Session pooler is preferred.
 * Order: session pooler :5432 → transaction :6543 → original URL.
 * Never logs credentials.
 */
export function buildDbUrlCandidates(databaseUrl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname;
    const password = decodeURIComponent(parsed.password);
    const database = (parsed.pathname || "/postgres").replace(/^\//, "") || "postgres";
    const region = "eu-central-1";
    const poolHost = `aws-0-${region}.pooler.supabase.com`;

    const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    const pooler = /pooler\.supabase\.com$/i.test(host);
    const ref = direct?.[1] || null;

    const makePool = (port: number, user: string) => {
      const u = new URL(`postgresql://${host}`);
      u.protocol = "postgresql:";
      u.hostname = poolHost;
      u.port = String(port);
      u.username = user;
      u.password = password;
      u.pathname = `/${database}`;
      if (port === 6543) u.searchParams.set("sslmode", "require");
      return u.toString();
    };

    if (direct && ref) {
      const poolUser = `postgres.${ref}`;
      // Session mode first (required architecture), then transaction pooler.
      add(makePool(5432, poolUser));
      add(makePool(6543, poolUser));
    } else if (pooler) {
      // Prefer session port when a non-5432 pooler URL was stored.
      if (parsed.port && parsed.port !== "5432") {
        const u = new URL(databaseUrl);
        u.port = "5432";
        u.searchParams.delete("sslmode");
        add(u.toString());
      }
    }
  } catch {
    // keep original only below
  }

  add(databaseUrl);
  return out;
}

async function withSql<T>(
  databaseUrl: string,
  fn: (sql: postgres.Sql) => Promise<T>
): Promise<{ result: T; viaHost: string }> {
  // Prefer Session pooler candidate first. Keep attempts minimal on Workers
  // Free plan (50 subrequest limit).
  const candidates = buildDbUrlCandidates(databaseUrl).slice(0, 1);
  const errors: string[] = [];
  for (const url of candidates) {
    let hostLabel = "unknown";
    let sql: postgres.Sql | null = null;
    try {
      const u = new URL(url);
      hostLabel = `${u.hostname}:${u.port || "5432"}`;
      sql = postgres({
        host: u.hostname,
        port: Number(u.port || 5432),
        database: (u.pathname || "/postgres").replace(/^\//, "") || "postgres",
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        ssl: "require",
        max: 1,
        idle_timeout: 2,
        connect_timeout: 10,
        max_lifetime: 30,
        fetch_types: false,
        prepare: false,
        connection: { application_name: "jiy-migrate" },
        onnotice: () => {},
        backoff: () => 1e9,
      });
      await sql`select 1 as ok`;
      const result = await fn(sql);
      await sql.end({ timeout: 5 });
      return { result, viaHost: hostLabel };
    } catch (err) {
      errors.push(`${hostLabel}: ${safeDbError(err)}`);
      if (sql) {
        try {
          await sql.end({ timeout: 1 });
        } catch {
          /* ignore */
        }
      }
    }
  }
  throw new Error(errors.slice(0, 4).join(" | ") || "db_connect_failed");
}

export async function inspectAndMigrate(opts: {
  databaseUrl: string;
  migrations: Record<string, string>;
  apply: boolean;
}): Promise<MigrateResult & { viaHost?: string }> {
  const files: MigrateFileResult[] = [];

  try {
    const { result, viaHost } = await withSql(opts.databaseUrl, async (sql) => {
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
          AND tablename IN ${sql(REQUIRED_TABLES as unknown as string[])}
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
          AND c.relname IN ${sql(REQUIRED_TABLES as unknown as string[])}
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
      } satisfies MigrateResult;
    });

    return { ...result, viaHost };
  } catch (err) {
    return {
      ok: false,
      connected: false,
      files,
      tables: {},
      foreignKeys: 0,
      indexes: 0,
      policies: 0,
      rlsDisabled: [],
      error: safeDbError(err),
    };
  }
}
