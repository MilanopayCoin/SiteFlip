import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DEFAULT_ACCENT,
  defaultCategories,
  type MenuCategory,
  type MenuSpecial,
  type QrMenu,
  type WaiterCall,
} from "@/lib/qr-menu/types";
import { makeMenuSlug } from "@/lib/qr-menu/slug";

type Row = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: QrMenu["currency"];
  locale: "tr" | "en" | null;
  accent_color: string | null;
  logo_url: string | null;
  special: MenuSpecial | null;
  categories: MenuCategory[];
  published: boolean;
  edit_token: string;
  created_at: string;
  updated_at: string;
};

type CallRow = {
  id: string;
  menu_id: string;
  table_label: string;
  note: string | null;
  status: WaiterCall["status"];
  created_at: string;
};

const g = globalThis as unknown as {
  __jiyQrMenus?: Map<string, QrMenu>;
  __jiyQrCalls?: WaiterCall[];
};

function mem(): Map<string, QrMenu> {
  if (!g.__jiyQrMenus) g.__jiyQrMenus = new Map();
  return g.__jiyQrMenus;
}

function callMem(): WaiterCall[] {
  if (!g.__jiyQrCalls) g.__jiyQrCalls = [];
  return g.__jiyQrCalls;
}

function now() {
  return new Date().toISOString();
}

function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t ? t : null;
}

function normalizeSpecial(
  special: MenuSpecial | null | undefined
): MenuSpecial | null {
  if (!special || !special.title?.trim()) return null;
  return {
    title: special.title.trim(),
    description: emptyToNull(special.description) || undefined,
    price: special.price,
    until: emptyToNull(special.until) || undefined,
  };
}

function rowToMenu(row: Row): QrMenu {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    currency: row.currency || "TRY",
    locale: row.locale === "en" ? "en" : "tr",
    accentColor: row.accent_color || DEFAULT_ACCENT,
    logoUrl: row.logo_url,
    special: normalizeSpecial(row.special),
    categories: Array.isArray(row.categories) ? row.categories : [],
    published: Boolean(row.published),
    editToken: row.edit_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCall(row: CallRow): WaiterCall {
  return {
    id: row.id,
    menuId: row.menu_id,
    tableLabel: row.table_label,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
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
  locale?: "tr" | "en";
}): Promise<QrMenu> {
  const locale = input.locale || "tr";
  const ts = now();
  const menu: QrMenu = {
    id: nanoid(16),
    slug: makeMenuSlug(input.name),
    name: input.name.trim(),
    tagline: emptyToNull(input.tagline),
    currency: input.currency || "TRY",
    locale,
    accentColor: DEFAULT_ACCENT,
    logoUrl: null,
    special: null,
    categories: defaultCategories(locale),
    published: true,
    editToken: nanoid(32),
    createdAt: ts,
    updatedAt: ts,
  };

  const client = await db();
  if (client) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await client.from("qr_menus").insert({
        id: menu.id,
        slug: menu.slug,
        name: menu.name,
        tagline: menu.tagline,
        currency: menu.currency,
        locale: menu.locale,
        accent_color: menu.accentColor,
        logo_url: menu.logoUrl,
        special: menu.special,
        categories: menu.categories,
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
    locale?: "tr" | "en";
    accentColor?: string | null;
    logoUrl?: string | null;
    special?: MenuSpecial | null;
    categories?: MenuCategory[];
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
    locale: patch.locale || existing.locale,
    accentColor:
      patch.accentColor !== undefined && patch.accentColor
        ? patch.accentColor
        : existing.accentColor,
    logoUrl:
      patch.logoUrl !== undefined
        ? emptyToNull(patch.logoUrl)
        : existing.logoUrl,
    special:
      patch.special !== undefined
        ? normalizeSpecial(patch.special)
        : existing.special,
    categories: patch.categories ?? existing.categories,
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
        locale: updated.locale,
        accent_color: updated.accentColor,
        logo_url: updated.logoUrl,
        special: updated.special,
        categories: updated.categories,
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

export async function createWaiterCall(input: {
  menuId: string;
  tableLabel: string;
  note?: string | null;
}): Promise<WaiterCall> {
  const menu = await getMenuById(input.menuId);
  if (!menu || !menu.published) throw new Error("NOT_FOUND");

  const call: WaiterCall = {
    id: nanoid(14),
    menuId: menu.id,
    tableLabel: input.tableLabel.trim().slice(0, 40),
    note: emptyToNull(input.note ?? null),
    status: "open",
    createdAt: now(),
  };

  const client = await db();
  if (client) {
    const { error } = await client.from("qr_menu_calls").insert({
      id: call.id,
      menu_id: call.menuId,
      table_label: call.tableLabel,
      note: call.note,
      status: call.status,
      created_at: call.createdAt,
    });
    if (error) throw new Error(`qr_menu_calls insert failed: ${error.message}`);
    return call;
  }

  callMem().unshift(call);
  return call;
}

export async function listWaiterCalls(
  menuId: string,
  editToken: string
): Promise<WaiterCall[]> {
  const menu = await getMenuById(menuId);
  if (!menu) return [];
  if (!verifyEditToken(menu, editToken)) throw new Error("FORBIDDEN");

  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("qr_menu_calls")
      .select("*")
      .eq("menu_id", menuId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(`qr_menu_calls read failed: ${error.message}`);
    return (data as CallRow[]).map(rowToCall);
  }

  return callMem().filter((c) => c.menuId === menuId).slice(0, 40);
}

export async function ackWaiterCall(input: {
  menuId: string;
  callId: string;
  editToken: string;
}): Promise<WaiterCall | null> {
  const menu = await getMenuById(input.menuId);
  if (!menu) return null;
  if (!verifyEditToken(menu, input.editToken)) throw new Error("FORBIDDEN");

  const client = await db();
  if (client) {
    const { data, error } = await client
      .from("qr_menu_calls")
      .update({ status: "acked" })
      .eq("id", input.callId)
      .eq("menu_id", input.menuId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`qr_menu_calls update failed: ${error.message}`);
    if (!data) return null;
    return rowToCall(data as CallRow);
  }

  const list = callMem();
  const idx = list.findIndex(
    (c) => c.id === input.callId && c.menuId === input.menuId
  );
  if (idx < 0) return null;
  list[idx] = { ...list[idx], status: "acked" };
  return list[idx];
}
