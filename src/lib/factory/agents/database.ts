import {
  databaseSpecSchema,
  type DatabaseSpec,
  type ProductSpec,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runDatabaseAgent(product: ProductSpec) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP DatabaseAgent. Generate schema JSON + migration SQL for an isolated sandbox. Never destroy production tables. applied must be false unless explicitly applied.",
    user: { product },
    schema: databaseSpecSchema,
    heuristic: () => heuristicDatabase(product),
  });
}

function heuristicDatabase(product: ProductSpec): DatabaseSpec {
  const tables = product.databaseRequirements.map((name) => ({
    name,
    columns: ["id uuid pk", "created_at timestamptz", "updated_at timestamptz"],
    relationships: name === "memberships" ? ["profiles", "organizations"] : [],
  }));

  const migrationSql = `-- SANDBOX MIGRATION (NOT APPLIED)
-- Isolated schema strategy — does not touch SITEFLIP core tables
CREATE SCHEMA IF NOT EXISTS sandbox_app;

${product.databaseRequirements
  .map(
    (t) => `CREATE TABLE IF NOT EXISTS sandbox_app.${t} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`
  )
  .join("\n\n")}

-- Enable RLS (policies require owner wiring)
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
`;

  return {
    tables,
    indexes: product.databaseRequirements.map((t) => `idx_${t}_created_at`),
    rlsPolicies: [
      "Users can read/write own org rows",
      "Service role bypass for webhooks only",
    ],
    migrationSql,
    seedNotes: "Seed data not applied automatically.",
    documentation:
      "Migrations are generated and validated as text. They are NOT auto-applied to production. User approval required before applying.",
    applied: false,
    labeledAssumptions: [
      "Schema is a starter scaffold from product requirements",
      "applied=false — no database mutation performed",
    ],
  };
}
