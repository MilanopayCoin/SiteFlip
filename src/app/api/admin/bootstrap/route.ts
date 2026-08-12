import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureCloudflareEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";

/**
 * Server-only bootstrap helpers using the service role.
 * Never exposes the service role key. Does not run DDL.
 *
 * POST { action: "create_user", email, password, full_name }
 * POST { action: "ping" }
 *
 * Protected by BOOTSTRAP_TOKEN env when set; otherwise disabled in production
 * unless SITEFLIP_ALLOW_BOOTSTRAP=1.
 */
export async function POST(request: Request) {
  await ensureCloudflareEnv();

  const allow =
    process.env.SITEFLIP_ALLOW_BOOTSTRAP === "1" ||
    Boolean(process.env.BOOTSTRAP_TOKEN);
  if (!allow) {
    return NextResponse.json(
      { error: "Bootstrap disabled. Set SITEFLIP_ALLOW_BOOTSTRAP=1 to enable." },
      { status: 403 }
    );
  }

  if (process.env.BOOTSTRAP_TOKEN) {
    const header = request.headers.get("x-bootstrap-token");
    if (header !== process.env.BOOTSTRAP_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const service = await createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "Service role unavailable" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "ping");

  if (action === "ping") {
    const { error } = await service.from("profiles").select("id").limit(0);
    const schemaReady = !(
      error?.code === "PGRST205" ||
      error?.message?.toLowerCase().includes("could not find the table")
    );
    return NextResponse.json({
      ok: true,
      schemaReady,
      serviceRole: true,
    });
  }

  if (action === "create_user") {
    const email = String(body.email || "");
    const password = String(body.password || "");
    const fullName = String(body.full_name || "SITEFLIP User");
    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password required" },
        { status: 400 }
      );
    }

    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, display_name: fullName },
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      userId: data.user?.id ?? null,
      // never return password
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
