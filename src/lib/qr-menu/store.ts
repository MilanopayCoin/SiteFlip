import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { defaultCategoriesForMarket } from "@/lib/qr-menu/market-templates";
import { MENU_MARKETS, type MenuMarket } from "@/lib/places/markets";
import {
  defaultCategories,
  type MenuCategory,
  type QrMenu,
  type VenueMetadata,
} from "@/lib/qr-menu/types";
import { makeMenuSlug } from "@/lib/qr-menu/slug";

type Row = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: QrMenu["currency"];
  categories: MenuCategory[];
  venue: VenueMetadata | null;
  published: boolean;
  edit_token: string;
  created_at: string;
  updated_at: string;
};

const g = globalThis as unknown as {
  __jiyQrMenus?: Map<string, QrMenu>;
};

function mem(): Map<string, QrMenu> {
  if (!g.__jiyQrMenus) g.__jiyQrMenus = new Map();
  return g.__jiyQrMenus;
}

function now() {
  return new Date().toISOString();
}

function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t ? t : null;
}

function rowToMenu(row: Row): QrMenu {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    currency: row.currency || "EUR",
    categories: Array.isArray(row.categories) ? row.categories : [],
    venue: row.venue && typeof row.venue === "object" ? row.venue : null,
    published: Boolean(row.published),
    editToken: row.edit_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

export async function createQrMenu(input: {
  name: string;
  tagline?: string;
  currency?: QrMenu["currency"];
  market?: MenuMarket;
  venue?: VenueMetadata | null;
  categories?: MenuCategory[];
}): Promise<QrMenu> {
  const market = input.market ?? input.venue?.market ?? "nl";
  const marketCfg = MENU_MARKETS[market];
  const ts = now();
  const menu: QrMenu = {
    id: nanoid(16),
    slug: makeMenuSlug(input.name),
    name: input.name.trim(),
    tagline: emptyToNull(input.tagline),
    currency: input.currency || marketCfg.defaultCurrency,
    categories:
      input.categories ??
      defaultCategoriesForMarket(market) ??
      defaultCategories(),
    venue: input.venue ?? null,
    published: true,
    editToken: nanoid(32),
    createdAt: ts,
    updatedAt: ts,
  };

  const client = await db();
  if (client) {
    // Rare slug collision — retry once
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await client.from("qr_menus").insert({
        id: menu.id,
        slug: menu.slug,
        name: menu.name,
        tagline: menu.tagline,
        currency: menu.currency,
        categories: menu.categories,
        venue: menu.venue,
        published: menu.published,
        edit_token: menu.editToken,
        created_at: menu.createdAt,
        updated_at: menu.updatedAt,
      });
      if (!error) return menu;
      if (error.code === "23505") {
        menu.slug = makeMenuSlug(input.name);
        continue;
      }
      throw new Error(`qr_menus insert failed: ${error.message}`);
    }
    throw new Error("qr_menus slug collision");
  }

  mem().set(menu.id, menu);
  return menu;
}

export async function getMenuById(id: string): Promise<QrMenu | null> {
  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("qr_menus")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`qr_menus read failed: ${error.message}`);
    if (!data) return null;
    return rowToMenu(data as Row);
  }
  return mem().get(id) ?? null;
}

export async function getMenuBySlug(slug: string): Promise<QrMenu | null> {
  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("qr_menus")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`qr_menus read failed: ${error.message}`);
    if (!data) return null;
    return rowToMenu(data as Row);
  }
  for (const m of mem().values()) {
    if (m.slug === slug) return m;
  }
  return null;
}

export async function updateQrMenu(
  id: string,
  editToken: string,
  patch: {
    name?: string;
    tagline?: string | null;
    currency?: QrMenu["currency"];
    categories?: MenuCategory[];
    venue?: VenueMetadata | null;
    published?: boolean;
  }
): Promise<QrMenu | null> {
  const existing = await getMenuById(id);
  if (!existing) return null;
  if (existing.editToken !== editToken) {
    throw new Error("FORBIDDEN");
  }

  const updated: QrMenu = {
    ...existing,
    name: patch.name?.trim() || existing.name,
    tagline:
      patch.tagline !== undefined
        ? emptyToNull(patch.tagline)
        : existing.tagline,
    currency: patch.currency || existing.currency,
    categories: patch.categories ?? existing.categories,
    venue: patch.venue !== undefined ? patch.venue : existing.venue,
    published:
      patch.published !== undefined ? patch.published : existing.published,
    updatedAt: now(),
  };

  const client = await db();
  if (client) {
    const { error } = await client
      .from("qr_menus")
      .update({
        name: updated.name,
        tagline: updated.tagline,
        currency: updated.currency,
        categories: updated.categories,
        venue: updated.venue,
        published: updated.published,
        updated_at: updated.updatedAt,
      })
      .eq("id", id)
      .eq("edit_token", editToken);
    if (error) throw new Error(`qr_menus update failed: ${error.message}`);
    return updated;
  }

  mem().set(id, updated);
  return updated;
}

export function verifyEditToken(menu: QrMenu, token: string | null | undefined) {
  return Boolean(token && token === menu.editToken);
}
