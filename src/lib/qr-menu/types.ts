import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #D4FF3A")
  .optional()
  .or(z.literal(""));

const logoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Logo must be an http(s) URL"
  )
  .optional()
  .or(z.literal(""));

const itemImageSchema = z
  .string()
  .max(160_000)
  .refine(
    (v) =>
      !v ||
      /^https?:\/\//i.test(v) ||
      /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(v),
    "Image must be http(s) URL or compressed data URI"
  )
  .optional()
  .or(z.literal(""));

export const menuItemSchema = z.object({
  id: z.string().min(4).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(1_000_000),
  allergens: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  available: z.boolean().default(true),
  /** Optional product photo — https URL or compressed JPEG data URI */
  imageUrl: itemImageSchema,
});

export const menuCategorySchema = z.object({
  id: z.string().min(4).max(40),
  name: z.string().trim().min(1).max(80),
  items: z.array(menuItemSchema).max(60).default([]),
});

export const menuSpecialSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    price: z.coerce.number().min(0).max(1_000_000).optional(),
    until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]*)?$/)
      .optional()
      .or(z.literal("")),
  })
  .nullable()
  .optional();

export const createMenuSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  currency: z.enum(["EUR", "TRY", "USD", "GBP"]).default("TRY"),
  locale: z.enum(["tr", "en"]).default("tr"),
});

export const updateMenuSchema = z.object({
  editToken: z.string().min(8).max(80),
  name: z.string().trim().min(2).max(80).optional(),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  currency: z.enum(["EUR", "TRY", "USD", "GBP"]).optional(),
  locale: z.enum(["tr", "en"]).optional(),
  accentColor: hexColor,
  logoUrl: logoUrlSchema,
  special: menuSpecialSchema,
  categories: z.array(menuCategorySchema).max(20).optional(),
  published: z.boolean().optional(),
});

export const waiterCallSchema = z.object({
  tableLabel: z.string().trim().min(1).max(40),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuCategory = z.infer<typeof menuCategorySchema>;
export type MenuSpecial = NonNullable<z.infer<typeof menuSpecialSchema>>;

export type QrMenu = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: "EUR" | "TRY" | "USD" | "GBP";
  locale: "tr" | "en";
  accentColor: string;
  logoUrl: string | null;
  special: MenuSpecial | null;
  categories: MenuCategory[];
  published: boolean;
  editToken: string;
  createdAt: string;
  updatedAt: string;
};

export type WaiterCall = {
  id: string;
  menuId: string;
  tableLabel: string;
  note: string | null;
  status: "open" | "acked" | "closed";
  createdAt: string;
};

export const DEFAULT_ACCENT = "#D4FF3A";

export function isSpecialActive(special: MenuSpecial | null | undefined): boolean {
  if (!special?.title) return false;
  if (!special.until) return true;
  const t = Date.parse(special.until);
  if (Number.isNaN(t)) return true;
  return t > Date.now();
}

export function publicMenuView(menu: QrMenu) {
  const special = isSpecialActive(menu.special) ? menu.special : null;
  return {
    id: menu.id,
    slug: menu.slug,
    name: menu.name,
    tagline: menu.tagline,
    currency: menu.currency,
    locale: menu.locale,
    accentColor: menu.accentColor || DEFAULT_ACCENT,
    logoUrl: menu.logoUrl,
    special,
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
          imageUrl: i.imageUrl || "",
        })),
    })),
    published: menu.published,
    updatedAt: menu.updatedAt,
  };
}

export function editorMenuView(menu: QrMenu) {
  return {
    ...publicMenuView(menu),
    special: menu.special,
    editToken: menu.editToken,
    createdAt: menu.createdAt,
  };
}

export function defaultCategories(locale: "tr" | "en" = "tr"): MenuCategory[] {
  if (locale === "en") {
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

  return [
    {
      id: "cat_drinks",
      name: "İçecekler",
      items: [
        {
          id: "item_cay",
          name: "Çay",
          description: "Demlik çay",
          price: 40,
          allergens: [],
          available: true,
        },
        {
          id: "item_latte",
          name: "Latte",
          description: "Espresso, süt",
          price: 120,
          allergens: ["Süt"],
          available: true,
        },
      ],
    },
    {
      id: "cat_food",
      name: "Mutfak",
      items: [
        {
          id: "item_tost",
          name: "Karışık tost",
          description: "Kaşar, sucuk",
          price: 180,
          allergens: ["Gluten", "Süt"],
          available: true,
        },
      ],
    },
  ];
}

/** Collect unique allergens across a menu for the guest lens */
export function collectAllergens(
  categories: { items: { allergens?: string[] }[] }[]
): string[] {
  const set = new Set<string>();
  for (const c of categories) {
    for (const item of c.items) {
      for (const a of item.allergens || []) {
        const t = a.trim();
        if (t) set.add(t);
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
}
