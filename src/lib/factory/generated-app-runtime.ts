/**
 * Simple generated-app runtime.
 *
 * One HTML application per factory project, served from /preview/:projectId.
 * Source of truth is the artifact persisted on factory_projects (Supabase).
 * Does not require Worker isolate memory, sessionStorage, or client hydration.
 */

import type { FactoryProject } from "./types";
import { addOutput, getOutputByAgent } from "./store";
import type { CodeArtifact, PlanSpec, ProductSpec } from "./schemas";

export const GENERATED_APP_MARKER = "data-jiy-generated-app";
export const GENERATED_APP_OK = "GENERATED_APP_OK";

export const REQUIRED_APP_PAGES = [
  "Landing",
  "Register",
  "Login",
  "Dashboard",
  "Customers",
  "Services",
  "Bookings",
  "Calendar",
  "Settings",
] as const;

export type GeneratedAppPage = (typeof REQUIRED_APP_PAGES)[number];

export interface GeneratedAppArtifact {
  projectId: string;
  businessId: string;
  version: string;
  buildId: string;
  entrypoint: string;
  pages: string[];
  app: {
    name: string;
    summary: string;
    problem: string;
    solution: string;
    targetCustomer: string;
    country: string;
    workflows: string[];
    pricing: string;
  };
  createdAt: string;
}

export type GeneratedAppErrorStage =
  | "project_load"
  | "artifact"
  | "entrypoint"
  | "html_render"
  | "http_verify";

export interface GeneratedAppRuntimeError {
  stage: GeneratedAppErrorStage;
  message: string;
  projectId: string;
  buildId: string | null;
}

export function generatedAppPreviewPath(
  projectId: string,
  pageSlug = ""
): string {
  const base = `/preview/${projectId}`;
  const slug = pageSlug.replace(/^\/+/, "").toLowerCase();
  if (!slug || slug === "landing" || slug === "index.html") return base;
  return `${base}/${slug}`;
}

export function pageSlug(page: string): string {
  const slug = page.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return slug === "landing" ? "" : slug;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asPlan(project: FactoryProject): PlanSpec | undefined {
  return getOutputByAgent(project, "PlannerAgent")?.data as PlanSpec | undefined;
}

function asProduct(project: FactoryProject): ProductSpec | undefined {
  return getOutputByAgent(project, "ProductAgent")?.data as
    | ProductSpec
    | undefined;
}

function asCode(project: FactoryProject): CodeArtifact | undefined {
  return getOutputByAgent(project, "DeveloperAgent")?.data as
    | CodeArtifact
    | undefined;
}

export function getGeneratedAppArtifact(
  project: FactoryProject
): GeneratedAppArtifact | null {
  const fromSandbox = project.sandbox.generatedArtifact;
  if (fromSandbox?.projectId && fromSandbox.entrypoint && fromSandbox.buildId) {
    return fromSandbox;
  }
  const fromOutput = [...project.outputs]
    .reverse()
    .find((o) => o.schemaName === "GeneratedAppArtifactSchema")?.data as
    | GeneratedAppArtifact
    | undefined;
  if (fromOutput?.projectId && fromOutput.entrypoint && fromOutput.buildId) {
    return fromOutput;
  }
  return null;
}

export function buildGeneratedAppArtifact(
  project: FactoryProject
): GeneratedAppArtifact {
  const plan = asPlan(project);
  const product = asProduct(project);
  const pages = uniquePages(
    product?.pages?.length
      ? product.pages
      : plan?.mvpPages?.length
        ? plan.mvpPages
        : [...REQUIRED_APP_PAGES]
  );
  const buildId =
    project.sandbox.generatedArtifact?.buildId ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `bld_${project.id.slice(0, 8)}_${Date.now()}`);
  const version =
    project.pipelineVersion === "v5"
      ? project.sandbox.createMode === "fast"
        ? "v5.1-fast"
        : "v5.1"
      : project.pipelineVersion || "v3";

  return {
    projectId: project.id,
    businessId: project.sandbox.businessId || project.id,
    version,
    buildId,
    entrypoint: generatedAppPreviewPath(project.id),
    pages,
    app: {
      name: plan?.businessName || project.name || "Generated App",
      summary: plan?.summary || project.brief.idea,
      problem:
        plan?.problem ||
        "Small teams need a simpler way to run bookings and customer work.",
      solution:
        plan?.solution ||
        "A starter booking workspace with customers, services, calendar, and settings.",
      targetCustomer: plan?.targetCustomer || project.brief.targetCustomer,
      country: project.brief.country || "Netherlands",
      workflows: plan?.coreWorkflows?.length
        ? plan.coreWorkflows
        : [
            "Register company account",
            "Add customers and services",
            "Create bookings",
            "View calendar",
            "Update settings",
          ],
      pricing:
        plan?.revenueModel ||
        "Monthly subscription — demo pricing, not a live payment product.",
    },
    createdAt: new Date().toISOString(),
  };
}

function uniquePages(pages: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...REQUIRED_APP_PAGES, ...pages]) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function attachGeneratedAppArtifact(
  project: FactoryProject
): GeneratedAppArtifact {
  const code = asCode(project);
  if (!code?.files?.length) {
    throw Object.assign(new Error("BUILD produced no application files"), {
      stage: "artifact" as GeneratedAppErrorStage,
    });
  }
  const artifact = buildGeneratedAppArtifact(project);
  project.sandbox.generatedArtifact = artifact;
  project.sandbox.previewUrl = artifact.entrypoint;
  project.sandbox.runtimeError = null;
  const existing = project.outputs.find(
    (o) => o.schemaName === "GeneratedAppArtifactSchema"
  );
  if (existing) {
    existing.data = artifact as unknown as Record<string, unknown>;
    existing.implementationStatus = "automatically_implemented";
  } else {
    addOutput(project, {
      projectId: project.id,
      agent: "DeploymentAgent",
      schemaName: "GeneratedAppArtifactSchema",
      data: artifact as unknown as Record<string, unknown>,
      labeledAssumptions: [
        "Generated app HTML runtime — starter MVP, not production isolation",
      ],
      source: "heuristic",
      implementationStatus: "automatically_implemented",
    });
  }
  return artifact;
}

export function resolveGeneratedAppPage(
  pathSegments: string[] | undefined
): GeneratedAppPage {
  const raw = (pathSegments?.[0] || "landing").toLowerCase();
  const map: Record<string, GeneratedAppPage> = {
    "": "Landing",
    landing: "Landing",
    index: "Landing",
    "index.html": "Landing",
    register: "Register",
    signup: "Register",
    login: "Login",
    signin: "Login",
    dashboard: "Dashboard",
    customers: "Customers",
    services: "Services",
    bookings: "Bookings",
    calendar: "Calendar",
    settings: "Settings",
  };
  return map[raw] || "Landing";
}

export function isValidGeneratedAppHtml(html: string): boolean {
  if (!html || html.length < 200) return false;
  if (!html.includes("<html")) return false;
  if (!html.includes(GENERATED_APP_MARKER)) return false;
  if (!html.includes(GENERATED_APP_OK)) return false;
  const required = [
    "Landing",
    "Register",
    "Login",
    "Dashboard",
    "Customers",
    "Services",
    "Bookings",
    "Calendar",
    "Settings",
  ];
  return required.every((page) => html.includes(page));
}

export function hasApplicationEntrypoint(
  artifact: GeneratedAppArtifact | null
): boolean {
  if (!artifact) return false;
  if (!artifact.entrypoint?.startsWith("/preview/")) return false;
  if (!artifact.buildId) return false;
  if (!artifact.projectId) return false;
  return REQUIRED_APP_PAGES.every((page) =>
    artifact.pages.some((p) => p.toLowerCase() === page.toLowerCase())
  );
}

export function renderGeneratedAppHtml(
  project: FactoryProject,
  pathSegments: string[] = []
): { html: string; artifact: GeneratedAppArtifact } {
  const artifact =
    getGeneratedAppArtifact(project) || buildGeneratedAppArtifact(project);
  if (!hasApplicationEntrypoint(artifact)) {
    throw Object.assign(new Error("Generated app entrypoint missing"), {
      stage: "entrypoint" as GeneratedAppErrorStage,
    });
  }
  const page = resolveGeneratedAppPage(pathSegments);
  const html = documentFor(artifact, page);
  if (!isValidGeneratedAppHtml(html)) {
    throw Object.assign(new Error("Generated app HTML render failed"), {
      stage: "html_render" as GeneratedAppErrorStage,
    });
  }
  return { html, artifact };
}

export function renderGeneratedAppErrorHtml(error: GeneratedAppRuntimeError): string {
  const projectId = escapeHtml(error.projectId);
  const buildId = escapeHtml(error.buildId || "none");
  const stage = escapeHtml(error.stage);
  const message = escapeHtml(error.message);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GENERATED APP ERROR</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:#0b0b10; color:#f8fafc; }
    main { max-width: 32rem; margin: 12vh auto; padding: 24px; }
    h1 { color:#fb7185; font-size: 1.5rem; }
    dl { display:grid; grid-template-columns: 8rem 1fr; gap: 8px 12px; color:#cbd5e1; }
    dt { color:#94a3b8; }
    button, a.btn { display:inline-block; margin-top: 20px; background:#7c3aed; color:white; border:0; border-radius:10px; padding:10px 16px; text-decoration:none; font-weight:600; cursor:pointer; }
  </style>
</head>
<body>
  <main>
    <h1>GENERATED APP ERROR</h1>
    <dl>
      <dt>projectId</dt><dd>${projectId}</dd>
      <dt>buildId</dt><dd>${buildId}</dd>
      <dt>error stage</dt><dd>${stage}</dd>
      <dt>message</dt><dd>${message}</dd>
    </dl>
    <button type="button" onclick="location.reload()">Retry</button>
  </main>
</body>
</html>`;
}

export function renderProjectNotFoundHtml(projectId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PROJECT NOT FOUND</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:#0b0b10; color:#f8fafc; }
    main { max-width: 32rem; margin: 18vh auto; padding: 24px; text-align:center; }
    h1 { color:#fb7185; }
    p { color:#94a3b8; }
  </style>
</head>
<body>
  <main>
    <h1>PROJECT NOT FOUND</h1>
    <p>No generated application exists for <code>${escapeHtml(projectId)}</code>.</p>
  </main>
</body>
</html>`;
}

function documentFor(
  artifact: GeneratedAppArtifact,
  page: GeneratedAppPage
): string {
  const app = artifact.app;
  const name = escapeHtml(app.name);
  const pageTitle = escapeHtml(page);
  const nav = REQUIRED_APP_PAGES.map((p) => {
    const href = generatedAppPreviewPath(artifact.projectId, pageSlug(p));
    const active = p === page ? " class=\"active\"" : "";
    return `<a href="${href}"${active}>${escapeHtml(p)}</a>`;
  }).join("");
  const inner = pageBody(artifact, page);

  return `<!doctype html>
<html lang="en" ${GENERATED_APP_MARKER}="true" data-project-id="${escapeHtml(
    artifact.projectId
  )}" data-build-id="${escapeHtml(artifact.buildId)}" data-entrypoint="${escapeHtml(
    artifact.entrypoint
  )}" data-page="${pageTitle}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${pageTitle} · ${name}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:#08111f; color:#eef4ff; }
    a { color:#a5b4fc; text-decoration:none; }
    header.appbar { position:sticky; top:0; z-index:10; display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; padding:12px 16px; background:#0b1728; border-bottom:1px solid #1e293b; }
    .brand { font-weight:700; color:#c4b5fd; }
    nav { display:flex; flex-wrap:wrap; gap:8px; }
    nav a { padding:6px 10px; border-radius:999px; color:#cbd5e1; font-size:13px; }
    nav a.active { background:#4c1d95; color:white; }
    main { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
    h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); margin: 0 0 8px; }
    .lede { color:#94a3b8; max-width: 42rem; }
    .grid { display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 20px; }
    .card { background:#0f1c2e; border:1px solid #1e293b; border-radius:16px; padding:16px; }
    .card h3 { margin:0 0 6px; font-size:1rem; }
    .muted { color:#94a3b8; font-size:14px; }
    table { width:100%; border-collapse: collapse; margin-top: 12px; font-size:14px; }
    th, td { text-align:left; padding:10px 8px; border-bottom:1px solid #1e293b; }
    .btn { display:inline-block; background:#7c3aed; color:white; border-radius:12px; padding:10px 16px; font-weight:600; border:0; cursor:pointer; }
    .btn.secondary { background:#1e293b; }
    form { display:grid; gap:10px; max-width: 22rem; margin-top: 16px; }
    input, select { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #334155; background:#0b1728; color:white; }
    .ok { position:absolute; left:-9999px; }
    footer { margin-top: 40px; color:#64748b; font-size:12px; }
    @media (max-width: 640px) {
      header.appbar { padding:10px 12px; }
      nav a { font-size:12px; padding:5px 8px; }
    }
  </style>
</head>
<body>
  <span class="ok">${GENERATED_APP_OK}</span>
  <header class="appbar">
    <a class="brand" href="${artifact.entrypoint}">${name}</a>
    <nav>${nav}</nav>
  </header>
  <main>
    ${inner}
    <footer>
      ${name} · generated application · build ${escapeHtml(artifact.buildId)} ·
      ${escapeHtml(artifact.version)} · demo data only ·
      <a href="/build/${escapeHtml(artifact.projectId)}">Factory project</a>
    </footer>
  </main>
</body>
</html>`;
}

function pageBody(artifact: GeneratedAppArtifact, page: GeneratedAppPage): string {
  const app = artifact.app;
  const name = escapeHtml(app.name);
  switch (page) {
    case "Landing":
      return `
        <p class="muted">Landing</p>
        <h1>${name}</h1>
        <p class="lede">${escapeHtml(app.summary)}</p>
        <p class="lede" style="margin-top:12px">${escapeHtml(app.solution)}</p>
        <p style="margin-top:20px">
          <a class="btn" href="${generatedAppPreviewPath(artifact.projectId, "register")}">Register</a>
          <a class="btn secondary" href="${generatedAppPreviewPath(artifact.projectId, "login")}">Login</a>
        </p>
        <div class="grid">
          ${REQUIRED_APP_PAGES.map(
            (p) =>
              `<article class="card"><h3>${escapeHtml(p)}</h3><p class="muted">Open the ${escapeHtml(p)} screen of this generated booking workspace.</p></article>`
          ).join("")}
        </div>`;
    case "Register":
      return `
        <p class="muted">Register</p>
        <h1>Create your company account</h1>
        <p class="lede">Demo registration for ${name}. No production database is connected.</p>
        <form onsubmit="event.preventDefault(); location.href='${generatedAppPreviewPath(artifact.projectId, "dashboard")}';">
          <input required type="text" placeholder="Company name" />
          <input required type="email" placeholder="Work email" />
          <input required type="password" minlength="8" placeholder="Password" />
          <button class="btn" type="submit">Create account</button>
        </form>`;
    case "Login":
      return `
        <p class="muted">Login</p>
        <h1>Sign in</h1>
        <p class="lede">Demo login for ${name}.</p>
        <form onsubmit="event.preventDefault(); location.href='${generatedAppPreviewPath(artifact.projectId, "dashboard")}';">
          <input required type="email" placeholder="Email" />
          <input required type="password" minlength="8" placeholder="Password" />
          <button class="btn" type="submit">Login</button>
        </form>
        <p class="muted" style="margin-top:12px">No account? <a href="${generatedAppPreviewPath(artifact.projectId, "register")}">Register</a></p>`;
    case "Dashboard":
      return `
        <p class="muted">Dashboard</p>
        <h1>${name} dashboard</h1>
        <p class="lede">Today’s overview for ${escapeHtml(app.targetCustomer)} in ${escapeHtml(app.country)}.</p>
        <div class="grid">
          <article class="card"><h3>12</h3><p class="muted">Customers</p></article>
          <article class="card"><h3>5</h3><p class="muted">Services</p></article>
          <article class="card"><h3>8</h3><p class="muted">Bookings this week</p></article>
          <article class="card"><h3>€1.240</h3><p class="muted">Demo revenue</p></article>
        </div>
        <div class="card" style="margin-top:16px">
          <h3>Workflows</h3>
          <ul>${app.workflows.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
        </div>`;
    case "Customers":
      return `
        <p class="muted">Customers</p>
        <h1>Customers</h1>
        <p class="lede">Customer records for cleaning companies using ${name}.</p>
        <table>
          <thead><tr><th>Name</th><th>City</th><th>Phone</th></tr></thead>
          <tbody>
            <tr><td>De Glimmer BV</td><td>Amsterdam</td><td>+31 20 555 0101</td></tr>
            <tr><td>Schoonhuis Utrecht</td><td>Utrecht</td><td>+31 30 555 0188</td></tr>
            <tr><td>NordClean</td><td>Groningen</td><td>+31 50 555 0144</td></tr>
          </tbody>
        </table>`;
    case "Services":
      return `
        <p class="muted">Services</p>
        <h1>Services</h1>
        <p class="lede">Catalog of cleaning services sold through ${name}.</p>
        <div class="grid">
          <article class="card"><h3>Home cleaning</h3><p class="muted">€45 / hour · 2 specialists</p></article>
          <article class="card"><h3>Office cleaning</h3><p class="muted">€59 / hour · after hours</p></article>
          <article class="card"><h3>Move-out clean</h3><p class="muted">€189 flat · same week</p></article>
        </div>`;
    case "Bookings":
      return `
        <p class="muted">Bookings</p>
        <h1>Bookings</h1>
        <p class="lede">Upcoming jobs linked to customers and services.</p>
        <table>
          <thead><tr><th>When</th><th>Customer</th><th>Service</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Thu 09:00</td><td>De Glimmer BV</td><td>Office cleaning</td><td>Confirmed</td></tr>
            <tr><td>Thu 13:30</td><td>Schoonhuis Utrecht</td><td>Home cleaning</td><td>Confirmed</td></tr>
            <tr><td>Fri 10:00</td><td>NordClean</td><td>Move-out clean</td><td>Pending</td></tr>
          </tbody>
        </table>`;
    case "Calendar":
      return `
        <p class="muted">Calendar</p>
        <h1>Calendar</h1>
        <p class="lede">Week view of scheduled bookings.</p>
        <div class="grid">
          <article class="card"><h3>Mon</h3><p class="muted">2 bookings</p></article>
          <article class="card"><h3>Tue</h3><p class="muted">1 booking</p></article>
          <article class="card"><h3>Wed</h3><p class="muted">3 bookings</p></article>
          <article class="card"><h3>Thu</h3><p class="muted">2 bookings</p></article>
          <article class="card"><h3>Fri</h3><p class="muted">1 booking</p></article>
        </div>`;
    case "Settings":
      return `
        <p class="muted">Settings</p>
        <h1>Settings</h1>
        <p class="lede">Company profile for ${name}.</p>
        <div class="card">
          <p><strong>Business</strong> ${name}</p>
          <p class="muted">${escapeHtml(app.targetCustomer)} · ${escapeHtml(app.country)}</p>
          <p class="muted">${escapeHtml(app.pricing)}</p>
          <p class="muted">Problem: ${escapeHtml(app.problem)}</p>
        </div>`;
  }
}

export function platformPreviewUrl(projectId: string, pageSlugValue = ""): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.JIY_APP_URL?.trim() ||
    "https://jiy.app";
  const base = raw.replace(/\/$/, "");
  return `${base}${generatedAppPreviewPath(projectId, pageSlugValue)}`;
}

export async function verifyGeneratedAppHttp(
  projectId: string
): Promise<{
  ok: boolean;
  status: number;
  contentType: string;
  html: string;
  detail: string;
}> {
  const url = platformPreviewUrl(projectId);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/html" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
    });
    const contentType = res.headers.get("content-type") || "";
    const html = await res.text();
    const ok =
      res.status === 200 &&
      /text\/html/i.test(contentType || "text/html") &&
      isValidGeneratedAppHtml(html);
    return {
      ok,
      status: res.status,
      contentType,
      html,
      detail: ok
        ? `HTTP ${res.status} ${url} HTML entrypoint ok`
        : `HTTP ${res.status} ${url} type=${contentType} validHtml=${isValidGeneratedAppHtml(html)}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      html: "",
      detail: `HTTP failed: ${error instanceof Error ? error.message : "error"}`,
    };
  }
}

export function allowInProcessLiveVerify(): boolean {
  return process.env.JIY_PREVIEW_VERIFY === "inprocess";
}
