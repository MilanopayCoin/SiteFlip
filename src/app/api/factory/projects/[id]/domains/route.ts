import { NextResponse } from "next/server";
import {
  getFactoryProject,
  saveFactoryProject,
} from "@/lib/factory/store";
import {
  addDomain,
  listDomains,
  verifyDomainDns,
  connectDomain,
  removeDomain,
} from "@/lib/factory/deployment";
import type { FactoryProject } from "@/lib/factory/types";
import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { resolveFactoryProject } from "@/lib/factory/supabase-store";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { resolveRequestUser } from "@/lib/api/request-user";
import { getSchemaStatus } from "@/lib/supabase/schema-ready";

type Ctx = { params: Promise<{ id: string }> };

async function loadProject(
  id: string,
  incoming?: FactoryProject,
  userId?: string | null
) {
  let project = await resolveFactoryProject(id);
  if (
    !project &&
    incoming &&
    incoming.id === id &&
    (!userId || incoming.ownerId === userId)
  ) {
    project = saveFactoryProject(incoming);
  }
  return project ?? getFactoryProject(id) ?? null;
}

export async function GET(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  if (status.productionPersistence && !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const project = await loadProject(id, undefined, user?.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user && project.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    primaryPlatform: BRAND.url,
    futureSubdomain: `https://${project.slug}.${BRAND.domain}`,
    domains: listDomains(id),
    notes: [
      "DNS is never modified automatically",
      "Domain status stays UNVERIFIED until real DNS verification succeeds",
      `Primary platform: ${BRAND.url}`,
    ],
  });
}

const bodySchema = z.object({
  action: z.enum(["add", "verify", "connect", "remove"]),
  domain: z.string().min(3),
  project: z.any().optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  await ensureCloudflareEnv();
  const { id } = await ctx.params;
  const status = await getSchemaStatus();
  const user = await resolveRequestUser(request);
  if (status.productionPersistence && !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const raw = await request.json().catch(() => ({}));
  const incoming = (raw as { project?: FactoryProject })?.project;
  const project = await loadProject(id, incoming, user?.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user && project.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "add") {
      const domain = addDomain(id, parsed.data.domain, project.slug);
      return NextResponse.json({ domain, domains: listDomains(id) });
    }
    if (parsed.data.action === "verify") {
      const domain = await verifyDomainDns(id, parsed.data.domain);
      return NextResponse.json({ domain, domains: listDomains(id) });
    }
    if (parsed.data.action === "connect") {
      const domain = connectDomain(id, parsed.data.domain);
      return NextResponse.json({ domain, domains: listDomains(id) });
    }
    if (parsed.data.action === "remove") {
      removeDomain(id, parsed.data.domain);
      return NextResponse.json({ domains: listDomains(id) });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Domain action failed" },
      { status: 400 }
    );
  }
}
