export type MenuMarket = "tr" | "nl";

export type MarketConfig = {
  id: MenuMarket;
  label: string;
  /** BCP-47 for Google Places */
  languageCode: string;
  /** ISO 3166-1 alpha-2 */
  regionCode: string;
  defaultCurrency: "TRY" | "EUR";
  /** Approximate center for location bias (lat, lng) */
  locationBias: { lat: number; lng: number; radiusMeters: number };
  copy: {
    searchPlaceholder: string;
    manualEntry: string;
    noResults: string;
    poweredBy: string;
  };
};

export const MENU_MARKETS: Record<MenuMarket, MarketConfig> = {
  tr: {
    id: "tr",
    label: "Türkiye",
    languageCode: "tr",
    regionCode: "tr",
    defaultCurrency: "TRY",
    locationBias: { lat: 41.0082, lng: 28.9784, radiusMeters: 500_000 },
    copy: {
      searchPlaceholder: "Mekan adı ara…",
      manualEntry: "Listede yok — elle devam et",
      noResults: "Sonuç bulunamadı",
      poweredBy: "Google ile mekan bilgisi",
    },
  },
  nl: {
    id: "nl",
    label: "Nederland",
    languageCode: "nl",
    regionCode: "nl",
    defaultCurrency: "EUR",
    locationBias: { lat: 52.3676, lng: 4.9041, radiusMeters: 400_000 },
    copy: {
      searchPlaceholder: "Zoek zaaknaam…",
      manualEntry: "Niet gevonden — handmatig verder",
      noResults: "Geen resultaten",
      poweredBy: "Zaakgegevens via Google",
    },
  },
};

export function parseMenuMarket(raw: unknown): MenuMarket {
  return raw === "tr" ? "tr" : "nl";
}
