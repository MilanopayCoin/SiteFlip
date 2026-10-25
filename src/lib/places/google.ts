import type { MenuMarket } from "@/lib/places/markets";
import { MENU_MARKETS } from "@/lib/places/markets";

const PLACES_BASE = "https://places.googleapis.com/v1";

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  primaryType: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  photoName: string | null;
  openingHours: string[] | null;
};

function apiKey(): string | null {
  const k = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return k || null;
}

export function placesConfigured(): boolean {
  return Boolean(apiKey());
}

export async function autocompletePlaces(input: {
  query: string;
  market: MenuMarket;
  sessionToken: string;
}): Promise<PlaceSuggestion[]> {
  const key = apiKey();
  if (!key) return [];

  const market = MENU_MARKETS[input.market];
  const q = input.query.trim();
  if (q.length < 2) return [];

  const body = {
    input: q,
    includedPrimaryTypes: ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"],
    includedRegionCodes: [market.regionCode],
    languageCode: market.languageCode,
    sessionToken: input.sessionToken,
    locationBias: {
      circle: {
        center: {
          latitude: market.locationBias.lat,
          longitude: market.locationBias.lng,
        },
        radius: market.locationBias.radiusMeters,
      },
    },
  };

  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("places autocomplete failed", res.status, errText.slice(0, 200));
    return [];
  }

  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };

  const out: PlaceSuggestion[] = [];
  for (const s of data.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    const primary =
      p.structuredFormat?.mainText?.text ?? p.text?.text ?? "";
    const secondary = p.structuredFormat?.secondaryText?.text ?? "";
    out.push({
      placeId: p.placeId,
      primaryText: primary,
      secondaryText: secondary,
      fullText: [primary, secondary].filter(Boolean).join(", "),
    });
  }
  return out.slice(0, 8);
}

export async function fetchPlaceDetails(input: {
  placeId: string;
  market: MenuMarket;
  sessionToken: string;
}): Promise<PlaceDetails | null> {
  const key = apiKey();
  if (!key) return null;

  const market = MENU_MARKETS[input.market];
  const placeId = encodeURIComponent(input.placeId);
  const url = `${PLACES_BASE}/places/${placeId}?languageCode=${market.languageCode}&sessionToken=${encodeURIComponent(input.sessionToken)}`;

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "id",
        "displayName",
        "formattedAddress",
        "location",
        "nationalPhoneNumber",
        "websiteUri",
        "primaryType",
        "rating",
        "userRatingCount",
        "regularOpeningHours",
        "photos",
      ].join(","),
    },
  });

  if (!res.ok) {
    console.error("places details failed", res.status);
    return null;
  }

  const data = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    nationalPhoneNumber?: string;
    websiteUri?: string;
    primaryType?: string;
    rating?: number;
    userRatingCount?: number;
    photos?: Array<{ name?: string }>;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
  };

  return {
    placeId: data.id ?? input.placeId,
    name: data.displayName?.text?.trim() || "",
    formattedAddress: data.formattedAddress?.trim() || "",
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
    phone: data.nationalPhoneNumber?.trim() || null,
    website: data.websiteUri?.trim() || null,
    primaryType: data.primaryType ?? null,
    googleRating: typeof data.rating === "number" ? data.rating : null,
    googleReviewCount:
      typeof data.userRatingCount === "number" ? data.userRatingCount : null,
    photoName: data.photos?.[0]?.name ?? null,
    openingHours: data.regularOpeningHours?.weekdayDescriptions ?? null,
  };
}

/** Server-side photo redirect URL (keeps API key off the client). */
export function placePhotoProxyPath(photoName: string, maxPx = 480): string {
  const enc = encodeURIComponent(photoName);
  return `/api/places/photo?name=${enc}&max=${maxPx}`;
}
