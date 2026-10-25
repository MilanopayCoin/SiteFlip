import { z } from "zod";
import { aiJson } from "@/lib/ai/providers";
import type { MenuMarket } from "@/lib/places/markets";
import { draftToCategories, parsedMenuSchema } from "@/lib/qr-menu/parse-menu-html";
import type { MenuCategory } from "@/lib/qr-menu/types";

export async function suggestMenuItems(input: {
  venueName: string;
  tagline: string;
  market: MenuMarket;
  currency: string;
  count: number;
  existingNames: string[];
}): Promise<{ categories: MenuCategory[]; provider: string; note: string }> {
  const count = Math.min(12, Math.max(3, input.count));
  const lang = input.market === "tr" ? "Turkish" : "Dutch";
  const schema = parsedMenuSchema;

  const result = await aiJson(
    `Suggest ${count} realistic menu items for a ${lang} hospitality venue. JSON only: { categories: [{ name, items: [{ name, description?, price number, allergens?[] }] }] }. Group into 1-2 categories. Currency context: ${input.currency}. Do not duplicate: ${input.existingNames.slice(0, 30).join(", ")}.`,
    {
      venueName: input.venueName,
      tagline: input.tagline,
      count,
    },
    schema,
    () => ({
      categories:
        input.market === "tr"
          ? [
              {
                name: "Önerilen",
                items: [
                  { name: "Filtre kahve", description: "", price: 95 },
                  { name: "Limonata", description: "Ev yapımı", price: 110 },
                  { name: "Cheesecake", description: "", price: 180 },
                ],
              },
            ]
          : [
              {
                name: "Suggested",
                items: [
                  { name: "Flat white", description: "", price: 4.2 },
                  { name: "Homemade lemonade", description: "", price: 4.5 },
                  { name: "Brownie", description: "", price: 5.5 },
                ],
              },
            ],
    })
  );

  const cats = draftToCategories(result.data).map((c) => ({
    ...c,
    name:
      input.market === "tr" && c.name === "Imported"
        ? "Önerilen"
        : c.name === "Imported"
          ? "Suggested"
          : c.name,
  }));

  return {
    categories: cats,
    provider: result.provider,
    note:
      result.provider === "heuristic"
        ? input.market === "tr"
          ? "AI kapalı — örnek öneriler eklendi."
          : "Geen AI — voorbeeldsuggesties toegevoegd."
        : input.market === "tr"
          ? "Fiyatları kontrol edin."
          : "Controleer de prijzen.",
  };
}

export const suggestRequestSchema = z.object({
  editToken: z.string().min(8).max(80),
  count: z.coerce.number().int().min(3).max(12).default(6),
});

export const importRequestSchema = z.object({
  editToken: z.string().min(8).max(80),
  url: z.string().url().max(500).optional(),
  useVenueWebsite: z.boolean().optional(),
});
