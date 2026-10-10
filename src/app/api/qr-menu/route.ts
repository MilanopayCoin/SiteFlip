import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { jsonError, jsonOk } from "@/lib/api/request-user";
import { createMenuSchema, editorMenuView } from "@/lib/qr-menu/types";
import { createQrMenu } from "@/lib/qr-menu/store";

export const runtime = "nodejs";

/** Create a free QR menu (no auth). Returns editToken once — store it. */
export async function POST(request: Request) {
  await ensureCloudflareEnv();

  const parsed = createMenuSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }

  try {
    const menu = await createQrMenu(parsed.data);
    return jsonOk(
      {
        menu: editorMenuView(menu),
        publicPath: `/m/${menu.slug}`,
        editPath: `/qr-menu/edit/${menu.id}`,
        notice:
          "Free forever. Save your edit link — anyone with the token can edit.",
      },
      201
    );
  } catch (err) {
    console.error("qr-menu create failed", err);
    const detail = err instanceof Error ? err.message : "unknown";
    return jsonError("Failed to create menu", 500, {
      detail: detail.slice(0, 240),
    });
  }
}

export async function GET() {
  await ensureCloudflareEnv();
  return jsonOk({
    product: "JIY Menu",
    price: 0,
    freeForever: true,
    authRequired: false,
    endpoints: {
      create: "POST /api/qr-menu",
      update: "PATCH /api/qr-menu/[id]",
      public: "GET /api/qr-menu/by-slug/[slug]",
      qr: "GET /api/qr-menu/[id]/qr",
    },
  });
}
