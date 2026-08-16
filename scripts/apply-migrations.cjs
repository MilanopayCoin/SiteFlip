#!/usr/bin/env node
/**
 * Apply SITEFLIP SQL migrations OUTSIDE the Cloudflare Worker.
 *
 * Cloudflare Free Workers must NOT open PostgreSQL TCP/TLS (postgres.js).
 * Production runtime uses Supabase HTTP / PostgREST only.
 *
 * Usage (CI / agent / local):
 *   SUPABASE_DB_URL='postgresql://postgres.<ref>:...@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' \
 *     npm run db:migrate
 *
 * Never logs connection secrets.
 * Safe for partial applies: ignores duplicate_object / already-exists errors.
 */
const fs = require("fs");
const path = require("path");

const FILES = [
  "001_initial_schema.sql",
  "002_business_factory.sql",
  "003_mvp_production.sql",
  "004_mollie_payments.sql",
  "005_fix_profiles_rls_recursion.sql",
];

/** Postgres codes we treat as "already applied" (non-destructive continue). */
const IGNORABLE = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object (type, policy, etc.)
  "42701", // duplicate_column
  "42P16", // invalid_table_definition (sometimes concurrent)
  "23505", // unique_violation on index create rare paths
]);

function isIgnorable(err) {
  if (!err) return false;
  if (IGNORABLE.has(err.code)) return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate key") ||
    (msg.includes("policy") && msg.includes("already"))
  );
}

/**
 * Split SQL into executable statements without breaking function bodies.
 */
function splitStatements(sql) {
  const stmts = [];
  let buf = "";
  let inSingle = false;
  let inDollar = null; // tag including $$
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (!inSingle && !inDollar && c === "-" && next === "-") {
      // line comment
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

async function applyFile(client, file) {
  const full = path.join(__dirname, "..", "supabase", "migrations", file);
  const sql = fs.readFileSync(full, "utf8");
  const stmts = splitStatements(sql);
  let applied = 0;
  let skipped = 0;
  for (const stmt of stmts) {
    try {
      await client.query(stmt);
      applied++;
    } catch (err) {
      if (isIgnorable(err)) {
        skipped++;
        continue;
      }
      const preview = stmt.replace(/\s+/g, " ").slice(0, 120);
      const e = new Error(
        `${file} failed (${err.code || "ERR"}): ${err.message} :: ${preview}`
      );
      e.cause = err;
      throw e;
    }
  }
  return { applied, skipped, statements: stmts.length };
}

async function verifyCore(client) {
  const { rows } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY($1::text[])
    ORDER BY tablename
  `, [
    [
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
    ],
  ]);
  return rows.map((r) => r.tablename);
}

/**
 * Parse postgres URLs even when the password contains unencoded [ ] or :.
 * Prefer pooler hosts when given a direct db.*.supabase.co URL (IPv4).
 */
function resolveConnection(dbUrl) {
  const raw = String(dbUrl).trim();
  let user;
  let password;
  let hostname;
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
    // If URL parser truncated password (e.g. unencoded brackets), prefer manual.
    if (!password || manualPass.length >= (password?.length || 0)) {
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
      port: 5432, // Session mode (Cloudflare Free / external migrator)
      user: user.includes(".") ? user : `postgres.${ref}`,
      password,
      database,
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    host: hostname,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const dbUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DB ||
    process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "SUPABASE_DB_URL not set — apply migrations via Supabase SQL Editor."
    );
    process.exit(2);
  }

  let pg;
  try {
    pg = require("pg");
  } catch {
    console.error("Missing pg. Run: npm install pg");
    process.exit(2);
  }

  const cfg = resolveConnection(dbUrl);
  console.log(
    "Connecting host=%s port=%s user_len=%s",
    cfg.host,
    cfg.port,
    cfg.user.length
  );
  const client = new pg.Client(cfg);
  await client.connect();
  try {
    const results = {};
    for (const file of FILES) {
      console.log("Applying", file, "…");
      const r = await applyFile(client, file);
      results[file] = r;
      console.log(
        "OK",
        file,
        `(stmts=${r.statements}, applied=${r.applied}, skipped_existing=${r.skipped})`
      );
    }
    const tables = await verifyCore(client);
    console.log("Core tables present:", tables.join(", ") || "(none)");
    console.log("All migrations processed.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message || "unknown error");
  process.exit(1);
});
