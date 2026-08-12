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
  const isBooking = product.pages.some((p) =>
    /booking|customer|service|calendar/i.test(p)
  );

  const tableDefs = isBooking
    ? [
        {
          name: "companies",
          fields: [
            { name: "id", type: "uuid", nullable: false, primaryKey: true, unique: true },
            { name: "name", type: "text", nullable: false, primaryKey: false, unique: false },
            { name: "owner_id", type: "uuid", nullable: false, primaryKey: false, unique: false },
            { name: "created_at", type: "timestamptz", nullable: false, primaryKey: false, unique: false },
          ],
          relationships: ["profiles"],
          indexes: ["idx_companies_owner_id"],
          constraints: ["fk_companies_owner_profiles"],
        },
        {
          name: "customers",
          fields: [
            { name: "id", type: "uuid", nullable: false, primaryKey: true, unique: true },
            { name: "company_id", type: "uuid", nullable: false, primaryKey: false, unique: false },
            { name: "name", type: "text", nullable: false, primaryKey: false, unique: false },
            { name: "email", type: "text", nullable: true, primaryKey: false, unique: false },
            { name: "phone", type: "text", nullable: true, primaryKey: false, unique: false },
          ],
          relationships: ["companies"],
          indexes: ["idx_customers_company_id"],
          constraints: ["fk_customers_company"],
        },
        {
          name: "services",
          fields: [
            { name: "id", type: "uuid", nullable: false, primaryKey: true, unique: true },
            { name: "company_id", type: "uuid", nullable: false, primaryKey: false, unique: false },
            { name: "name", type: "text", nullable: false, primaryKey: false, unique: false },
            { name: "duration_minutes", type: "integer", nullable: false, primaryKey: false, unique: false },
            { name: "price_cents", type: "integer", nullable: false, primaryKey: false, unique: false },
          ],
          relationships: ["companies"],
          indexes: ["idx_services_company_id"],
          constraints: ["fk_services_company"],
        },
        {
          name: "bookings",
          fields: [
            { name: "id", type: "uuid", nullable: false, primaryKey: true, unique: true },
            { name: "company_id", type: "uuid", nullable: false, primaryKey: false, unique: false },
            { name: "customer_id", type: "uuid", nullable: false, primaryKey: false, unique: false },
            { name: "service_id", type: "uuid", nullable: false, primaryKey: false, unique: false },
            { name: "scheduled_at", type: "timestamptz", nullable: false, primaryKey: false, unique: false },
            { name: "status", type: "text", nullable: false, primaryKey: false, unique: false },
          ],
          relationships: ["companies", "customers", "services"],
          indexes: ["idx_bookings_company_scheduled", "idx_bookings_customer_id"],
          constraints: ["fk_bookings_customer", "fk_bookings_service", "check_status_valid"],
        },
        {
          name: "profiles",
          fields: [
            { name: "id", type: "uuid", nullable: false, primaryKey: true, unique: true },
            { name: "email", type: "text", nullable: false, primaryKey: false, unique: true },
            { name: "display_name", type: "text", nullable: true, primaryKey: false, unique: false },
          ],
          relationships: [],
          indexes: ["idx_profiles_email"],
          constraints: ["unique_profiles_email"],
        },
      ]
    : product.databaseRequirements.map((name) => ({
        name,
        fields: [
          { name: "id", type: "uuid", nullable: false, primaryKey: true, unique: true },
          { name: "created_at", type: "timestamptz", nullable: false, primaryKey: false, unique: false },
          { name: "updated_at", type: "timestamptz", nullable: false, primaryKey: false, unique: false },
        ],
        columns: ["id uuid pk", "created_at timestamptz", "updated_at timestamptz"],
        relationships: name === "memberships" ? ["profiles", "organizations"] : [],
        indexes: [`idx_${name}_created_at`],
        constraints: [],
      }));

  const migrationSql = `-- SANDBOX MIGRATION (NOT APPLIED)
-- Isolated schema — does NOT touch SITEFLIP production tables
-- Adapter: connect via SandboxDbAdapter / future Supabase branch
CREATE SCHEMA IF NOT EXISTS sandbox_app;

${tableDefs
  .map((t) => {
    const cols =
      "fields" in t && t.fields?.length
        ? t.fields
            .map((f) => {
              let def = `${f.name} ${f.type.toUpperCase()}`;
              if (f.primaryKey) def += " PRIMARY KEY";
              if (!f.nullable && !f.primaryKey) def += " NOT NULL";
              return def;
            })
            .join(",\n  ")
        : ("columns" in t && t.columns ? t.columns : []).join(",\n  ");
    return `CREATE TABLE IF NOT EXISTS sandbox_app.${t.name} (\n  ${cols}\n);`;
  })
  .join("\n\n")}

-- Enable RLS before production connection (policies require approval)
`;

  return {
    tables: tableDefs,
    indexes: tableDefs.flatMap((t) => t.indexes ?? []),
    constraints: tableDefs.flatMap((t) => t.constraints ?? []),
    adapterArchitecture: [
      "InMemoryDbAdapter for LOCAL / DEMO preview",
      "SupabaseDbAdapter stub — connect after approval + branch provisioning",
      "Never use SITEFLIP production DATABASE_URL from generated code",
      "Migrations are spec-only until user approves database_change",
    ],
    rlsPolicies: [
      "company_id = auth.jwt() -> company_id for tenant isolation",
      "Users read/write own company rows only",
      "Service role for webhooks only — never in client bundle",
    ],
    migrationSql,
    seedNotes: "Seed data not applied automatically. Demo uses in-memory API stores.",
    documentation:
      "Database specification for isolated sandbox. NOT applied to SITEFLIP production. Supabase adapter can be connected later.",
    applied: false,
    labeledAssumptions: [
      "Schema is AI-generated starter spec — requires DBA review",
      "applied=false — no database mutation performed",
    ],
  };
}
