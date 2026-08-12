#!/usr/bin/env node
/**
 * Apply SITEFLIP SQL migrations when SUPABASE_DB_URL is available.
 * Never logs connection secrets.
 *
 * Usage: node scripts/apply-migrations.mjs
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
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

  const files = [
    "001_initial_schema.sql",
    "002_business_factory.sql",
    "003_mvp_production.sql",
    "004_mollie_payments.sql",
  ];
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const file of files) {
      const full = path.join(__dirname, "..", "supabase", "migrations", file);
      const sql = fs.readFileSync(full, "utf8");
      console.log("Applying", file, "…");
      await client.query(sql);
      console.log("OK", file);
    }
    console.log("All migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message || "unknown error");
  process.exit(1);
});
