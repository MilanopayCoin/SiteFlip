import type { MenuMarket } from "@/lib/places/markets";
import type { MenuCategory } from "@/lib/qr-menu/types";

export function defaultCategoriesForMarket(market: MenuMarket): MenuCategory[] {
  if (market === "tr") {
    return [
      {
        id: "cat_icecek",
        name: "İçecekler",
        items: [
          {
            id: "item_turk_kahve",
            name: "Türk kahvesi",
            description: "Geleneksel",
            price: 85,
            allergens: [],
            available: true,
          },
          {
            id: "item_latte_tr",
            name: "Latte",
            description: "Espresso, süt",
            price: 120,
            allergens: ["Süt"],
            available: true,
          },
        ],
      },
      {
        id: "cat_mutfak",
        name: "Mutfak",
        items: [
          {
            id: "item_kahvalti",
            name: "Serpme kahvaltı",
            description: "2 kişilik",
            price: 650,
            allergens: ["Gluten", "Süt"],
            available: true,
          },
        ],
      },
    ];
  }

  return [
    {
      id: "cat_drinks",
      name: "Dranken",
      items: [
        {
          id: "item_espresso",
          name: "Espresso",
          description: "Enkel shot",
          price: 2.5,
          allergens: [],
          available: true,
        },
        {
          id: "item_latte",
          name: "Caffe latte",
          description: "Espresso, melk",
          price: 3.8,
          allergens: ["Melk"],
          available: true,
        },
      ],
    },
    {
      id: "cat_food",
      name: "Keuken",
      items: [
        {
          id: "item_toast",
          name: "Avocado toast",
          description: "Desem, citroen",
          price: 9.5,
          allergens: ["Gluten"],
          available: true,
        },
      ],
    },
  ];
}

export function taglineFromPlaceType(
  primaryType: string | null,
  market: MenuMarket
): string | null {
  if (!primaryType) return null;
  const t = primaryType.replace(/_/g, " ");
  if (market === "tr") {
    const map: Record<string, string> = {
      restaurant: "Restoran",
      cafe: "Kafe",
      bar: "Bar",
      bakery: "Fırın & pastane",
      "meal takeaway": "Paket servis",
    };
    return map[t] ?? t;
  }
  const map: Record<string, string> = {
    restaurant: "Restaurant",
    cafe: "Café",
    bar: "Bar",
    bakery: "Bakkerij",
    "meal takeaway": "Afhaal",
  };
  return map[t] ?? t;
}
