import type { FactoryProject } from "../types";
import type { PlanSpec } from "../schemas";
import { getOutputByAgent } from "../store";
import type { GeneratedRuntimeArtifact, MvpPageId } from "./types";
import {
  GENERATED_APP_ERROR_MARKER,
  GENERATED_APP_MARKER,
} from "./types";
import { generatedPathFor } from "./artifact";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAV: Array<{ id: MvpPageId; label: string }> = [
  { id: "landing", label: "Home" },
  { id: "dashboard", label: "Dashboard" },
  { id: "customers", label: "Customers" },
  { id: "services", label: "Services" },
  { id: "bookings", label: "Bookings" },
  { id: "calendar", label: "Calendar" },
  { id: "settings", label: "Settings" },
];

function demoCustomers() {
  return [
    { name: "Anne de Vries", city: "Amsterdam", jobs: 12 },
    { name: "Pieter Bakker", city: "Rotterdam", jobs: 8 },
    { name: "Sofie Jansen", city: "Utrecht", jobs: 5 },
  ];
}

function demoServices() {
  return [
    { name: "Home deep clean", price: "€89", duration: "3h" },
    { name: "Office weekly", price: "€149", duration: "4h" },
    { name: "Move-out clean", price: "€219", duration: "5h" },
  ];
}

function demoBookings() {
  return [
    { when: "Tue 10:00", customer: "Anne de Vries", service: "Home deep clean", status: "Confirmed" },
    { when: "Wed 14:00", customer: "Pieter Bakker", service: "Office weekly", status: "Pending" },
    { when: "Fri 09:30", customer: "Sofie Jansen", service: "Move-out clean", status: "Confirmed" },
  ];
}

function shell(opts: {
  title: string;
  projectId: string;
  buildId: string;
  artifactId: string;
  page: MvpPageId;
  body: string;
  liveLabel: string;
}): string {
  const { title, projectId, buildId, artifactId, page, body, liveLabel } = opts;
  const nav = NAV.map((item) => {
    const href = generatedPathFor(projectId, item.id);
    const cls = item.id === page ? "nav-link active" : "nav-link";
    return `<a class="${cls}" href="${esc(href)}">${esc(item.label)}</a>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <meta name="robots" content="noindex"/>
  <title>${esc(title)}</title>
  <style>
    :root { --bg:#0b1220; --panel:#121a2b; --line:#243049; --text:#e8eefc; --muted:#94a3b8; --accent:#2dd4bf; --accent2:#38bdf8; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: radial-gradient(1200px 600px at 10% -10%, #164e63 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #1e3a5f 0%, transparent 50%), var(--bg); color: var(--text); min-height: 100vh; }
    a { color: inherit; text-decoration: none; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 16px 16px 48px; }
    .top { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; margin-bottom: 18px; }
    .brand { font-weight: 700; letter-spacing: .02em; font-size: 1.1rem; }
    .brand span { color: var(--accent); }
    .badge { font-size: 11px; color: #a5f3fc; border: 1px solid #155e75; background: #083344; padding: 4px 8px; border-radius: 999px; }
    .nav { display:flex; flex-wrap:wrap; gap:8px; margin: 12px 0 20px; }
    .nav-link { font-size: 13px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line); background: rgba(18,26,43,.8); color: #cbd5e1; }
    .nav-link.active, .nav-link:hover { border-color: #2dd4bf66; color: #ecfeff; background: #134e4a; }
    .card { background: linear-gradient(180deg, rgba(18,26,43,.95), rgba(15,23,42,.92)); border: 1px solid var(--line); border-radius: 16px; padding: 18px; margin-bottom: 14px; }
    h1 { font-size: 1.6rem; margin: 0 0 8px; }
    h2 { font-size: 1.1rem; margin: 0 0 10px; }
    p { color: #cbd5e1; line-height: 1.5; }
    .muted { color: #94a3b8; font-size: 13px; }
    .grid { display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .stat { padding:14px; border-radius:12px; background:#0f172a; border:1px solid var(--line); }
    .stat strong { display:block; font-size:1.35rem; margin-top:4px; }
    table { width:100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align:left; padding: 10px 8px; border-bottom: 1px solid var(--line); }
    th { color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 14px; border-radius:12px; border:0; background: linear-gradient(135deg, #2dd4bf, #38bdf8); color:#042f2e; font-weight:700; cursor:pointer; }
    .btn.secondary { background: transparent; border:1px solid var(--line); color:#e2e8f0; font-weight:600; }
    .row { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    input, select { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:#0f172a; color:#e2e8f0; margin-top:6px; }
    label { display:block; font-size:13px; color:#94a3b8; margin-top:10px; }
    .cal { display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; }
    .cal div { aspect-ratio:1; border:1px solid var(--line); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:12px; background:#0f172a; }
    .cal .hit { background:#134e4a; border-color:#2dd4bf66; color:#ccfbf1; font-weight:700; }
    .foot { margin-top: 28px; font-size: 11px; color: #64748b; word-break: break-all; }
  </style>
</head>
<body ${GENERATED_APP_MARKER} data-project-id="${esc(projectId)}" data-build-id="${esc(buildId)}" data-artifact-id="${esc(artifactId)}" data-page="${esc(page)}">
  <div class="wrap">
    <div class="top">
      <div class="brand">${esc(title.split("—")[0]?.trim() || title)} <span>· NL</span></div>
      <div class="badge">${esc(liveLabel)}</div>
    </div>
    <nav class="nav" aria-label="App">
      ${nav}
      <a class="nav-link" href="${esc(generatedPathFor(projectId, "login"))}">Login</a>
      <a class="nav-link" href="${esc(generatedPathFor(projectId, "register"))}">Register</a>
    </nav>
    ${body}
    <div class="foot">
      JIY.APP generated runtime · project ${esc(projectId)} · build ${esc(buildId)} · artifact ${esc(artifactId)} · page ${esc(page)}
      · DEMO data · not production isolation
    </div>
  </div>
</body>
</html>`;
}

function pageBody(
  page: MvpPageId,
  project: FactoryProject,
  artifact: GeneratedRuntimeArtifact
): string {
  const plan = getOutputByAgent(project, "PlannerAgent")?.data as
    | PlanSpec
    | undefined;
  const name = artifact.appName;
  const summary =
    plan?.summary ||
    project.brief?.idea ||
    "Booking SaaS for cleaning companies in the Netherlands.";
  const pid = project.id;

  switch (page) {
    case "landing":
      return `<section class="card">
        <h1>${esc(name)}</h1>
        <p>${esc(summary)}</p>
        <p class="muted">Deterministic MVP runtime for Dutch cleaning bookings — Landing → Register/Login → Dashboard → Customers → Services → Bookings → Calendar → Settings.</p>
        <div class="row">
          <a class="btn" href="${esc(generatedPathFor(pid, "register"))}">Start free</a>
          <a class="btn secondary" href="${esc(generatedPathFor(pid, "dashboard"))}">Open dashboard</a>
        </div>
      </section>
      <section class="grid">
        <div class="stat"><div class="muted">Cities</div><strong>NL-wide</strong></div>
        <div class="stat"><div class="muted">Services</div><strong>3</strong></div>
        <div class="stat"><div class="muted">Bookings</div><strong>3</strong></div>
      </section>`;
    case "register":
      return `<section class="card">
        <h1>Register</h1>
        <p class="muted">Demo form — no password stored. Continues to dashboard.</p>
        <label>Company name<input value="${esc(name)}" readonly/></label>
        <label>Email<input type="email" value="owner@example.nl" readonly/></label>
        <label>Password<input type="password" value="••••••••" readonly/></label>
        <div class="row"><a class="btn" href="${esc(generatedPathFor(pid, "dashboard"))}">Create account</a></div>
      </section>`;
    case "login":
      return `<section class="card">
        <h1>Login</h1>
        <p class="muted">Demo login — opens the generated dashboard.</p>
        <label>Email<input type="email" value="owner@example.nl" readonly/></label>
        <label>Password<input type="password" value="••••••••" readonly/></label>
        <div class="row"><a class="btn" href="${esc(generatedPathFor(pid, "dashboard"))}">Sign in</a></div>
      </section>`;
    case "dashboard":
      return `<section class="card"><h1>Dashboard</h1><p class="muted">Today’s overview for ${esc(name)}</p></section>
      <section class="grid">
        <div class="stat"><div class="muted">Open bookings</div><strong>3</strong></div>
        <div class="stat"><div class="muted">Customers</div><strong>3</strong></div>
        <div class="stat"><div class="muted">Revenue (demo)</div><strong>€457</strong></div>
      </section>
      <section class="card"><h2>Next jobs</h2>
        <table><thead><tr><th>When</th><th>Customer</th><th>Service</th><th>Status</th></tr></thead>
        <tbody>${demoBookings().map((b) => `<tr><td>${esc(b.when)}</td><td>${esc(b.customer)}</td><td>${esc(b.service)}</td><td>${esc(b.status)}</td></tr>`).join("")}</tbody></table>
      </section>`;
    case "customers":
      return `<section class="card"><h1>Customers</h1>
        <table><thead><tr><th>Name</th><th>City</th><th>Jobs</th></tr></thead>
        <tbody>${demoCustomers().map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.city)}</td><td>${c.jobs}</td></tr>`).join("")}</tbody></table>
      </section>`;
    case "services":
      return `<section class="card"><h1>Services</h1>
        <table><thead><tr><th>Service</th><th>Price</th><th>Duration</th></tr></thead>
        <tbody>${demoServices().map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.price)}</td><td>${esc(s.duration)}</td></tr>`).join("")}</tbody></table>
      </section>`;
    case "bookings":
      return `<section class="card"><h1>Bookings</h1>
        <table><thead><tr><th>When</th><th>Customer</th><th>Service</th><th>Status</th></tr></thead>
        <tbody>${demoBookings().map((b) => `<tr><td>${esc(b.when)}</td><td>${esc(b.customer)}</td><td>${esc(b.service)}</td><td>${esc(b.status)}</td></tr>`).join("")}</tbody></table>
        <div class="row"><a class="btn secondary" href="${esc(generatedPathFor(pid, "calendar"))}">View calendar</a></div>
      </section>`;
    case "calendar":
      return `<section class="card"><h1>Calendar</h1><p class="muted">Week view (demo)</p>
        <div class="cal">${Array.from({ length: 28 }, (_, i) => {
          const day = i + 1;
          const hit = [2, 3, 5].includes(day);
          return `<div class="${hit ? "hit" : ""}">${day}</div>`;
        }).join("")}</div>
      </section>`;
    case "settings":
      return `<section class="card"><h1>Settings</h1>
        <label>Business name<input value="${esc(name)}" readonly/></label>
        <label>Country<input value="Netherlands" readonly/></label>
        <label>Timezone<input value="Europe/Amsterdam" readonly/></label>
        <label>Currency<input value="EUR" readonly/></label>
        <p class="muted" style="margin-top:14px">Demo settings only — Mollie payments not activated in generated apps.</p>
      </section>`;
    default:
      return `<section class="card"><h1>${esc(page)}</h1><p>Page ready.</p></section>`;
  }
}

export function renderGeneratedAppHtml(input: {
  project: FactoryProject;
  artifact: GeneratedRuntimeArtifact;
  page: MvpPageId;
}): string {
  const { project, artifact, page } = input;
  const liveLabel =
    project.state === "LIVE"
      ? "GENERATED APP LIVE"
      : project.state === "APPROVAL_REQUIRED"
        ? "PREVIEW · AWAITING APPROVAL"
        : "SANDBOX PREVIEW";
  return shell({
    title: `${artifact.appName} — ${page}`,
    projectId: project.id,
    buildId: artifact.buildId,
    artifactId: artifact.artifactId,
    page,
    body: pageBody(page, project, artifact),
    liveLabel,
  });
}

export function renderGeneratedAppErrorHtml(input: {
  projectId: string;
  buildId?: string | null;
  artifactId?: string | null;
  runtimeStage: string;
  error: string;
  retryHref: string;
}): string {
  const { projectId, buildId, artifactId, runtimeStage, error, retryHref } =
    input;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>GENERATED APP ERROR</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#140b0b;color:#fecaca;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .box{max-width:520px;width:100%;border:1px solid #7f1d1d;background:#1c1010;border-radius:16px;padding:20px}
    h1{margin:0 0 8px;font-size:1.25rem;color:#fee2e2}
    p,li{color:#fca5a5;font-size:14px;line-height:1.45}
    code{word-break:break-all;font-size:12px;color:#fecaca}
    a{display:inline-block;margin-top:14px;padding:10px 14px;border-radius:10px;background:#b91c1c;color:#fff;text-decoration:none;font-weight:700}
  </style>
</head>
<body ${GENERATED_APP_ERROR_MARKER}>
  <div class="box">
    <h1>GENERATED APP ERROR</h1>
    <p>The generated application runtime could not render.</p>
    <ul>
      <li>projectId: <code>${esc(projectId)}</code></li>
      <li>buildId: <code>${esc(buildId || "—")}</code></li>
      <li>artifactId: <code>${esc(artifactId || "—")}</code></li>
      <li>runtime stage: <code>${esc(runtimeStage)}</code></li>
      <li>error: <code>${esc(error)}</code></li>
    </ul>
    <a href="${esc(retryHref)}">Retry</a>
  </div>
</body>
</html>`;
}
