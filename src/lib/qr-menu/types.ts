import { z } from "zod";

export const menuMarketSchema = z.enum(["tr", "nl"]);

export const venueSchema = z.object({
  market: menuMarketSchema,
  googlePlaceId: z.string().min(1).max(120).optional(),
  formattedAddress: z.string().max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(300).optional().or(z.literal("")),
  googleRating: z.number().min(0).max(5).optional(),
  googleReviewCount: z.number().int().min(0).optional(),
  trustpilotProfileUrl: z.string().url().max(300).optional().or(z.literal("")),
  photoName: z.string().max(200).optional(),
  enrichedAt: z.string().datetime().optional(),
});

export type VenueMetadata = z.infer<typeof venueSchema>;

export const menuItemSchema = z.object({
  id: z.string().min(4).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(1_000_000),
  allergens: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  available: z.boolean().default(true),
});

export const menuCategorySchema = z.object({
  id: z.string().min(4).max(40),
  name: z.string().trim().min(1).max(80),
  items: z.array(menuItemSchema).max(60).default([]),
});

export const createMenuSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  currency: z.enum(["EUR", "TRY", "USD", "GBP"]).default("EUR"),
  market: menuMarketSchema.optional(),
  venue: venueSchema.optional(),
  /** When set (e.g. from Google enrichment), replaces default sample categories. */
  categories: z.array(menuCategorySchema).max(20).optional(),
});

export const updateMenuSchema = z.object({
  editToken: z.string().min(8).max(80),
  name: z.string().trim().min(2).max(80).optional(),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  currency: z.enum(["EUR", "TRY", "USD", "GBP"]).optional(),
  categories: z.array(menuCategorySchema).max(20).optional(),
  published: z.boolean().optional(),
});

export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuCategory = z.infer<typeof menuCategorySchema>;

export type QrMenu = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: "EUR" | "TRY" | "USD" | "GBP";
  categories: MenuCategory[];
  venue: VenueMetadata | null;
  published: boolean;
  editToken: string;
  createdAt: string;
  updatedAt: string;
};

export function publicVenueView(venue: VenueMetadata | null) {
  if (!venue) return null;
  return {
    formattedAddress: venue.formattedAddress ?? null,
    googleRating: venue.googleRating ?? null,
    googleReviewCount: venue.googleReviewCount ?? null,
    trustpilotProfileUrl: venue.trustpilotProfileUrl || null,
    website: venue.website || null,
    market: venue.market,
  };
}

export function publicMenuView(menu: QrMenu) {
  return {
    id: menu.id,
    slug: menu.slug,
    name: menu.name,
    tagline: menu.tagline,
    currency: menu.currency,
    venue: publicVenueView(menu.venue),
    categories: menu.categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items
        .filter((i) => i.available !== false)
        .map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description || "",
          price: i.price,
          allergens: i.allergens || [],
        })),
    })),
    published: menu.published,
    updatedAt: menu.updatedAt,
  };
}

export function editorMenuView(menu: QrMenu) {
  return {
    ...publicMenuView(menu),
    editToken: menu.editToken,
    createdAt: menu.createdAt,
  };
}

export function defaultCategories(): MenuCategory[] {
  return [
    {
      id: "cat_drinks",
      name: "Drinks",
      items: [
        {
          id: "item_espresso",
          name: "Espresso",
          description: "Single shot",
          price: 2.5,
          allergens: [],
          available: true,
        },
        {
          id: "item_latte",
          name: "Caffe Latte",
          description: "Espresso, steamed milk",
          price: 3.8,
          allergens: ["Milk"],
          available: true,
        },
      ],
    },
    {
      id: "cat_food",
      name: "Kitchen",
      items: [
        {
          id: "item_toast",
          name: "Avocado toast",
          description: "Sourdough, lemon, chili",
          price: 9.5,
          allergens: ["Gluten"],
          available: true,
        },
      ],
    },
  ];
}
