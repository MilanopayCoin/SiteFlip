import { z } from "zod";
import { nanoid } from "nanoid";
import type { MenuCategory } from "@/lib/qr-menu/types";
import { aiJson } from "@/lib/ai/providers";
import type { MenuMarket } from "@/lib/places/markets";

const looseItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
  price: z.coerce.number().min(0).max(1_000_000),
  allergens: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

const looseCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  items: z.array(looseItemSchema).max(60),
});

export const parsedMenuSchema = z.object({
  categories: z.array(looseCategorySchema).max(20),
});

export type ParsedMenuDraft = z.infer<typeof parsedMenuSchema>;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

function walkJsonLd(node: unknown, acc: ParsedMenuDraft["categories"]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walkJsonLd(n, acc);
    return;
  }
  const obj = node as Record<string, unknown>;
  const type = String(obj["@type"] || "").toLowerCase();
  if (type.includes("menu") || type.includes("menusection")) {
    const sectionName =
      (typeof obj.name === "string" && obj.name) ||
      (typeof obj.headline === "string" && obj.headline) ||
      "Menu";
    const items: ParsedMenuDraft["categories"][number]["items"] = [];
    const hasMenuItem = obj.hasMenuItem ?? obj.hasPart;
    if (Array.isArray(hasMenuItem)) {
      for (const it of hasMenuItem) {
        if (!it || typeof it !== "object") continue;
        const row = it as Record<string, unknown>;
        const name = typeof row.name === "string" ? row.name : "";
        if (!name.trim()) continue;
        let price = 0;
        const offers = row.offers;
        if (offers && typeof offers === "object") {
          const o = offers as Record<string, unknown>;
          if (typeof o.price === "number") price = o.price;
          else if (typeof o.price === "string") price = parseFloat(o.price) || 0;
        }
        items.push({
          name: name.trim(),
          description:
            typeof row.description === "string" ? row.description.trim() : "",
          price,
        });
      }
    }
    if (items.length) acc.push({ name: sectionName.slice(0, 80), items });
  }
  for (const v of Object.values(obj)) walkJsonLd(v, acc);
}

function parsePriceLines(text: string, currency: string): ParsedMenuDraft {
  const sym =
    currency === "TRY" ? "₺|TL" : currency === "EUR" ? "€|EUR" : "\\$|USD|£|GBP";
  const lineRe = new RegExp(
    `^(.{2,80}?)\\s+(?:[-–—]|\\.\\.\\.)\\s*([\\d.,]+)\\s*(?:${sym})?\\s*$`,
    "gim"
  );
  const items: ParsedMenuDraft["categories"][number]["items"] = [];
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text))) {
    const name = m[1].trim();
    const priceRaw = m[2].replace(/\./g, "").replace(",", ".");
    const price = parseFloat(priceRaw);
    if (!name || Number.isNaN(price)) continue;
    items.push({ name, price, description: "" });
    if (items.length >= 40) break;
  }
  if (!items.length) return { categories: [] };
  return {
    categories: [{ name: "Imported", items }],
  };
}

export function draftToCategories(draft: ParsedMenuDraft): MenuCategory[] {
  return draft.categories.map((c) => ({
    id: nanoid(10),
    name: c.name,
    items: c.items.map((i) => ({
      id: nanoid(10),
      name: i.name,
      description: i.description || "",
      price: i.price,
      allergens: i.allergens ?? [],
      available: true,
    })),
  }));
}

export async function parseMenuFromHtml(input: {
  html: string;
  market: MenuMarket;
  currency: string;
  venueName: string;
}): Promise<{
  draft: ParsedMenuDraft;
  method: "jsonld" | "regex" | "ai" | "none";
  warnings: string[];
}> {
  const warnings: string[] = [];
  const jsonLdCats: ParsedMenuDraft["categories"] = [];
  for (const block of extractJsonLdBlocks(input.html)) {
    walkJsonLd(block, jsonLdCats);
  }
  if (jsonLdCats.length) {
    const parsed = parsedMenuSchema.safeParse({ categories: jsonLdCats });
    if (parsed.success && parsed.data.categories.some((c) => c.items.length)) {
      return { draft: parsed.data, method: "jsonld", warnings };
    }
  }

  const plain = stripHtml(input.html).slice(0, 24_000);
  const regexDraft = parsePriceLines(plain, input.currency);
  if (regexDraft.categories.some((c) => c.items.length >= 3)) {
    warnings.push("Prices parsed from page text — verify before publishing.");
    return { draft: regexDraft, method: "regex", warnings };
  }

  const snippet = plain.slice(0, 12_000);
  const lang = input.market === "tr" ? "Turkish" : "Dutch/English";
  const result = await aiJson(
    `You extract restaurant/cafe menu items from website text for ${lang} venues. Return JSON: { "categories": [ { "name": string, "items": [ { "name", "description?", "price" number, "allergens"? string[] } ] } ] }. Use ${input.currency} typical prices if missing. Max 4 categories, 12 items each. Only real food/drink from the text.`,
    {
      venueName: input.venueName,
      currency: input.currency,
      text: snippet,
    },
    parsedMenuSchema,
    () => ({ categories: [] })
  );

  if (result.data.categories.some((c) => c.items.length)) {
    warnings.push(
      result.provider === "heuristic"
        ? "AI unavailable — add items manually or configure OPENAI/GROQ."
        : "AI extracted menu — verify all prices and names."
    );
    return { draft: result.data, method: "ai", warnings };
  }

  return { draft: { categories: [] }, method: "none", warnings: ["No menu items found on this page."] };
}
