import type { MenuCategory } from "@/lib/qr-menu/types";

export type WizardAnswers = {
  diet: "any" | "veg" | "light";
  spice: "any" | "mild" | "bold";
  budget: "any" | "low" | "mid" | "high";
};

type FlatItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  allergens: string[];
  imageUrl?: string;
  categoryName: string;
};

const MEAT_RE =
  /\b(et|tavuk|dana|kuzu|sucuk|sosis|balık|somon|karides|köfte|burger|steak|bacon|prosciutto|salami|jambon|chicken|beef|lamb|fish|shrimp)\b/i;
const BOLD_RE =
  /\b(acı|baharat|spicy|chili|jalapeno|kimchi|cajun|harissa|szechuan)\b/i;
const LIGHT_RE =
  /\b(salata|salad|çorba|soup|yoğurt|smoothie|avocado|avokado|light|diyet)\b/i;

function flatten(categories: MenuCategory[]): FlatItem[] {
  const out: FlatItem[] = [];
  for (const c of categories) {
    for (const i of c.items) {
      if (i.available === false) continue;
      out.push({
        id: i.id,
        name: i.name,
        description: i.description || "",
        price: Number(i.price) || 0,
        allergens: i.allergens || [],
        imageUrl: i.imageUrl || "",
        categoryName: c.name,
      });
    }
  }
  return out;
}

function scoreItem(item: FlatItem, a: WizardAnswers, prices: number[]): number {
  let s = 1;
  const blob = `${item.name} ${item.description}`;

  if (a.diet === "veg") {
    if (MEAT_RE.test(blob)) return -1;
    s += 2;
  }
  if (a.diet === "light") {
    if (LIGHT_RE.test(blob)) s += 3;
    if (MEAT_RE.test(blob)) s -= 1;
  }

  if (a.spice === "mild" && BOLD_RE.test(blob)) s -= 2;
  if (a.spice === "bold" && BOLD_RE.test(blob)) s += 3;

  if (prices.length && a.budget !== "any") {
    const sorted = [...prices].sort((x, y) => x - y);
    const p33 = sorted[Math.floor(sorted.length * 0.33)] ?? 0;
    const p66 = sorted[Math.floor(sorted.length * 0.66)] ?? 0;
    if (a.budget === "low" && item.price <= p33) s += 2;
    if (a.budget === "low" && item.price > p66) s -= 2;
    if (a.budget === "mid" && item.price >= p33 && item.price <= p66) s += 2;
    if (a.budget === "high" && item.price >= p66) s += 2;
  }

  return s;
}

/** Pick top recommendations from menu for the guest wizard. */
export function recommendItems(
  categories: MenuCategory[],
  answers: WizardAnswers,
  avoidAllergens: string[] = [],
  limit = 3
): FlatItem[] {
  const items = flatten(categories);
  const avoid = new Set(avoidAllergens.map((a) => a.toLowerCase()));
  const safe = items.filter((i) => {
    for (const a of i.allergens) {
      if (avoid.has(a.toLowerCase())) return false;
    }
    return true;
  });
  const prices = safe.map((i) => i.price);
  const ranked = safe
    .map((i) => ({ item: i, score: scoreItem(i, answers, prices) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.price - b.item.price);

  const seen = new Set<string>();
  const out: FlatItem[] = [];
  for (const r of ranked) {
    if (seen.has(r.item.id)) continue;
    seen.add(r.item.id);
    out.push(r.item);
    if (out.length >= limit) break;
  }
  return out;
}
