import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { memoryStore } from "@/lib/data/memory-store";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";
import { slugify } from "@/lib/utils";
import type { BusinessLifecycle } from "@/types/database";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(5000).optional(),
  website_url: z.string().url().optional().or(z.literal("")),
  category: z.string().min(1),
  business_model: z.string().optional(),
  monthly_revenue: z.coerce.number().min(0).optional(),
  monthly_profit: z.coerce.number().optional(),
  monthly_traffic: z.coerce.number().min(0).optional(),
  country: z.string().optional(),
  technology: z.string().optional(),
  lifecycle: z
    .enum([
      "IDEA",
      "BUILDING",
      "LIVE",
      "GROWING",
      "FOR_SALE",
      "FOR_RENT",
      "RENTED",
      "ACQUIRED",
      "REVIVING",
      "REVIVED",
      "SOLD",
      "ARCHIVED",
    ])
    .optional(),
  asking_price: z.coerce.number().min(0).optional(),
  tagline: z.string().optional(),
  publish: z.boolean().optional(),
});

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("businesses")
      .select("*")
      .eq("current_owner_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) return jsonError("Failed to load businesses", 500);
    return jsonOk({ businesses: data, mode: "supabase" });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  return jsonOk({
    businesses: memoryStore.listBusinessesForOwner(user.id),
    mode: "demo",
    notice: "DEMO mode — connect Supabase for production persistence",
  });
}

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError("Validation failed", 400, {
      details: parsed.error.flatten(),
    });
  }
  const input = parsed.data;
  const lifecycle = (input.lifecycle ??
    (input.publish ? "LIVE" : "IDEA")) as BusinessLifecycle;
  const tech = input.technology
    ? input.technology.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const slug = `${slugify(input.name)}-${Date.now().toString(36)}`;
    const { data: business, error } = await supabase!
      .from("businesses")
      .insert({
        name: input.name,
        slug,
        description: input.description ?? null,
        website_url: input.website_url || null,
        category: input.category,
        tagline: input.tagline ?? input.business_model ?? null,
        monthly_revenue: input.monthly_revenue ?? null,
        monthly_profit: input.monthly_profit ?? null,
        monthly_traffic: input.monthly_traffic ?? null,
        technology_stack: tech,
        lifecycle,
        asking_price: input.asking_price ?? null,
        current_owner_id: user.id,
        is_demo: false,
      })
      .select("*")
      .single();
    if (error) return jsonError(error.message, 500);

    await supabase!.from("business_owners").insert({
      business_id: business.id,
      user_id: user.id,
      ownership_percentage: 100,
      is_current: true,
    });
    await supabase!.from("business_events").insert({
      business_id: business.id,
      event_type: "created",
      title: "Business created",
      description: "Created via JIY.APP dashboard",
      created_by: user.id,
    });

    return jsonOk({ business, mode: "supabase" }, 201);
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  const business = memoryStore.createBusiness({
    name: input.name,
    description: input.description ?? null,
    website_url: input.website_url || null,
    category: input.category as never,
    tagline: input.tagline ?? input.business_model ?? null,
    monthly_revenue: input.monthly_revenue ?? null,
    monthly_profit: input.monthly_profit ?? null,
    monthly_traffic: input.monthly_traffic ?? null,
    technology_stack: tech,
    lifecycle,
    asking_price: input.asking_price ?? null,
    current_owner_id: user.id,
  });

  return jsonOk({
    business,
    mode: "demo",
    notice: "Saved in DEMO memory — connect Supabase to persist",
  }, 201);
}
