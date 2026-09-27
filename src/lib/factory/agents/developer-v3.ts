import {
  codeArtifactSchema,
  type ArchitectureSpec,
  type CodeArtifact,
  type DatabaseSpec,
  type PlanSpec,
  type ProductSpec,
} from "../schemas";
import { scanGeneratedContent } from "../sandbox";
import { runStructuredAgent } from "./base";

/**
 * DeveloperAgent V3 — generates starter mini-SaaS scaffold in isolated workspace.
 * NOT production-ready. Does NOT access SITEFLIP secrets or production DB.
 */
export async function runDeveloperAgentV3(input: {
  plan: PlanSpec;
  product: ProductSpec;
  architecture: ArchitectureSpec;
  database: DatabaseSpec;
}) {
  const result = await runStructuredAgent({
    system:
      "You are SITEFLIP DeveloperAgent V3. Generate a starter mini-SaaS scaffold as JSON {files:[{path,language,content,purpose}],dependencies,notes,completeness:'starter_mvp_scaffold',sandboxOnly:true}. Include Landing, Register, Login, Dashboard, core business pages, API routes, auth architecture, validation, error handling. Never reference SITEFLIP production secrets. completeness must be starter_mvp_scaffold.",
    user: input,
    schema: codeArtifactSchema,
    heuristic: () => heuristicMvpScaffold(input),
  });

  for (const file of result.data.files) {
    const scan = scanGeneratedContent(file.content);
    if (!scan.safe) {
      file.content = `/* BLOCKED: ${scan.findings.join("; ")} */\nexport default function Blocked(){return null}`;
    }
  }

  result.data.completeness = "starter_mvp_scaffold";
  result.data.sandboxOnly = true;
  result.data.labeledAssumptions = [
    ...(result.data.labeledAssumptions ?? []),
    "AI GENERATED STARTER — not production-ready SaaS",
    "Isolated sandbox workspace — not written into SITEFLIP core",
    "Database adapter spec only — no production DB connection",
  ];

  return result;
}

function heuristicMvpScaffold(input: {
  plan: PlanSpec;
  product: ProductSpec;
  architecture: ArchitectureSpec;
  database: DatabaseSpec;
}): CodeArtifact {
  const { plan, product } = input;
  if (!plan?.businessName) {
    throw new Error(
      "DeveloperAgent requires PlanSpec.businessName — GENERATE outputs missing"
    );
  }
  const name = plan.businessName;
  const pages =
    product?.pages?.length
      ? product.pages
      : plan.mvpPages?.length
        ? plan.mvpPages
        : ["Landing", "Dashboard", "Settings"];
  const primary = "#7c3aed";
  const bg = "#09090b";

  const pageComponent = (title: string, body: string) => `"use client";
/** AI GENERATED STARTER — ${title} */
export default function ${title.replace(/[^a-zA-Z]/g, "")}Page() {
  return (
    <main style={{ minHeight: "100vh", background: "${bg}", color: "#fafafa", padding: 24, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <strong style={{ color: "${primary}" }}">${name}</strong>
        <nav style={{ display: "flex", gap: 12, fontSize: 14 }}>
          ${pages
            .slice(0, 6)
            .map((p) => `<a href="#" style={{ color: "#a1a1aa" }}>${p}</a>`)
            .join("\n          ")}
        </nav>
      </header>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>${title}</h1>
      <p style={{ color: "#a1a1aa", maxWidth: 640 }}>${body}</p>
      <p style={{ marginTop: 24, fontSize: 12, color: "#52525b" }}>AI GENERATED STARTER · Demo data only · NOT PERSISTED</p>
    </main>
  );
}
`;

  const files: CodeArtifact["files"] = [
    {
      path: "sandbox/app/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Landing",
        `${plan.solution} Built for ${plan.targetCustomer}.`
      ),
      purpose: "Public landing page",
    },
    {
      path: "sandbox/app/register/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Register",
        "Create your company account. Demo auth only — no production database."
      ),
      purpose: "Registration page",
    },
    {
      path: "sandbox/app/login/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Login",
        "Sign in to your dashboard. Session stored in local demo storage."
      ),
      purpose: "Login page",
    },
    {
      path: "sandbox/app/dashboard/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Dashboard",
        "Overview KPIs: upcoming bookings, active customers, revenue estimate (demo)."
      ),
      purpose: "Authenticated dashboard",
    },
    {
      path: "sandbox/app/customers/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Customers",
        "Manage customer records — name, contact, address, notes."
      ),
      purpose: "Customers CRUD page",
    },
    {
      path: "sandbox/app/services/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Services",
        "Define cleaning services, duration, and pricing."
      ),
      purpose: "Services catalog page",
    },
    {
      path: "sandbox/app/bookings/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Bookings",
        "Create, edit, and list bookings linked to customers and services."
      ),
      purpose: "Bookings management page",
    },
    {
      path: "sandbox/app/calendar/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Calendar",
        "Week/month view of scheduled bookings for your team."
      ),
      purpose: "Calendar scheduling page",
    },
    {
      path: "sandbox/app/settings/page.tsx",
      language: "tsx",
      content: pageComponent(
        "Settings",
        "Company profile, notification preferences, team members (starter)."
      ),
      purpose: "Settings page",
    },
    {
      path: "sandbox/lib/auth.ts",
      language: "typescript",
      content: `/**
 * Demo authentication architecture — AI GENERATED STARTER
 * Adapter-ready for Supabase Auth when approved and configured.
 */
export interface DemoUser {
  id: string;
  email: string;
  companyName: string;
}

const STORAGE_KEY = "sandbox_demo_session";

export async function register(email: string, password: string, companyName: string): Promise<DemoUser> {
  if (!email.includes("@")) throw new Error("Invalid email");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const user = { id: crypto.randomUUID(), email, companyName };
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
  return user;
}

export async function login(email: string, password: string): Promise<DemoUser> {
  if (!email.includes("@")) throw new Error("Invalid email");
  if (password.length < 8) throw new Error("Invalid credentials");
  const user = { id: crypto.randomUUID(), email, companyName: "Demo Company" };
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
  return user;
}

export function getSession(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function logout(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
}
`,
      purpose: "Authentication architecture (demo adapter)",
    },
    {
      path: "sandbox/lib/db-adapter.ts",
      language: "typescript",
      content: `/**
 * Database adapter — spec only, NOT connected to SITEFLIP production DB.
 * Supabase adapter can be wired after approval.
 */
export type DbAdapter = {
  connect(): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
};

export class InMemoryDbAdapter implements DbAdapter {
  private store = new Map<string, unknown[]>();

  async connect() {
    /* SANDBOX: DEVELOPMENT ISOLATION — in-memory only */
  }

  async query<T>(table: string, _params?: unknown[]): Promise<T[]> {
    return (this.store.get(table) ?? []) as T[];
  }
}

export function createDbAdapter(): DbAdapter {
  return new InMemoryDbAdapter();
}
`,
      purpose: "Database adapter architecture",
    },
    {
      path: "sandbox/lib/validation.ts",
      language: "typescript",
      content: `/** Input validation helpers — AI GENERATED STARTER */
export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(\`\${field} is required\`);
  }
  return value.trim();
}

export function requireEmail(value: unknown): string {
  const email = requireString(value, "email");
  if (!email.includes("@")) throw new Error("Invalid email");
  return email;
}

export function requirePositiveNumber(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(\`\${field} must be a positive number\`);
  return n;
}
`,
      purpose: "Validation utilities",
    },
    {
      path: "sandbox/app/api/bookings/route.ts",
      language: "typescript",
      content: `import { NextResponse } from "next/server";
import { requireString } from "../../../lib/validation";

/** Demo API — in-memory, NOT PERSISTED */
const bookings: Array<{ id: string; customerId: string; serviceId: string; scheduledAt: string }> = [];

export async function GET() {
  return NextResponse.json({ bookings, label: "AI GENERATED STARTER · DEMO" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerId = requireString(body.customerId, "customerId");
    const serviceId = requireString(body.serviceId, "serviceId");
    const scheduledAt = requireString(body.scheduledAt, "scheduledAt");
    const booking = { id: crypto.randomUUID(), customerId, serviceId, scheduledAt };
    bookings.push(booking);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 400 }
    );
  }
}
`,
      purpose: "Bookings API with validation",
    },
    {
      path: "sandbox/app/api/customers/route.ts",
      language: "typescript",
      content: `import { NextResponse } from "next/server";
import { requireString } from "../../../lib/validation";

const customers: Array<{ id: string; name: string; email: string }> = [];

export async function GET() {
  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = requireString(body.name, "name");
    const email = requireString(body.email, "email");
    const customer = { id: crypto.randomUUID(), name, email };
    customers.push(customer);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 400 }
    );
  }
}
`,
      purpose: "Customers API with validation",
    },
    {
      path: "sandbox/README.md",
      language: "markdown",
      content: `# ${name} — AI GENERATED STARTER MVP

Generated by SITEFLIP Factory V3 DeveloperAgent.

## Pages
${pages.map((p) => `- ${p}`).join("\n")}

## Status
- Completeness: **starter_mvp_scaffold**
- Sandbox: **DEVELOPMENT ISOLATION**
- Database: **spec only — adapter not connected to production**
- Payments: **not activated — Mollie requires approval**
- Persistence: **LOCAL / DEMO / NOT PERSISTED**

## Disclaimer
This is a starter MVP scaffold — NOT a production-ready SaaS.
`,
      purpose: "Sandbox documentation",
    },
    {
      path: "sandbox/spec/database.sql",
      language: "sql",
      content:
        (typeof input.database?.migrationSql === "string" &&
          input.database.migrationSql.trim()) ||
        `-- Schema stub for ${name}\n-- DEMO adapter only — not applied to production\n`,
      purpose: "Database specification (not applied)",
    },
  ];

  return {
    files,
    dependencies: [
      "next",
      "react",
      "react-dom",
      "typescript",
      "zod",
    ],
    notes: [
      "V3 mini-SaaS scaffold — frontend + API + auth + DB adapter spec",
      "Files stored as factory outputs — isolated from SITEFLIP core",
      "Preview rendered via durable /generated/[id] runtime",
    ],
    completeness: "starter_mvp_scaffold",
    sandboxOnly: true,
    labeledAssumptions: [
      "Starter MVP only — further engineering required for production",
      "Demo auth uses sessionStorage — not secure for production",
      "API routes use in-memory stores — not persisted",
    ],
  };
}
